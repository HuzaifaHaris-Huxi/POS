import json
import logging
from decimal import Decimal
from django.db import models, transaction
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from api.models import (
    PurchaseOrder, PurchaseOrderItem,
    PurchaseReturn, PurchaseReturnItem, PurchaseReturnRefund,
    Party, Product, Payment, UnitOfMeasure,
    BankAccount, Branch, Expense, ExpenseCategory,
    PurchaseOrderPayment
)

logger = logging.getLogger(__name__)

def to_dec(v, default="0"):
    try:
        return Decimal(str(v))
    except Exception:
        return Decimal(default)

# ─── Endpoint: Purchase Order Form Data ──────────────────────────────────────
@require_http_methods(["GET"])
def purchase_form_data(request):
    """
    Returns data needed for the Purchase Order form:
    - Branches
    - Vendors (Parties with type=VENDOR or BOTH)
    - Products
    - Bank Accounts
    """
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)

    try:
        staff = request.user.staff_profile
        biz = staff.business
    except Exception:
        return JsonResponse({"error": "No business profile found."}, status=403)

    branches = list(Branch.objects.filter(business=biz, is_active=True).values('id', 'name'))
    vendors = list(Party.objects.filter(
        business=biz, 
        is_active=True
    ).values('id', 'display_name', 'phone', 'cached_balance'))
    
    # Simple product list for search
    products = list(Product.objects.filter(business=biz, is_active=True).values(
        'id', 'name', 'barcode', 'sku', 'purchase_price', 'sale_price', 'uom_id', 'uom__code',
        'bulk_uom_id', 'bulk_uom__code', 'default_bulk_size', 'stock_qty', 'expiry_date'
    ))
    # Rename some fields for frontend consistency
    for p in products:
        p['uom_code'] = p.pop('uom__code')
        p['bulk_uom_code'] = p.pop('bulk_uom__code')

    bank_accounts = list(BankAccount.objects.filter(business=biz, is_active=True).values('id', 'name', 'bank_name'))

    return JsonResponse({
        "branches": branches,
        "vendors": vendors,
        "products": products,
        "bank_accounts": bank_accounts
    })

# ─── Endpoint: Create Purchase Order ──────────────────────────────────────────
@csrf_exempt
@require_http_methods(["POST"])
def create_purchase_order(request):
    """
    Expected JSON body:
    {
        "branch_id": <int>,
        "vendor_id": <int>,
        "status": "pending" | "received",
        "total_cost": <number>,
        "discount_percent": <number>,
        "tax_percent": <number>,
        "net_total": <number>,
        "deposit": {
             "amount": <number>,
             "payment_method": "cash" | "bank",
             "bank_account_id": <int|null>
        },
        "items": [...],
        "expenses": [...]
    }
    """
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)

    try:
        staff = request.user.staff_profile
        biz = staff.business
    except Exception:
        return JsonResponse({"error": "No business profile found."}, status=403)

    try:
        data = json.loads(request.body)
    except:
        return JsonResponse({"error": "Invalid JSON."}, status=400)

    branch_id = data.get("branch_id")
    vendor_id = data.get("vendor_id")
    status = data.get("status", "pending")
    items = data.get("items", [])
    po_expenses = data.get("expenses", [])
    deposit_data = data.get("deposit")

    if not vendor_id:
        return JsonResponse({"error": "Vendor is required."}, status=400)
    if not items:
        return JsonResponse({"error": "Items are required."}, status=400)

    try:
        with transaction.atomic():
            branch = Branch.objects.get(id=branch_id, business=biz)
            vendor = Party.objects.get(id=vendor_id, business=biz)
            
            # 1. Create Purchase Order
            po = PurchaseOrder.objects.create(
                business=biz,
                date=data.get("order_date") or timezone.now().date(),
                branch=branch,
                supplier=vendor,
                status=status,
                total_cost=to_dec(data.get("total_cost", 0)),
                discount_percent=to_dec(data.get("discount_percent", 0)),
                tax_percent=to_dec(data.get("tax_percent", 0)),
                net_total=to_dec(data.get("net_total", 0)),
                notes=data.get("notes", ""),
                created_by=request.user,
                updated_by=request.user
            )

            # 2. Create Items
            for it in items:
                prod = Product.objects.get(id=it["product_id"], business=biz)
                uom = UnitOfMeasure.objects.get(id=it["uom_id"])
                
                qty = to_dec(it["quantity"])
                spu = to_dec(it["size_per_unit"], "1")
                
                PurchaseOrderItem.objects.create(
                    purchase_order=po,
                    product=prod,
                    uom=uom,
                    quantity=qty,
                    unit_price=to_dec(it["price"]),
                    size_per_unit=spu,
                    sale_price=to_dec(it.get("sale_price", 0)),
                    expiry_date=it.get("expiry_date") if it.get("expiry_date") else None
                )

                # Update product master rates and expiry if changed
                new_sp = to_dec(it.get("sale_price"))
                new_pp = to_dec(it.get("price"))
                if new_sp > 0: prod.sale_price = new_sp
                if new_pp > 0: prod.purchase_price = new_pp
                if it.get("expiry_date"): prod.expiry_date = it.get("expiry_date")
                prod.save()
                
                # If status is received, add to stock
                if status == "received":
                    base_qty = qty * spu
                    Product.objects.filter(id=prod.id).update(stock_qty=models.F("stock_qty") + base_qty)

            # 3. Create Expenses
            for exp in po_expenses:
                cat = exp.get("category", ExpenseCategory.OTHER)
                amt = to_dec(exp.get("amount", 0))
                if amt <= 0: continue

                is_paid = exp.get("is_paid", False)
                bank_acc = None
                if exp.get("payment_method") == "bank" and exp.get("bank_account_id"):
                    bank_acc = BankAccount.objects.get(id=exp["bank_account_id"], business=biz)

                Expense.objects.create(
                    business=biz,
                    branch=branch,
                    purchase_order=po,
                    category=cat,
                    amount=amt,
                    description=exp.get("description", ""),
                    is_paid=is_paid,
                    payment_source=exp.get("payment_method", "cash"),
                    bank_account=bank_acc,
                    divide_per_unit=exp.get("divide_per_unit", False),
                    created_by=request.user,
                    updated_by=request.user
                )

            # 4. Handle Optional Deposit
            if deposit_data:
                dep_amount = to_dec(deposit_data.get("amount", 0))
                dep_method = deposit_data.get("payment_method", "cash").lower()
                bank_acc_id = deposit_data.get("bank_account_id")

                if dep_amount > 0 and dep_method != "credit":
                    method_map = {"cash": Payment.PaymentMethod.CASH, "bank": Payment.PaymentMethod.BANK}
                    pm = method_map.get(dep_method, Payment.PaymentMethod.CASH)
                    bank_acc = None
                    if dep_method == "bank" and bank_acc_id:
                        bank_acc = BankAccount.objects.get(id=bank_acc_id, business=biz)

                    payment = Payment.objects.create(
                        business=biz,
                        branch=branch,
                        party=vendor,
                        direction=Payment.OUT,
                        amount=dep_amount,
                        payment_method=pm,
                        payment_source=Payment.BANK if dep_method == "bank" else Payment.CASH,
                        bank_account=bank_acc,
                        description=f"Purchase deposit — PO #{po.id}",
                        created_by=request.user,
                        updated_by=request.user,
                    )
                    po.apply_payment(payment, dep_amount)

            # 5. Finalize
            po.distribute_expenses()
            po.recompute_totals()
            po.save()

            return JsonResponse({"message": "Purchase Order created.", "id": po.id})

    except Exception as e:
        logger.exception("Error creating PO")
        return JsonResponse({"error": str(e)}, status=500)

# ─── Endpoint: Update Purchase Order (Full) ───────────────────────────────────
@csrf_exempt
@require_http_methods(["PUT"])
def update_purchase_order(request, pk):
    """
    Identical payload to create_purchase_order.
    Deletes old items/expenses and replaces them.
    Records new deposits if provided.
    """
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)

    try:
        staff = request.user.staff_profile
        biz = staff.business
        po = PurchaseOrder.objects.get(id=pk, business=biz)
    except PurchaseOrder.DoesNotExist:
        return JsonResponse({"error": "Order not found."}, status=404)
    except Exception:
        return JsonResponse({"error": "No business profile found."}, status=403)

    try:
        data = json.loads(request.body)
        branch_id = data.get("branch_id")
        vendor_id = data.get("vendor_id")
        status = data.get("status", po.status)
        items = data.get("items", [])
        po_expenses = data.get("expenses", [])
        deposit_data = data.get("deposit")
        
        with transaction.atomic():
            branch = Branch.objects.get(id=branch_id, business=biz)
            vendor = Party.objects.get(id=vendor_id, business=biz)

            # 1. Reverse old stock if it was 'received'
            if po.status == "received":
                for item in po.items.all():
                    base_qty = item.quantity * item.size_per_unit
                    Product.objects.filter(id=item.product.id).update(stock_qty=models.F("stock_qty") - base_qty)

            # 2. Update basic info
            po.branch = branch
            po.supplier = vendor
            po.status = status
            po.date = data.get("order_date") or po.date
            po.notes = data.get("notes", "")
            po.discount_percent = to_dec(data.get("discount_percent", 0))
            po.tax_percent = to_dec(data.get("tax_percent", 0))
            po.updated_by = request.user
            
            # 3. Replace items
            po.items.all().delete()
            sub_total = Decimal("0.00")
            for it in items:
                prod = Product.objects.get(id=it["product_id"], business=biz)
                uom = UnitOfMeasure.objects.get(id=it["uom_id"])
                qty = to_dec(it["quantity"])
                price = to_dec(it["price"])
                spu = to_dec(it["size_per_unit"], "1")
                
                PurchaseOrderItem.objects.create(
                    purchase_order=po, product=prod, uom=uom,
                    quantity=qty, unit_price=price, size_per_unit=spu,
                    sale_price=to_dec(it.get("sale_price", 0)),
                    expiry_date=it.get("expiry_date") if it.get("expiry_date") else None
                )
                
                # Update product master rates and expiry if changed
                new_sp = to_dec(it.get("sale_price"))
                if new_sp > 0: prod.sale_price = new_sp
                if price > 0: prod.purchase_price = price
                if it.get("expiry_date"): prod.expiry_date = it.get("expiry_date")
                prod.save()
                if status == "received":
                    base_qty = qty * spu
                    Product.objects.filter(id=prod.id).update(stock_qty=models.F("stock_qty") + base_qty)
                sub_total += qty * price
            
            po.total_cost = sub_total

            # 4. Replace expenses
            po.expenses.all().delete()
            for exp in po_expenses:
                cat = exp.get("category", ExpenseCategory.OTHER)
                amt = to_dec(exp.get("amount", 0))
                if amt <= 0: continue

                bank_acc = None
                if exp.get("payment_method") == "bank" and exp.get("bank_account_id"):
                    bank_acc = BankAccount.objects.get(id=exp["bank_account_id"], business=biz)

                Expense.objects.create(
                    business=biz, branch=branch, purchase_order=po,
                    category=cat, amount=amt, description=exp.get("description", ""),
                    is_paid=exp.get("is_paid", False), payment_source=exp.get("payment_method", "cash"),
                    bank_account=bank_acc, divide_per_unit=exp.get("divide_per_unit", False),
                    created_by=request.user, updated_by=request.user
                )

            # 5. Handle New Deposit
            if deposit_data:
                dep_amount = to_dec(deposit_data.get("amount", 0))
                dep_method = deposit_data.get("payment_method", "cash").lower()
                bank_acc_id = deposit_data.get("bank_account_id")

                if dep_amount > 0 and dep_method != "credit":
                    method_map = {"cash": Payment.PaymentMethod.CASH, "bank": Payment.PaymentMethod.BANK}
                    pm = method_map.get(dep_method, Payment.PaymentMethod.CASH)
                    bank_acc = None
                    if dep_method == "bank" and bank_acc_id:
                        bank_acc = BankAccount.objects.get(id=bank_acc_id, business=biz)

                    payment = Payment.objects.create(
                        business=biz, branch=branch, party=vendor,
                        direction=Payment.OUT, amount=dep_amount,
                        payment_method=pm,
                        payment_source=Payment.BANK if dep_method == "bank" else Payment.CASH,
                        bank_account=bank_acc,
                        description=f"Payment on edit — PO #{po.id}",
                        created_by=request.user, updated_by=request.user,
                    )
                    po.apply_payment(payment, dep_amount)

            # 6. Save and recompute
            po.distribute_expenses()
            po.recompute_totals()
            po.save()

            return JsonResponse({"message": "Purchase Order updated.", "id": po.id})

    except Exception as e:
        logger.exception("Error updating PO")
        return JsonResponse({"error": str(e)}, status=500)

# ─── Endpoint: List Purchase Orders ──────────────────────────────────────────
@require_http_methods(["GET"])
def list_purchase_orders(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)

    try:
        staff = request.user.staff_profile
        biz = staff.business
    except Exception:
        return JsonResponse({"error": "No business profile found."}, status=403)

    orders = PurchaseOrder.objects.filter(business=biz, is_deleted=False).select_related('supplier', 'branch')
    
    # Filter by branch
    branch_id = request.GET.get('branch_id')
    if branch_id:
        orders = orders.filter(branch_id=branch_id)
        
    # Filter by status
    status = request.GET.get('status')
    if status:
        orders = orders.filter(status=status)

    # Basic pagination
    offset = int(request.GET.get('offset', 0))
    limit = int(request.GET.get('limit', 50))
    count = orders.count()
    orders = orders[offset:offset+limit]

    data = []
    for o in orders:
        data.append({
            "id": o.id,
            "vendor": o.supplier.display_name,
            "branch": o.branch.name if o.branch else "Main",
            "status": o.status,
            "net_total": float(o.net_total),
            "paid": float(o.paid_total),
            "balance": float(o.balance_due),
            "date": o.date.strftime("%Y-%m-%d"),
            "created_at": o.created_at.strftime("%Y-%m-%d %H:%M")
        })

    return JsonResponse({"orders": data, "count": count})

# ─── Endpoint: Update PO Status ───────────────────────────────────────────────
@csrf_exempt
@require_http_methods(["PATCH"])
def update_purchase_order_status(request, pk):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)

    try:
        staff = request.user.staff_profile
        biz = staff.business
    except Exception:
        return JsonResponse({"error": "No business profile found."}, status=403)

    try:
        po = PurchaseOrder.objects.get(id=pk, business=biz)
        data = json.loads(request.body)
        new_status = data.get("status", "").lower()

        if new_status not in ["pending", "received", "cancelled"]:
            return JsonResponse({"error": "Invalid status."}, status=400)

        if po.status == new_status:
            return JsonResponse({"message": "Status already set."})

        with transaction.atomic():
            # Current effects rollback
            if po.status == "received":
                # Reverse stock addition (deduct it)
                for item in po.items.all():
                    base_qty = item.quantity * item.size_per_unit
                    Product.objects.filter(id=item.product.id).update(stock_qty=models.F("stock_qty") - base_qty)

            # Apply new status effects
            if new_status == "received":
                # Add stock
                for item in po.items.all():
                    base_qty = item.quantity * item.size_per_unit
                    Product.objects.filter(id=item.product.id).update(stock_qty=models.F("stock_qty") + base_qty)
            
            elif new_status == "cancelled":
                # Delete associated payments
                for app in po.payment_applications.all():
                    if app.payment:
                        app.payment.delete()
                    app.delete()

            po.status = new_status
            po.updated_by = request.user
            po.save()

        return JsonResponse({"message": f"Status updated to {new_status}."})

    except PurchaseOrder.DoesNotExist:
        return JsonResponse({"error": "Order not found."}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

# ─── Endpoint: PO Detail ──────────────────────────────────────────────────────
@require_http_methods(["GET"])
def purchase_order_detail(request, pk):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)

    try:
        staff = request.user.staff_profile
        biz = staff.business
        po = PurchaseOrder.objects.get(id=pk, business=biz)
    except PurchaseOrder.DoesNotExist:
        return JsonResponse({"error": "Order not found."}, status=404)
    except Exception:
        return JsonResponse({"error": "No business profile found."}, status=403)

    items = []
    for it in po.items.all():
        items.append({
            "id": it.id,
            "product_id": it.product_id,
            "product_name": it.product.name,
            "uom_id": it.uom_id,
            "uom_code": it.uom.code if it.uom else "",
            "quantity": float(it.quantity),
            "unit_price": float(it.unit_price),
            "size_per_unit": float(it.size_per_unit),
            "sale_price": float(it.sale_price or 0),
            "expiry_date": it.expiry_date.strftime("%Y-%m-%d") if it.expiry_date else ""
        })

    expenses = []
    for ex in po.expenses.all():
        expenses.append({
            "id": ex.id,
            "category": ex.category,
            "amount": float(ex.amount),
            "description": ex.description,
            "is_paid": ex.is_paid,
            "payment_method": ex.payment_source,
            "bank_account_id": ex.bank_account_id,
            "divide_per_unit": ex.divide_per_unit
        })

    payments = []
    for app in po.payment_applications.select_related('payment'):
        payments.append({
            "amount": float(app.amount),
            "payment_method": app.payment.get_payment_method_display(),
            "date": app.payment.created_at.strftime("%Y-%m-%d %H:%M")
        })

    return JsonResponse({
        "id": po.id,
        "vendor_id": po.supplier_id,
        "vendor_name": po.supplier.display_name,
        "branch_id": po.branch_id,
        "branch": po.branch.name if po.branch else "Main",
        "status": po.status,
        "date": po.date.strftime("%Y-%m-%d") if po.date else "",
        "total_cost": float(po.total_cost),
        "discount_percent": float(po.discount_percent),
        "tax_percent": float(po.tax_percent),
        "net_total": float(po.net_total),
        "paid": float(po.paid_total),
        "balance_due": float(po.balance_due),
        "notes": po.notes,
        "created_at": po.created_at.strftime("%Y-%m-%d %H:%M"),
        "items": items,
        "expenses": expenses,
        "payments": payments
    })
# ─── Purchase Returns ──────────────────────────────────────────────────────────

@require_http_methods(["GET"])
def list_purchase_returns(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)
    try:
        staff = request.user.staff_profile
        biz = staff.business
    except Exception:
        return JsonResponse({"error": "No business profile found."}, status=403)

    returns = PurchaseReturn.objects.filter(business=biz, is_deleted=False).select_related('supplier', 'branch')
    
    branch_id = request.GET.get('branch_id')
    if branch_id and branch_id != 'all':
        returns = returns.filter(branch_id=branch_id)
        
    status = request.GET.get('status')
    if status:
        returns = returns.filter(status=status)

    # Basic pagination
    offset = int(request.GET.get('offset', 0))
    limit = int(request.GET.get('limit', 50))
    count = returns.count()
    returns = returns[offset:offset+limit]

    data = []
    for r in returns:
        data.append({
            "id": r.id,
            "vendor": r.supplier.display_name,
            "branch": r.branch.name if r.branch else "Main",
            "status": r.status,
            "net_total": float(r.net_total),
            "refunded": float(r.refunded_total),
            "balance": float(r.refund_remaining),
            "created_at": r.created_at.strftime("%Y-%m-%d %H:%M")
        })

    return JsonResponse({"returns": data, "count": count})

@csrf_exempt
@require_http_methods(["POST"])
def create_purchase_return(request):
    """
    Opposite of Purchase Order.
    Stock decreases if status is processed.
    Refunds from suppliers are Payment.IN.
    """
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)
    try:
        staff = request.user.staff_profile
        biz = staff.business
    except Exception:
        return JsonResponse({"error": "No business profile found."}, status=403)

    try:
        data = json.loads(request.body)
        branch_id = data.get("branch_id")
        vendor_id = data.get("vendor_id")
        status = data.get("status", "pending")
        items = data.get("items", [])
        refund_data = data.get("refund") # {amount, method, account_id}

        if not vendor_id: return JsonResponse({"error": "Supplier is required."}, status=400)
        if not items: return JsonResponse({"error": "Items are required."}, status=400)

        with transaction.atomic():
            branch = Branch.objects.get(id=branch_id, business=biz)
            supplier = Party.objects.get(id=vendor_id, business=biz)
            
            pr = PurchaseReturn.objects.create(
                business=biz,
                branch=branch,
                supplier=supplier,
                status=status,
                tax_percent=to_dec(data.get("tax_percent", 0)),
                discount_percent=to_dec(data.get("discount_percent", 0)),
                notes=data.get("notes", ""),
                created_by=request.user,
                updated_by=request.user
            )

            for it in items:
                prod = Product.objects.get(id=it["product_id"], business=biz)
                # uom_id might be missing in some requests if simplified
                uom = None
                if it.get("uom_id"):
                    uom = UnitOfMeasure.objects.get(id=it["uom_id"])
                
                spu = to_dec(it.get("size_per_unit", "1"))
                
                PurchaseReturnItem.objects.create(
                    purchase_return=pr,
                    product=prod,
                    uom=uom,
                    quantity=to_dec(it["quantity"]),
                    unit_price=to_dec(it["price"]),
                    size_per_unit=spu
                )
                
                # If status is processed, stock OUT (return to vendor)
                if status == "processed":
                    base_qty = to_dec(it["quantity"]) * spu
                    Product.objects.filter(id=prod.id).update(stock_qty=models.F("stock_qty") - base_qty)

            pr.recompute_totals()
            pr.save()

            # Handle Refund (Receipt from Supplier)
            if refund_data:
                amt = to_dec(refund_data.get("amount", 0))
                method = refund_data.get("payment_method")
                if amt > 0 and method != "credit":
                    bank_acc = None
                    if method == "bank" and refund_data.get("bank_account_id"):
                        bank_acc = BankAccount.objects.get(id=refund_data["bank_account_id"], business=biz)
                    
                    payment = Payment.objects.create(
                        business=biz, branch=branch, party=supplier,
                        direction=Payment.IN, # Supplier giving us money
                        amount=amt,
                        payment_method=Payment.PaymentMethod.BANK if method == "bank" else Payment.PaymentMethod.CASH,
                        payment_source=Payment.BANK if method == "bank" else Payment.CASH,
                        bank_account=bank_acc,
                        description=f"Refund for Purchase Return #{pr.id}",
                        created_by=request.user, updated_by=request.user
                    )
                    pr.apply_refund(payment, amt)

            return JsonResponse({"message": "Purchase Return created.", "id": pr.id}, status=201)

    except Exception as e:
        logger.exception("Error creating Purchase Return")
        return JsonResponse({"error": str(e)}, status=500)

@require_http_methods(["GET"])
def purchase_return_detail(request, pk):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)
    try:
        staff = request.user.staff_profile
        biz = staff.business
        pr = PurchaseReturn.objects.select_related('supplier', 'branch').get(id=pk, business=biz)
    except PurchaseReturn.DoesNotExist:
        return JsonResponse({"error": "Return not found."}, status=404)
    except Exception:
        return JsonResponse({"error": "No business profile found."}, status=403)

    items = []
    for it in pr.items.select_related('product', 'uom').all():
        items.append({
            "id": it.id,
            "product_id": it.product_id,
            "product_name": it.product.name,
            "uom_id": it.uom_id,
            "uom_code": it.uom.code if it.uom else "UNT",
            "quantity": float(it.quantity),
            "unit_price": float(it.unit_price),
            "size_per_unit": float(it.size_per_unit),
            "line_total": float(it.total_cost())
        })

    # Refund details
    refunds = []
    first_refund_method = "credit"
    first_refund_bank_acc = None
    
    for app in pr.refund_applications.select_related('payment').all():
        p = app.payment
        refunds.append({
            "amount": float(app.amount),
            "method": p.get_payment_method_display(),
            "date": p.created_at.strftime("%Y-%m-%d %H:%M")
        })
        if first_refund_method == "credit":
             first_refund_method = "bank" if p.payment_method == Payment.PaymentMethod.BANK else "cash"
             first_refund_bank_acc = p.bank_account_id

    return JsonResponse({
        "id": pr.id,
        "vendor_id": pr.supplier_id,
        "vendor_name": pr.supplier.display_name,
        "branch_id": pr.branch_id,
        "branch_name": pr.branch.name if pr.branch else "Main",
        "status": pr.status,
        "total_cost": float(pr.total_cost),
        "discount_percent": float(pr.discount_percent),
        "tax_percent": float(pr.tax_percent),
        "net_total": float(pr.net_total),
        "refunded": float(pr.refunded_total),
        "balance": float(pr.refund_remaining),
        "notes": pr.notes,
        "created_at": pr.created_at.strftime("%Y-%m-%d %H:%M"),
        "items": items,
        "refund_payments": refunds,
        "payment_method": first_refund_method,
        "bank_account_id": first_refund_bank_acc
    })

@csrf_exempt
@require_http_methods(["PATCH"])
def update_purchase_return_status(request, pk):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)
    try:
        staff = request.user.staff_profile
        biz = staff.business
        pr = PurchaseReturn.objects.get(id=pk, business=biz)
        data = json.loads(request.body)
        new_status = data.get("status", "").lower()

        if new_status not in ["pending", "processed", "cancelled"]:
            return JsonResponse({"error": "Invalid status."}, status=400)

        if pr.status == new_status:
            return JsonResponse({"message": "Status already set."})

        with transaction.atomic():
            # Current effects rollback
            if pr.status == "processed":
                # Reverse stock subtraction (add it back)
                for it in pr.items.all():
                    base_qty = it.quantity * it.size_per_unit
                    Product.objects.filter(id=it.product_id).update(stock_qty=models.F("stock_qty") + base_qty)

            # Apply new status effects
            if new_status == "processed":
                # Subtract stock
                for it in pr.items.all():
                    base_qty = it.quantity * it.size_per_unit
                    Product.objects.filter(id=it.product_id).update(stock_qty=models.F("stock_qty") - base_qty)
            
            elif new_status == "cancelled":
                # Delete any associated refunds
                # refund_applications relates to PurchaseReturnRefund
                for app in pr.refund_applications.all():
                    # Deleting the payment as well to maintain ledger consistency
                    if app.payment:
                        app.payment.delete()
                    app.delete()

            pr.status = new_status
            pr.updated_by = request.user
            pr.save()

        return JsonResponse({"message": f"Status updated to {new_status}."})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

@csrf_exempt
@require_http_methods(["POST", "PATCH"])
def full_update_purchase_return(request, pk):
    """
    Full replacement edit for purchase return.
    """
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)
    try:
        staff = request.user.staff_profile
        biz = staff.business
        pr = PurchaseReturn.objects.get(id=pk, business=biz)
        data = json.loads(request.body)
    except PurchaseReturn.DoesNotExist:
        return JsonResponse({"error": "Return not found."}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

    try:
        branch_id = data.get("branch_id")
        vendor_id = data.get("vendor_id")
        items = data.get("items", [])
        payment_method = data.get("payment_method")
        bank_account_id = data.get("bank_account_id")
        amount_refunded = Decimal(str(data.get("amount_refunded", 0)))

        with transaction.atomic():
            # 1. Reverse stock if processed
            if pr.status == "processed":
                for it in pr.items.all():
                    base_qty = it.quantity * it.size_per_unit
                    Product.objects.filter(id=it.product_id).update(stock_qty=models.F("stock_qty") + base_qty)

            # 2. Update Header
            if branch_id: pr.branch = Branch.objects.get(id=branch_id, business=biz)
            if vendor_id: pr.supplier = Party.objects.get(id=vendor_id, business=biz)
            pr.discount_percent = Decimal(str(data.get("discount_percent", 0)))
            pr.tax_percent = Decimal(str(data.get("tax_percent", 0)))
            pr.notes = data.get("notes", pr.notes)
            pr.updated_by = request.user
            pr.status = "pending" # Temporary
            pr.save()

            # 3. Handle Payment
            first_refund = pr.refund_applications.select_related("payment").first()
            if first_refund and first_refund.payment:
                pay = first_refund.payment
                if payment_method == "credit" or amount_refunded <= 0:
                    pay.delete()
                else:
                    pay.amount = amount_refunded
                    pay.payment_method = Payment.PaymentMethod.BANK if payment_method == "bank" else Payment.PaymentMethod.CASH
                    pay.payment_source = Payment.BANK if payment_method == "bank" else Payment.CASH
                    pay.bank_account_id = bank_account_id if payment_method == "bank" else None
                    pay.save()
                    first_refund.amount = amount_refunded
                    first_refund.save()
            elif payment_method != "credit" and amount_refunded > 0:
                new_pay = Payment.objects.create(
                    business=biz, branch=pr.branch, party=pr.supplier,
                    direction=Payment.IN, amount=amount_refunded,
                    payment_method=Payment.PaymentMethod.BANK if payment_method == "bank" else Payment.PaymentMethod.CASH,
                    payment_source=Payment.BANK if payment_method == "bank" else Payment.CASH,
                    bank_account_id=bank_account_id if payment_method == "bank" else None,
                    description=f"Refund for Purchase Return #{pr.id} (Updated)",
                    created_by=request.user, updated_by=request.user
                )
                pr.apply_refund(new_pay, amount_refunded)

            # 4. Replace Items
            pr.items.all().delete()
            for it in items:
                prod = Product.objects.get(id=it["product_id"], business=biz)
                spu = Decimal(str(it.get("size_per_unit", "1")))
                PurchaseReturnItem.objects.create(
                    purchase_return=pr, product=prod,
                    quantity=Decimal(str(it["quantity"])),
                    unit_price=Decimal(str(it["price"])),
                    size_per_unit=spu
                )

            pr.recompute_totals()
            pr.status = "processed" # Re-process
            pr.save()

            # Add stock back (OUT)
            for it in pr.items.all():
                base_qty = it.quantity * it.size_per_unit
                Product.objects.filter(id=it.product_id).update(stock_qty=models.F("stock_qty") - base_qty)

            return JsonResponse({"success": True, "message": "Purchase Return updated.", "id": pr.id})

    except Exception as e:
        logger.exception("Error updating Purchase Return")
        return JsonResponse({"error": str(e)}, status=500)
