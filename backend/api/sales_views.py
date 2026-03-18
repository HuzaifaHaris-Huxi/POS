import json
import logging
from decimal import Decimal
from django.db import models, transaction
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from api.models import (
    SalesOrder, SalesOrderItem,
    Party, Product, Payment, UnitOfMeasure,
    BankAccount, Branch,
    SalesReturn, SalesReturnItem, SalesReturnRefund, SalesInvoice
)

logger = logging.getLogger(__name__)


# ─── Helper ─────────────────────────────────────────────────────────────────
def _get_or_create_walkin(biz, branch, user):
    """
    Return the Walk-in-Customer Party for the given branch, creating it if
    it doesn't exist yet.  Each branch gets its own walk-in customer so
    financial reports stay scoped per branch.
    """
    customer, _ = Party.objects.get_or_create(
        business=biz,
        branch=branch,
        display_name="Walk-in-Customer",
        defaults={
            "type": Party.CUSTOMER,
            "is_active": True,
            "created_by": user,
            "updated_by": user,
        },
    )
    return customer


# ─── Endpoint: Create Sales Order ───────────────────────────────────────────
@csrf_exempt
@require_http_methods(["POST"])
def create_sales_order(request):
    """
    Create a new Sales Order (POS style).
    
    Expected JSON body:
    {
        "branch_id":         <int|null>,
        "customer_id":       <int|null>,   # null → walk-in
        "payment_method":    "cash"|"bank"|"credit",
        "bank_account_id":   <int|null>,   # required when payment_method == "bank"
        "amount_received":   <number>,
        "sub_total":         <number>,
        "discount_percent":  <number>,
        "tax_percent":       <number>,
        "net_total":         <number>,
        "items": [
            {
                "product_id":     <int>,
                "uom_id":         <int|null>,
                "quantity":       <number>,
                "price":          <number>,
                "size_per_unit":  <number>   # 1 for lower unit, N for bulk
            },
            ...
        ]
    }
    """
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)

    try:
        staff = request.user.staff_profile
        biz = staff.business
    except Exception:
        return JsonResponse({"error": "No business profile found for this user."}, status=403)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON body."}, status=400)

    # ── Parse fields ──────────────────────────────────────────────────────────
    branch_id       = data.get("branch_id")
    customer_id     = data.get("customer_id")
    payment_method  = (data.get("payment_method") or "cash").lower()
    bank_account_id = data.get("bank_account_id")
    items           = data.get("items", [])

    def to_dec(v, default="0"):
        try:
            return Decimal(str(v))
        except Exception:
            return Decimal(default)

    amount_received  = to_dec(data.get("amount_received", 0))
    sub_total        = to_dec(data.get("sub_total", 0))
    discount_percent = to_dec(data.get("discount_percent", 0))
    tax_percent      = to_dec(data.get("tax_percent", 0))
    net_total        = to_dec(data.get("net_total", 0))

    if not items:
        return JsonResponse({"error": "At least one item is required."}, status=400)

    # ── Validate branch ───────────────────────────────────────────────────────
    branch = None
    if branch_id:
        try:
            branch = Branch.objects.get(id=branch_id, business=biz)
        except Branch.DoesNotExist:
            return JsonResponse({"error": "Branch not found."}, status=400)

    # ── Validate bank account (if bank payment) ───────────────────────────────
    bank_acc = None
    if payment_method == "bank":
        if not bank_account_id:
            return JsonResponse({"error": "bank_account_id is required for bank payments."}, status=400)
        try:
            bank_acc = BankAccount.objects.get(id=bank_account_id, business=biz)
        except BankAccount.DoesNotExist:
            return JsonResponse({"error": "Bank account not found."}, status=400)

    try:
        with transaction.atomic():
            # ── Resolve customer ───────────────────────────────────────────────
            customer = None
            if customer_id:
                try:
                    customer = Party.objects.get(
                        id=customer_id, business=biz,
                    )
                except Party.DoesNotExist:
                    pass

            if not customer:
                customer = _get_or_create_walkin(biz, branch, request.user)

            # ── Create Sales Order header ──────────────────────────────────────
            so = SalesOrder.objects.create(
                business=biz,
                branch=branch,
                customer=customer,
                status=SalesOrder.Status.OPEN,
                total_amount=sub_total,
                tax_percent=tax_percent,
                discount_percent=discount_percent,
                net_total=net_total,
                created_by=request.user,
                updated_by=request.user,
            )

            # ── Create line items ──────────────────────────────────────────────
            for item_data in items:
                try:
                    product = Product.objects.get(id=item_data["product_id"], business=biz)
                except Product.DoesNotExist:
                    raise ValueError(f"Product {item_data.get('product_id')} not found.")

                if item_data.get("uom_id"):
                    try:
                        uom = UnitOfMeasure.objects.get(id=item_data["uom_id"])
                    except UnitOfMeasure.DoesNotExist:
                        uom = product.uom
                else:
                    uom = product.uom

                qty            = to_dec(item_data.get("quantity", 1))
                price          = to_dec(item_data.get("price", 0))
                size_per_unit  = to_dec(item_data.get("size_per_unit", 1))

                SalesOrderItem.objects.create(
                    sales_order=so,
                    product=product,
                    uom=uom,
                    size_per_unit=size_per_unit,
                    quantity=qty,
                    unit_price=price,
                )

                # Deduct stock in base (lower) units
                base_qty = qty * size_per_unit
                Product.objects.filter(id=product.id).update(
                    stock_qty=models.F("stock_qty") - base_qty
                )

            # ── Handle payment ─────────────────────────────────────────────────
            if payment_method != "credit" and amount_received > 0:
                method_map = {"cash": Payment.PaymentMethod.CASH, "bank": Payment.PaymentMethod.BANK}
                pm = method_map.get(payment_method, Payment.PaymentMethod.CASH)

                payment = Payment.objects.create(
                    business=biz,
                    branch=branch,
                    party=customer,
                    direction=Payment.IN,
                    amount=amount_received,
                    payment_method=pm,
                    payment_source=Payment.BANK if payment_method == "bank" else Payment.CASH,
                    bank_account=bank_acc,
                    description=f"POS receipt — SO #{so.id}",
                    created_by=request.user,
                    updated_by=request.user,
                )
                so.apply_receipt(payment, amount_received)

            # Update status based on balance
            balance = so.balance_due
            if balance <= 0:
                so.status = SalesOrder.Status.FULFILLED
                so.save(update_fields=["status"])

            return JsonResponse({
                "success": True,
                "message": "Sales Order created successfully.",
                "sales_order_id": so.id,
                "balance_due": float(so.balance_due),
                "status": so.status,
            }, status=201)

    except ValueError as e:
        return JsonResponse({"error": str(e)}, status=400)
    except Exception:
        logger.exception("Error creating sales order")
        return JsonResponse({"error": "An internal error occurred."}, status=500)


# ─── Endpoint: list branches and bank accounts (helper for the POS form) ────

@require_http_methods(["GET"])
def sales_form_data(request):
    """
    Returns all data the frontend POS form needs on load:
    - branches
    - bank accounts
    """
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)
    try:
        staff = request.user.staff_profile
        biz = staff.business
    except Exception:
        return JsonResponse({"error": "No business profile found."}, status=403)

    branches = list(biz.branches.filter(is_active=True, is_deleted=False).values("id", "name", "code"))
    bank_accounts = list(
        BankAccount.objects.filter(business=biz, is_active=True)
        .values("id", "name", "bank_name", "account_number")
    )

    return JsonResponse({"branches": branches, "bank_accounts": bank_accounts})


# ─── Endpoint: List Sales Orders ─────────────────────────────────────────────

@require_http_methods(["GET"])
def list_sales_orders(request):
    """
    List sales orders with date filters and pagination.
    Query params:
        branch_id   – filter by branch
        date_from   – YYYY-MM-DD
        date_to     – YYYY-MM-DD
        quick       – today | yesterday | week | month
        page        – int (default 1)
        limit       – int (default 20)
    """
    from datetime import date as d_type, timedelta
    from django.db.models import Sum

    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)
    try:
        staff = request.user.staff_profile
        biz = staff.business
    except Exception:
        return JsonResponse({"error": "No business profile found."}, status=403)

    qs = SalesOrder.objects.filter(business=biz, is_deleted=False).select_related("customer", "branch")

    # ── branch filter ──────────────────────────────────────────────────────────
    branch_id = request.GET.get("branch_id")
    if branch_id and branch_id != "all":
        try:
            qs = qs.filter(branch_id=int(branch_id))
        except (ValueError, TypeError):
            pass

    # ── date range ─────────────────────────────────────────────────────────────
    today = d_type.today()
    quick = request.GET.get("quick", "")
    if quick == "today":
        qs = qs.filter(created_at__date=today)
    elif quick == "yesterday":
        qs = qs.filter(created_at__date=today - timedelta(days=1))
    elif quick == "week":
        qs = qs.filter(created_at__date__gte=today - timedelta(days=6))
    elif quick == "month":
        qs = qs.filter(created_at__year=today.year, created_at__month=today.month)
    else:
        date_from = request.GET.get("date_from")
        date_to   = request.GET.get("date_to")
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

    # ── pagination ─────────────────────────────────────────────────────────────
    total = qs.count()
    try:
        limit = max(1, min(int(request.GET.get("limit", 20)), 100))
        page  = max(1, int(request.GET.get("page", 1)))
    except (ValueError, TypeError):
        limit, page = 20, 1
    offset = (page - 1) * limit
    qs = qs.order_by("-created_at")[offset: offset + limit]

    def _so_dict(so):
        paid = so.paid_total
        return {
            "id": so.id,
            "created_at": so.created_at.strftime("%Y-%m-%d %H:%M"),
            "branch": so.branch.name if so.branch else "—",
            "customer": so.customer.display_name if so.customer else "Walk-in",
            "status": so.status,
            "total_amount": float(so.total_amount),
            "discount_percent": float(so.discount_percent),
            "tax_percent": float(so.tax_percent),
            "net_total": float(so.net_total),
            "paid": float(paid),
            "balance_due": float(max(Decimal("0.00"), so.net_total - paid)),
            "items_count": so.items.count(),
        }

    return JsonResponse({
        "total": total,
        "page": page,
        "limit": limit,
        "orders": [_so_dict(so) for so in qs],
    })


# ─── Endpoint: Get Single Sales Order Detail ─────────────────────────────────

@require_http_methods(["GET"])
def sales_order_detail(request, pk):
    """Return full detail of a single sales order including items."""
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)
    try:
        staff = request.user.staff_profile
        biz   = staff.business
    except Exception:
        return JsonResponse({"error": "No business profile found."}, status=403)

    try:
        so = SalesOrder.objects.select_related("customer", "branch").get(
            pk=pk, business=biz, is_deleted=False
        )
    except SalesOrder.DoesNotExist:
        return JsonResponse({"error": "Order not found."}, status=404)

    paid = so.paid_total
    items = []
    for item in so.items.select_related("product", "uom").all():
        items.append({
            "id":           item.id,
            "product_id":   item.product_id,
            "product_name": item.product.name,
            "sku":          item.product.sku or "",
            "uom_id":       item.uom_id,
            "uom_code":     item.uom.code if item.uom else "",
            "size_per_unit": float(item.size_per_unit),
            "quantity":     float(item.quantity),
            "unit_price":   float(item.unit_price),
            "line_total":   float(item.quantity * item.unit_price),
        })

    return JsonResponse({
        "id":               so.id,
        "created_at":       so.created_at.strftime("%Y-%m-%d %H:%M"),
        "branch":           so.branch.name if so.branch else "—",
        "branch_id":        so.branch_id,
        "customer":         so.customer.display_name if so.customer else "Walk-in",
        "customer_id":      so.customer_id,
        "status":           so.status,
        "total_amount":     float(so.total_amount),
        "discount_percent": float(so.discount_percent),
        "tax_percent":      float(so.tax_percent),
        "net_total":        float(so.net_total),
        "paid":             float(paid),
        "balance_due":      float(max(Decimal("0.00"), so.net_total - paid)),
        "items":            items,
    })


# ─── Endpoint: Update Sales Order Status ─────────────────────────────────────

@csrf_exempt
@require_http_methods(["PATCH"])
def update_sales_order_status(request, pk):
    """
    Update the status of a sales order.
    Body: { "status": "OPEN" | "FULFILLED" | "CANCELLED" }

    When CANCELLED:
    - Stock is reversed (qty * size_per_unit added back to product.stock_qty)
    - Order total_amount, net_total are negated to reflect reversal in reports
    """
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)
    try:
        staff = request.user.staff_profile
        biz   = staff.business
    except Exception:
        return JsonResponse({"error": "No business profile found."}, status=403)

    try:
        data       = json.loads(request.body)
        new_status = (data.get("status") or "").upper()
    except Exception:
        return JsonResponse({"error": "Invalid JSON."}, status=400)

    VALID = {SalesOrder.Status.OPEN, SalesOrder.Status.FULFILLED, SalesOrder.Status.CANCELLED}
    if new_status not in VALID:
        return JsonResponse({"error": f"Status must be one of: OPEN, FULFILLED, CANCELLED."}, status=400)

    try:
        so = SalesOrder.objects.select_related("branch").get(
            pk=pk, business=biz, is_deleted=False
        )
    except SalesOrder.DoesNotExist:
        return JsonResponse({"error": "Order not found."}, status=404)

    old_status = so.status

    try:
        with transaction.atomic():
            # ── Cancellation: reverse stock and negate totals ──────────────────
            if new_status == SalesOrder.Status.CANCELLED and old_status != SalesOrder.Status.CANCELLED:
                for item in so.items.select_related("product").all():
                    base_qty = item.quantity * item.size_per_unit
                    Product.objects.filter(id=item.product_id).update(
                        stock_qty=models.F("stock_qty") + base_qty
                    )
                # Negate totals so this order subtracts from aggregates
                so.total_amount = -abs(so.total_amount)
                so.net_total    = -abs(so.net_total)

            # ── Un-cancel: restore totals (make positive again) ────────────────
            elif old_status == SalesOrder.Status.CANCELLED and new_status != SalesOrder.Status.CANCELLED:
                for item in so.items.select_related("product").all():
                    base_qty = item.quantity * item.size_per_unit
                    Product.objects.filter(id=item.product_id).update(
                        stock_qty=models.F("stock_qty") - base_qty
                    )
                so.total_amount = abs(so.total_amount)
                so.net_total    = abs(so.net_total)

            so.status     = new_status
            so.updated_by = request.user
            so.save(update_fields=["status", "total_amount", "net_total", "updated_by", "updated_at"])

        return JsonResponse({
            "success": True,
            "message": f"Order #{so.id} status updated to {new_status}.",
            "status":  so.status,
        })
    except Exception:
        logger.exception("Error updating sales order status")
        return JsonResponse({"error": "An internal error occurred."}, status=500)


# ─── Endpoint: Edit / Update existing Sales Order ────────────────────────────

@csrf_exempt
@require_http_methods(["PATCH"])
def update_sales_order(request, pk):
    """
    Edit an existing sales order.
    Supports two operations in one call (both optional):

    Body:
    {
        "new_items": [                     # optional: additional line items to append
            {
                "product_id":    <int>,
                "uom_id":        <int|null>,
                "quantity":      <number>,
                "price":         <number>,
                "size_per_unit": <number>   # 1 = lower, N = bulk
            }
        ],
        "deposit": {                       # optional: new payment against this order
            "amount":          <number>,
            "payment_method":  "cash"|"bank"|"credit",
            "bank_account_id": <int|null>
        },
        "discount_percent": <number>,      # optional: override discount
        "tax_percent":      <number>       # optional: override tax
    }
    """
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)
    try:
        staff = request.user.staff_profile
        biz   = staff.business
    except Exception:
        return JsonResponse({"error": "No business profile found."}, status=403)

    try:
        data = json.loads(request.body)
    except Exception:
        return JsonResponse({"error": "Invalid JSON."}, status=400)

    try:
        so = SalesOrder.objects.select_related("branch", "customer").get(
            pk=pk, business=biz, is_deleted=False
        )
    except SalesOrder.DoesNotExist:
        return JsonResponse({"error": "Order not found."}, status=404)

    if so.status == SalesOrder.Status.CANCELLED:
        return JsonResponse({"error": "Cannot edit a cancelled order."}, status=400)

    def to_dec(v, default="0"):
        try:    return Decimal(str(v))
        except: return Decimal(default)

    new_items        = data.get("new_items", [])
    deposit_data     = data.get("deposit")
    discount_percent = data.get("discount_percent")
    tax_percent      = data.get("tax_percent")

    try:
        with transaction.atomic():

            # ── 1. Add new line items ─────────────────────────────────────────
            for item_data in new_items:
                try:
                    product = Product.objects.get(id=item_data["product_id"], business=biz)
                except Product.DoesNotExist:
                    raise ValueError(f"Product {item_data.get('product_id')} not found.")

                if item_data.get("uom_id"):
                    try:
                        uom = UnitOfMeasure.objects.get(id=item_data["uom_id"])
                    except UnitOfMeasure.DoesNotExist:
                        uom = product.uom
                else:
                    uom = product.uom

                qty           = to_dec(item_data.get("quantity", 1))
                price         = to_dec(item_data.get("price", 0))
                size_per_unit = to_dec(item_data.get("size_per_unit", 1))

                SalesOrderItem.objects.create(
                    sales_order=so,
                    product=product,
                    uom=uom,
                    size_per_unit=size_per_unit,
                    quantity=qty,
                    unit_price=price,
                )

                # Deduct stock
                base_qty = qty * size_per_unit
                Product.objects.filter(id=product.id).update(
                    stock_qty=models.F("stock_qty") - base_qty
                )

            # ── 2. Recalculate totals from all items ──────────────────────────
            all_items   = so.items.all()
            sub_total   = sum(i.quantity * i.unit_price for i in all_items)

            if discount_percent is not None:
                so.discount_percent = to_dec(discount_percent)
            if tax_percent is not None:
                so.tax_percent = to_dec(tax_percent)

            disc_amt  = sub_total * so.discount_percent / Decimal("100")
            tax_amt   = (sub_total - disc_amt) * so.tax_percent / Decimal("100")
            net_total = sub_total - disc_amt + tax_amt

            so.total_amount = sub_total
            so.net_total    = net_total
            so.updated_by   = request.user

            # ── 3. Record deposit / payment ───────────────────────────────────
            if deposit_data:
                dep_amount    = to_dec(deposit_data.get("amount", 0))
                dep_method    = (deposit_data.get("payment_method") or "cash").lower()
                bank_acc_id   = deposit_data.get("bank_account_id")

                if dep_amount > 0 and dep_method != "credit":
                    method_map = {
                        "cash": Payment.PaymentMethod.CASH,
                        "bank": Payment.PaymentMethod.BANK
                    }
                    pm = method_map.get(dep_method, Payment.PaymentMethod.CASH)

                    bank_acc = None
                    if dep_method == "bank":
                        if not bank_acc_id:
                            raise ValueError("bank_account_id required for bank deposit.")
                        bank_acc = BankAccount.objects.get(id=bank_acc_id, business=biz)

                    payment = Payment.objects.create(
                        business=biz,
                        branch=so.branch,
                        party=so.customer,
                        direction=Payment.IN,
                        amount=dep_amount,
                        payment_method=pm,
                        payment_source=Payment.BANK if dep_method == "bank" else Payment.CASH,
                        bank_account=bank_acc,
                        description=f"Deposit against SO #{so.id}",
                        created_by=request.user,
                        updated_by=request.user,
                    )
                    so.apply_receipt(payment, dep_amount)

            # ── 4. Update status based on new balance ─────────────────────────
            so.save()   # persist changes first
            balance = so.balance_due
            if balance <= 0 and so.status == SalesOrder.Status.OPEN:
                so.status = SalesOrder.Status.FULFILLED
                so.save(update_fields=["status"])

        # Fresh totals
        paid = so.paid_total
        return JsonResponse({
            "success":         True,
            "message":         f"Order #{so.id} updated.",
            "sales_order_id":  so.id,
            "net_total":       float(so.net_total),
            "paid":            float(paid),
            "balance_due":     float(max(Decimal("0.00"), so.net_total - paid)),
            "status":          so.status,
        })

    except ValueError as e:
        return JsonResponse({"error": str(e)}, status=400)
    except Exception:
        logger.exception("Error updating sales order")
        return JsonResponse({"error": "An internal error occurred."}, status=500)


# ─── Endpoint: Full Replace / Edit Sales Order (for the edit page) ────────────

@csrf_exempt
@require_http_methods(["PUT"])
def full_update_sales_order(request, pk):
    """
    Full-replace edit of an existing sales order.
    Called from the Edit Sale Order page after the user has amended all fields.

    Steps:
      1. Reverse stock for every existing item
      2. Delete all existing SalesOrderItems
      3. Re-create items from the submitted list (deduct stock)
      4. Update order header (customer, discount, tax, totals)
      5. Optionally record an additional payment (new deposit)

    Body: same shape as create_sales_order, plus optional "deposit" block.
    """
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)
    try:
        staff = request.user.staff_profile
        biz   = staff.business
    except Exception:
        return JsonResponse({"error": "No business profile found."}, status=403)

    try:
        data = json.loads(request.body)
    except Exception:
        return JsonResponse({"error": "Invalid JSON."}, status=400)

    try:
        so = SalesOrder.objects.select_related("branch", "customer").get(
            pk=pk, business=biz, is_deleted=False
        )
    except SalesOrder.DoesNotExist:
        return JsonResponse({"error": "Order not found."}, status=404)

    if so.status == SalesOrder.Status.CANCELLED:
        return JsonResponse({"error": "Cannot edit a cancelled order."}, status=400)

    def to_dec(v, default="0"):
        try:    return Decimal(str(v))
        except: return Decimal(default)

    branch_id        = data.get("branch_id")
    customer_id      = data.get("customer_id")
    items_data       = data.get("items", [])
    deposit_data     = data.get("deposit")
    discount_percent = to_dec(data.get("discount_percent", so.discount_percent))
    tax_percent      = to_dec(data.get("tax_percent",      so.tax_percent))
    payment_method   = (data.get("payment_method") or "cash").lower()
    bank_account_id  = data.get("bank_account_id")

    if not items_data:
        return JsonResponse({"error": "At least one item is required."}, status=400)

    try:
        with transaction.atomic():

            # ── 1. Reverse stock for existing items ────────────────────────────
            for old_item in so.items.select_related("product").all():
                base_qty = old_item.quantity * old_item.size_per_unit
                Product.objects.filter(id=old_item.product_id).update(
                    stock_qty=models.F("stock_qty") + base_qty
                )
            so.items.all().delete()

            # ── 2. Resolve branch ──────────────────────────────────────────────
            branch = so.branch
            if branch_id:
                try:
                    branch = Branch.objects.get(id=branch_id, business=biz)
                    so.branch = branch
                except Branch.DoesNotExist:
                    pass

            # ── 3. Resolve customer ────────────────────────────────────────────
            customer = so.customer
            if customer_id:
                try:
                    customer = Party.objects.get(
                        id=customer_id, business=biz,
                        type__in=[Party.CUSTOMER, Party.BOTH],
                    )
                except Party.DoesNotExist:
                    pass
            if not customer:
                customer = _get_or_create_walkin(biz, branch, request.user)
            so.customer = customer

            # ── 4. Re-create line items ────────────────────────────────────────
            sub_total = Decimal("0.00")
            for item_data in items_data:
                try:
                    product = Product.objects.get(id=item_data["product_id"], business=biz)
                except Product.DoesNotExist:
                    raise ValueError(f"Product {item_data.get('product_id')} not found.")

                if item_data.get("uom_id"):
                    try:
                        uom = UnitOfMeasure.objects.get(id=item_data["uom_id"])
                    except UnitOfMeasure.DoesNotExist:
                        uom = product.uom
                else:
                    uom = product.uom

                qty           = to_dec(item_data.get("quantity", 1))
                price         = to_dec(item_data.get("price", 0))
                size_per_unit = to_dec(item_data.get("size_per_unit", 1))

                SalesOrderItem.objects.create(
                    sales_order=so, product=product, uom=uom,
                    size_per_unit=size_per_unit, quantity=qty, unit_price=price,
                )
                # Deduct stock
                Product.objects.filter(id=product.id).update(
                    stock_qty=models.F("stock_qty") - (qty * size_per_unit)
                )
                sub_total += qty * price

            # ── 5. Recalculate totals ──────────────────────────────────────────
            disc_amt  = sub_total * discount_percent / Decimal("100")
            tax_amt   = (sub_total - disc_amt) * tax_percent / Decimal("100")
            net_total = sub_total - disc_amt + tax_amt

            so.total_amount      = sub_total
            so.discount_percent  = discount_percent
            so.tax_percent       = tax_percent
            so.net_total         = net_total
            so.updated_by        = request.user

            # ── 6. Optional new deposit ────────────────────────────────────────
            if deposit_data:
                dep_amount  = to_dec(deposit_data.get("amount", 0))
                dep_method  = (deposit_data.get("payment_method") or "cash").lower()
                bank_acc_id = deposit_data.get("bank_account_id")

                if dep_amount > 0 and dep_method != "credit":
                    method_map = {"cash": Payment.PaymentMethod.CASH, "bank": Payment.PaymentMethod.BANK}
                    pm = method_map.get(dep_method, Payment.PaymentMethod.CASH)
                    bank_acc = None
                    if dep_method == "bank":
                        if not bank_acc_id:
                            raise ValueError("bank_account_id required for bank deposit.")
                        bank_acc = BankAccount.objects.get(id=bank_acc_id, business=biz)

                    payment = Payment.objects.create(
                        business=biz, branch=branch, party=customer,
                        direction=Payment.IN, amount=dep_amount,
                        payment_method=pm,
                        payment_source=Payment.BANK if dep_method == "bank" else Payment.CASH,
                        bank_account=bank_acc,
                        description=f"Payment on edit — SO #{so.id}",
                        created_by=request.user, updated_by=request.user,
                    )
                    so.apply_receipt(payment, dep_amount)

            so.save()

            # ── 7. Update status ───────────────────────────────────────────────
            balance = so.balance_due
            if balance <= 0 and so.status != SalesOrder.Status.FULFILLED:
                so.status = SalesOrder.Status.FULFILLED
                so.save(update_fields=["status"])
            elif balance > 0 and so.status == SalesOrder.Status.FULFILLED:
                so.status = SalesOrder.Status.OPEN
                so.save(update_fields=["status"])

        paid = so.paid_total
        return JsonResponse({
            "success":        True,
            "message":        f"Order #{so.id} updated successfully.",
            "sales_order_id": so.id,
            "net_total":      float(so.net_total),
            "paid":           float(paid),
            "balance_due":    float(max(Decimal("0.00"), so.net_total - paid)),
            "status":         so.status,
        })

    except ValueError as e:
        return JsonResponse({"error": str(e)}, status=400)
    except Exception:
        logger.exception("Error in full_update_sales_order")
        return JsonResponse({"error": "An internal error occurred."}, status=500)
# ─── Sales Returns ────────────────────────────────────────────────────────────

@require_http_methods(["GET"])
def list_sales_returns(request):
    """
    List sales returns with date filters and pagination.
    """
    from datetime import date as d_type, timedelta
    from django.db.models import Sum

    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)
    try:
        staff = request.user.staff_profile
        biz = staff.business
    except Exception:
        return JsonResponse({"error": "No business profile found."}, status=403)

    qs = SalesReturn.objects.filter(business=biz).select_related("customer", "branch")

    # ── branch filter ──────────────────────────────────────────────────────────
    branch_id = request.GET.get("branch_id")
    if branch_id and branch_id != "all":
        try:
            qs = qs.filter(branch_id=int(branch_id))
        except (ValueError, TypeError):
            pass

    # ── date range ─────────────────────────────────────────────────────────────
    today = d_type.today()
    quick = request.GET.get("quick", "")
    if quick == "today":
        qs = qs.filter(created_at__date=today)
    elif quick == "yesterday":
        qs = qs.filter(created_at__date=today - timedelta(days=1))
    elif quick == "week":
        qs = qs.filter(created_at__date__gte=today - timedelta(days=6))
    elif quick == "month":
        qs = qs.filter(created_at__year=today.year, created_at__month=today.month)
    else:
        date_from = request.GET.get("date_from")
        date_to   = request.GET.get("date_to")
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

    # ── pagination ─────────────────────────────────────────────────────────────
    total = qs.count()
    try:
        limit = max(1, min(int(request.GET.get("limit", 20)), 100))
        page  = max(1, int(request.GET.get("page", 1)))
    except (ValueError, TypeError):
        limit, page = 20, 1
    offset = (page - 1) * limit
    qs = qs.order_by("-created_at")[offset: offset + limit]

    def _sr_dict(sr):
        return {
            "id": sr.id,
            "created_at": sr.created_at.strftime("%Y-%m-%d %H:%M"),
            "branch": sr.branch.name if sr.branch else "—",
            "customer": sr.customer.display_name if sr.customer else (sr.customer_name or "Walk-in"),
            "status": sr.status,
            "total_amount": float(sr.total_amount),
            "discount_percent": float(sr.discount_percent),
            "tax_percent": float(sr.tax_percent),
            "net_total": float(sr.net_total),
            "refunded": float(sr.refunded_total),
            "balance_remaining": float(sr.refund_remaining),
            "items_count": sr.items.count(),
        }

    return JsonResponse({
        "total": total,
        "page": page,
        "limit": limit,
        "returns": [_sr_dict(sr) for sr in qs],
    })


@csrf_exempt
@require_http_methods(["POST"])
def create_sales_return(request):
    """
    Create a new Sales Return.
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
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON body."}, status=400)

    branch_id       = data.get("branch_id")
    customer_id     = data.get("customer_id")
    source_order_id = data.get("source_order_id")
    payment_method  = (data.get("payment_method") or "cash").lower()
    bank_account_id = data.get("bank_account_id")
    items           = data.get("items", [])

    def to_dec(v, default="0"):
        try:    return Decimal(str(v or default))
        except: return Decimal(default)

    amount_refunded  = to_dec(data.get("amount_refunded", 0))
    discount_percent = to_dec(data.get("discount_percent", 0))
    tax_percent      = to_dec(data.get("tax_percent", 0))

    if not items:
        return JsonResponse({"error": "At least one item is required."}, status=400)

    try:
        with transaction.atomic():
            branch = None
            if branch_id:
                branch = Branch.objects.get(id=branch_id, business=biz)
            
            customer = None
            if customer_id:
                customer = Party.objects.get(id=customer_id, business=biz)
            
            source_order = None
            if source_order_id:
                source_order = SalesOrder.objects.get(id=source_order_id, business=biz)

            # Create Header
            sr = SalesReturn.objects.create(
                business=biz,
                branch=branch,
                customer=customer,
                source_order=source_order,
                status=SalesReturn.Status.PROCESSED, # Trigger stock movement in save()
                discount_percent=discount_percent,
                tax_percent=tax_percent,
                notes=data.get("notes", ""),
                created_by=request.user,
                updated_by=request.user
            )

            # Create Items
            for it in items:
                try:
                    product = Product.objects.get(id=it["product_id"], business=biz)
                except Product.DoesNotExist:
                    raise ValueError(f"Product {it.get('product_id')} not found.")

                SalesReturnItem.objects.create(
                    sales_return=sr,
                    product=product,
                    quantity=to_dec(it["quantity"]),
                    unit_price=to_dec(it["price"])
                )

            sr.recompute_totals()
            sr.save()

            # Handle Refund Payment (Direction: OUT)
            if amount_refunded > 0 and payment_method != "credit":
                bank_acc = None
                if payment_method == "bank":
                    if not bank_account_id:
                        raise ValueError("bank_account_id is required for bank refunds.")
                    bank_acc = BankAccount.objects.get(id=bank_account_id, business=biz)
                
                payment = Payment.objects.create(
                    business=biz,
                    branch=branch,
                    party=customer,
                    direction=Payment.OUT,
                    amount=amount_refunded,
                    payment_method=Payment.PaymentMethod.BANK if payment_method == "bank" else Payment.PaymentMethod.CASH,
                    payment_source=Payment.BANK if payment_method == "bank" else Payment.CASH,
                    bank_account=bank_acc,
                    description=f"Refund for Sales Return #{sr.id}",
                    created_by=request.user,
                    updated_by=request.user
                )
                sr.apply_refund(payment, amount_refunded)

            return JsonResponse({
                "success": True,
                "message": "Sales Return created successfully.",
                "sales_return_id": sr.id,
                "net_total": float(sr.net_total),
                "refunded": float(sr.refunded_total),
            }, status=201)

    except ValueError as e:
        return JsonResponse({"error": str(e)}, status=400)
    except Exception:
        logger.exception("Error creating sales return")
        return JsonResponse({"error": "An internal error occurred."}, status=500)


@require_http_methods(["GET"])
def sales_return_detail(request, pk):
    """
    Return full detail of a single sales return.
    """
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)
    try:
        staff = request.user.staff_profile
        biz = staff.business
    except Exception:
        return JsonResponse({"error": "No business profile found."}, status=403)

    try:
        sr = SalesReturn.objects.select_related("customer", "branch").get(
            pk=pk, business=biz
        )
    except SalesReturn.DoesNotExist:
        return JsonResponse({"error": "Return not found."}, status=404)

    items = []
    for it in sr.items.select_related("product").all():
        items.append({
            "id":           it.id,
            "product_id":   it.product_id,
            "product_name": it.product.name,
            "quantity":     float(it.quantity),
            "unit_price":   float(it.unit_price),
            "line_total":   float(it.line_total()),
        })

    res = {
        "id":                sr.id,
        "created_at":        sr.created_at.strftime("%Y-%m-%d %H:%M"),
        "customer":          sr.customer.display_name if sr.customer else (sr.customer_name or "Walk-in"),
        "customer_id":       sr.customer_id,
        "branch":            sr.branch.name if sr.branch else "—",
        "branch_id":         sr.branch_id,
        "status":            sr.status,
        "total_amount":      float(sr.total_amount),
        "discount_percent":  float(sr.discount_percent),
        "tax_percent":       float(sr.tax_percent),
        "net_total":         float(sr.net_total),
        "refunded":          float(sr.refunded_total),
        "balance_remaining": float(sr.refund_remaining),
        "items":             items,
        "notes":             sr.notes,
        "payment_method":    None,
        "bank_account_id":   None,
        "amount_refunded":   float(sr.refunded_total),
    }

    # Try to find the primary refund payment
    first_refund = sr.refund_applications.select_related("payment").first()
    if first_refund and first_refund.payment:
        p = first_refund.payment
        res["payment_method"] = "bank" if p.payment_method == Payment.PaymentMethod.BANK else "cash"
        res["bank_account_id"] = p.bank_account_id
    elif sr.refunded_total == 0:
        res["payment_method"] = "credit"

    return JsonResponse(res)


@csrf_exempt
@require_http_methods(["PATCH"])
def update_sales_return_status(request, pk):
    """
    Update status of a sales return.
    """
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)
    try:
        biz = request.user.staff_profile.business
        sr = SalesReturn.objects.get(pk=pk, business=biz)
        data = json.loads(request.body)
        new_status = (data.get("status") or "").lower()
        
        if new_status not in [SalesReturn.Status.PENDING, SalesReturn.Status.PROCESSED, SalesReturn.Status.CANCELLED]:
            return JsonResponse({"error": f"Invalid status. Must be one of: {SalesReturn.Status.PENDING}, {SalesReturn.Status.PROCESSED}, {SalesReturn.Status.CANCELLED}"}, status=400)
        
        old_status = sr.status
        with transaction.atomic():
            # Cancellation logic: Reverse stock if moving from Processed to Cancelled
            if old_status == SalesReturn.Status.PROCESSED and new_status == SalesReturn.Status.CANCELLED:
                for item in sr.items.all():
                    Product.objects.filter(id=item.product_id).update(stock_qty=F("stock_qty") - item.quantity)
            
            # Re-process logic: If moving from Cancelled/Pending to Processed
            elif old_status != SalesReturn.Status.PROCESSED and new_status == SalesReturn.Status.PROCESSED:
                for item in sr.items.all():
                    Product.objects.filter(id=item.product_id).update(stock_qty=F("stock_qty") + item.quantity)

            sr.status = new_status
            sr.updated_by = request.user
            sr.save()

        return JsonResponse({
            "success": True, 
            "message": f"Return #{sr.id} status updated to {new_status}.",
            "status": sr.status
        })
    except SalesReturn.DoesNotExist:
        return JsonResponse({"error": "Return not found."}, status=404)
    except Exception:
        logger.exception("Error updating sales return status")
        return JsonResponse({"error": "An internal error occurred."}, status=500)

@csrf_exempt
@require_http_methods(["POST", "PATCH"])
def full_update_sales_return(request, pk):
    """
    Full replacement/edit of a sales return.
    Reverses old stock, deletes old items, and recreates everything.
    """
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)

    try:
        staff = request.user.staff_profile
        biz = staff.business
    except Exception:
        return JsonResponse({"error": "No business profile found."}, status=403)

    try:
        sr = SalesReturn.objects.get(pk=pk, business=biz)
    except SalesReturn.DoesNotExist:
        return JsonResponse({"error": "Return not found."}, status=404)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON body."}, status=400)

    items           = data.get("items", [])
    branch_id       = data.get("branch_id")
    customer_id     = data.get("customer_id")
    payment_method   = data.get("payment_method")
    bank_account_id  = data.get("bank_account_id")
    amount_refunded  = Decimal(str(data.get("amount_refunded", 0)))
    
    def to_dec(v, default="0"):
        try:    return Decimal(str(v or default))
        except: return Decimal(default)

    discount_percent = to_dec(data.get("discount_percent", 0))
    tax_percent      = to_dec(data.get("tax_percent", 0))

    try:
        with transaction.atomic():
            # 1. Reverse stock if was processed
            if sr.status == SalesReturn.Status.PROCESSED:
                for it in sr.items.all():
                    Product.objects.filter(id=it.product_id).update(stock_qty=F("stock_qty") - it.quantity)

            # 2. Update Header
            if branch_id:
                sr.branch = Branch.objects.get(id=branch_id, business=biz)
            if customer_id:
                sr.customer = Party.objects.get(id=customer_id, business=biz)
            
            sr.discount_percent = discount_percent
            sr.tax_percent      = tax_percent
            sr.notes            = data.get("notes", sr.notes)
            sr.updated_by       = request.user

            # 2.5 Update/Handle Payment
            # For simplicity, we'll try to update the FIRST linked payment if it exists, 
            # or create a new one if method is not credit and amount > 0.
            
            first_refund = sr.refund_applications.select_related("payment").first()
            if first_refund and first_refund.payment:
                pay = first_refund.payment
                if payment_method == "credit" or amount_refunded <= 0:
                    # If changed to credit, delete the payment? 
                    # Usually better to set amount to 0 or delete. Let's delete for now as it's a full replace.
                    pay.delete() 
                else:
                    pay.amount = amount_refunded
                    pay.payment_method = Payment.PaymentMethod.BANK if payment_method == "bank" else Payment.PaymentMethod.CASH
                    pay.payment_source = Payment.BANK if payment_method == "bank" else Payment.CASH
                    if payment_method == "bank" and bank_account_id:
                        pay.bank_account_id = bank_account_id
                    else:
                        pay.bank_account = None
                    pay.updated_by = request.user
                    pay.save()
                    first_refund.amount = amount_refunded
                    first_refund.save()
            elif payment_method != "credit" and amount_refunded > 0:
                # Create brand new payment
                bank_acc = None
                if payment_method == "bank" and bank_account_id:
                    bank_acc = BankAccount.objects.get(id=bank_account_id, business=biz)
                
                new_pay = Payment.objects.create(
                    business=biz, branch=sr.branch, party=sr.customer,
                    direction=Payment.OUT, amount=amount_refunded,
                    payment_method=Payment.PaymentMethod.BANK if payment_method == "bank" else Payment.PaymentMethod.CASH,
                    payment_source=Payment.BANK if payment_method == "bank" else Payment.CASH,
                    bank_account=bank_acc,
                    description=f"Refund for Sales Return #{sr.id} (Updated)",
                    created_by=request.user, updated_by=request.user
                )
                sr.apply_refund(new_pay, amount_refunded)
            
            # Temporarily set to pending
            sr.status = SalesReturn.Status.PENDING 
            sr.save()

            # 3. Replace Items
            sr.items.all().delete()
            for it in items:
                product = Product.objects.get(id=it["product_id"], business=biz)
                SalesReturnItem.objects.create(
                    sales_return=sr,
                    product=product,
                    quantity=to_dec(it["quantity"]),
                    unit_price=to_dec(it["price"])
                )

            sr.recompute_totals()
            
            # 4. Restore to Processed
            sr.status = SalesReturn.Status.PROCESSED
            sr.save() 
            
            # Add stock back
            for it in sr.items.all():
                Product.objects.filter(id=it.product_id).update(stock_qty=F("stock_qty") + it.quantity)

            return JsonResponse({
                "success": True,
                "message": "Sales Return updated successfully.",
                "id": sr.id,
                "net_total": float(sr.net_total),
            })

    except Exception as e:
        logger.exception("Error updating sales return")
        return JsonResponse({"error": str(e)}, status=500)
