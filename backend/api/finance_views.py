import json
from decimal import Decimal
from django.http import JsonResponse
from django.db import models, transaction
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from api.models import (
    BankAccount, CashFlow, Branch, Business, Party,
    SalesOrder, SalesInvoice, SalesReturn, PurchaseOrder, PurchaseReturn, Payment
)

def to_dec(v, default="0"):
    try:
        return Decimal(str(v))
    except Exception:
        return Decimal(default)

# ─── Bank Account List ────────────────────────────────────────────────────────
@require_http_methods(["GET"])
def list_bank_accounts(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)
    
    try:
        staff = request.user.staff_profile
        biz = staff.business
    except Exception:
        return JsonResponse({"error": "No business profile found."}, status=403)

    accounts = BankAccount.objects.filter(business=biz, is_active=True).select_related('branch')
    
    # Filter by branch if provided
    branch_id = request.GET.get('branch_id')
    if branch_id and branch_id != 'all':
        accounts = accounts.filter(branch_id=branch_id)

    data = []
    for acc in accounts:
        data.append({
            "id": acc.id,
            "name": acc.name,
            "bank_name": acc.bank_name,
            "account_number": acc.account_number,
            "branch_id": acc.branch_id,
            "branch_name": acc.branch.name if acc.branch else "Main",
            "account_type": acc.account_type,
            "opening_balance": float(acc.opening_balance),
            "current_balance": float(acc.current_balance),
            "is_active": acc.is_active
        })

    return JsonResponse({"accounts": data})

# ─── Create Bank Account ──────────────────────────────────────────────────────
@csrf_exempt
@require_http_methods(["POST"])
def create_bank_account(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)

    try:
        staff = request.user.staff_profile
        biz = staff.business
    except Exception:
        return JsonResponse({"error": "No business profile found."}, status=403)

    try:
        data = json.loads(request.body)
        name = data.get("name")
        bank_name = data.get("bank_name", "")
        account_number = data.get("account_number", "")
        branch_id = data.get("branch_id")
        opening_balance = to_dec(data.get("opening_balance", 0))
        account_type = data.get("account_type", BankAccount.BANK)

        if not name:
            return JsonResponse({"error": "Account name is required."}, status=400)
        
        # Branch is mandatory as per user request
        if not branch_id:
            return JsonResponse({"error": "Branch association is required."}, status=400)

        branch = Branch.objects.get(id=branch_id, business=biz)

        acc = BankAccount.objects.create(
            business=biz,
            branch=branch,
            name=name,
            bank_name=bank_name,
            account_number=account_number,
            opening_balance=opening_balance,
            account_type=account_type,
            created_by=request.user,
            updated_by=request.user
        )

        return JsonResponse({
            "message": "Bank account created.",
            "id": acc.id
        }, status=201)

    except Branch.DoesNotExist:
        return JsonResponse({"error": "Invalid branch selected."}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

# ─── Account Ledger ──────────────────────────────────────────────────────────
@require_http_methods(["GET"])
def account_ledger(request, pk):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)

    try:
        staff = request.user.staff_profile
        biz = staff.business
        account = BankAccount.objects.get(id=pk, business=biz)
    except BankAccount.DoesNotExist:
        return JsonResponse({"error": "Account not found."}, status=404)
    except Exception:
        return JsonResponse({"error": "No business profile found."}, status=403)

    flows = CashFlow.objects.filter(bank_account=account).order_by('-date', '-id')

    # Date Filtering
    from_date = request.GET.get('from_date')
    to_date = request.GET.get('to_date')
    if from_date:
        flows = flows.filter(date__gte=from_date)
    if to_date:
        flows = flows.filter(date__lte=to_date)

    # Calculate running balance (this is tricky with pagination, so we'll do it for the full set or current set)
    # For now, let's return the transactions.
    
    transactions = []
    for f in flows:
        transactions.append({
            "id": f.id,
            "date": f.date.strftime("%Y-%m-%d"),
            "flow_type": f.flow_type,
            "amount": float(f.amount),
            "description": f.description,
            "branch_name": f.branch.name if f.branch else "Main",
        })

    return JsonResponse({
        "account_name": account.name,
        "bank_name": account.bank_name,
        "opening_balance": float(account.opening_balance),
        "current_balance": float(account.current_balance),
        "transactions": transactions
    })

# ─── Get Single Account ──────────────────────────────────────────────────────
@require_http_methods(["GET"])
def get_bank_account(request, pk):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)
    
    try:
        staff = request.user.staff_profile
        biz = staff.business
        acc = BankAccount.objects.get(id=pk, business=biz)
        return JsonResponse({
            "id": acc.id,
            "name": acc.name,
            "bank_name": acc.bank_name,
            "account_number": acc.account_number,
            "branch_id": acc.branch_id,
            "account_type": acc.account_type,
            "opening_balance": float(acc.opening_balance),
            "current_balance": float(acc.current_balance),
            "is_active": acc.is_active
        })
    except BankAccount.DoesNotExist:
        return JsonResponse({"error": "Account not found."}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

# ─── Update Bank Account ──────────────────────────────────────────────────────
@csrf_exempt
@require_http_methods(["POST", "PUT"])
def update_bank_account(request, pk):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)

    try:
        staff = request.user.staff_profile
        biz = staff.business
        acc = BankAccount.objects.get(id=pk, business=biz)
        
        data = json.loads(request.body)
        acc.name = data.get("name", acc.name)
        acc.bank_name = data.get("bank_name", acc.bank_name)
        acc.account_number = data.get("account_number", acc.account_number)
        
        branch_id = data.get("branch_id")
        if branch_id:
            acc.branch = Branch.objects.get(id=branch_id, business=biz)
            
        acc.account_type = data.get("account_type", acc.account_type)
        acc.opening_balance = to_dec(data.get("opening_balance", acc.opening_balance))
        acc.is_active = data.get("is_active", acc.is_active)
        acc.updated_by = request.user
        acc.save()

        return JsonResponse({"message": "Account updated successfully."})

    except BankAccount.DoesNotExist:
        return JsonResponse({"error": "Account not found."}, status=404)
    except Branch.DoesNotExist:
        return JsonResponse({"error": "Invalid branch selected."}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

# ─── Party Ledger List ────────────────────────────────────────────────────────
@require_http_methods(["GET"])
def list_parties_ledger(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)
    
    try:
        if hasattr(request.user, 'staff_profile'):
            biz = request.user.staff_profile.business
        elif request.user.is_superuser:
            # For superusers without profiles, let's try to infer business from existing data or query param
            # For now, pick first one if none selected
            biz = Business.objects.first()
        else:
            return JsonResponse({"error": "No business profile found."}, status=403)
    except Exception as e:
        return JsonResponse({"error": f"Business lookup failed: {str(e)}"}, status=403)

    pt = request.GET.get('type', '').lower()
    print(f"DEBUG: list_parties_ledger type={pt}")
    branch_id = request.GET.get('branch_id')
    search = request.GET.get('search', '').strip()

    parties = Party.objects.filter(business=biz, is_active=True).select_related('branch')
    
    if pt == 'customer':
        parties = parties.filter(type__in=[Party.CUSTOMER, Party.BOTH])
    elif pt == 'vendor':
        parties = parties.filter(type__in=[Party.VENDOR, Party.BOTH])
    elif pt == 'all':
        pass # Show all types
    else:
        # If no type or invalid type, don't return everything unless it's a search
        if not search:
             # Default to CUSTOMER if nothing specified to avoid "empty screen"
             parties = parties.filter(type__in=[Party.CUSTOMER, Party.BOTH])
    
    if branch_id and branch_id != 'all':
        parties = parties.filter(branch_id=branch_id)
    
    if search:
        parties = parties.filter(
            models.Q(display_name__icontains=search) | 
            models.Q(phone__icontains=search)
        )

    data = []
    for p in parties:
        data.append({
            "id": p.id,
            "display_name": p.display_name,
            "phone": p.phone,
            "type": p.type,
            "branch_name": p.branch.name if p.branch else "Main",
            "cached_balance": float(p.cached_balance)
        })

    return JsonResponse({"parties": data})

# ─── Party Ledger Detail ──────────────────────────────────────────────────────
@require_http_methods(["GET"])
def get_party_ledger(request, pk):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)
    
    try:
        if hasattr(request.user, 'staff_profile'):
            biz = request.user.staff_profile.business
            party = Party.objects.get(id=pk, business=biz)
        elif request.user.is_superuser:
            # Superuser can see any party
            party = Party.objects.get(id=pk)
            biz = party.business
        else:
            return JsonResponse({"error": "No business profile found."}, status=403)
    except Party.DoesNotExist:
        return JsonResponse({"error": f"Party #{pk} not found or mismatch in business scope."}, status=404)
    except Exception as e:
        return JsonResponse({"error": f"Ledger access failure: {str(e)}"}, status=500)

    transactions = []

    # Helper to add itemized rows or summary rows
    def add_transaction_row(date, type_str, ref, debit, credit, desc, qty=None, rate=None, uom=None):
        transactions.append({
            "id": f"{type_str}-{len(transactions)}", # Unique-ish ID for frontend keys
            "date": date.strftime("%Y-%m-%d") if hasattr(date, 'strftime') else str(date),
            "type": type_str,
            "reference": ref,
            "debit": float(debit),
            "credit": float(credit),
            "description": desc,
            "qty": float(qty) if qty is not None else None,
            "rate": float(rate) if rate is not None else None,
            "uom": str(uom) if uom else ""
        })

    branch_id = request.GET.get('branch_id')

    # 1. Sales Orders (Debit for Customers)
    sos = SalesOrder.objects.filter(customer=party, is_deleted=False)
    if branch_id and branch_id != 'all':
        sos = sos.filter(branch_id=branch_id)
    sos = sos.prefetch_related('items__product', 'items__uom')
    for so in sos:
        for it in so.items.all():
            add_transaction_row(
                so.date, "Sales Order", f"SO #{so.id}", 
                it.line_total(), 0.0, 
                it.product.name, it.quantity, it.unit_price, it.uom.name if it.uom else ""
            )
        # Add Tax/Discount rows if applicable
        if so.tax_percent > 0:
            tax_amt = (so.total_amount * so.tax_percent) / 100
            add_transaction_row(so.date, "Tax", f"SO #{so.id}", tax_amt, 0.0, f"Sales Tax ({so.tax_percent}%)")
        if so.discount_percent > 0:
            disc_amt = (so.total_amount * so.discount_percent) / 100
            add_transaction_row(so.date, "Discount", f"SO #{so.id}", 0.0, disc_amt, f"Discount ({so.discount_percent}%)")

    # 1b. Sales Invoices (Debit for Customers)
    sis = SalesInvoice.objects.filter(customer=party, is_deleted=False)
    if branch_id and branch_id != 'all':
        sis = sis.filter(branch_id=branch_id)
    sis = sis.prefetch_related('items__product')
    for si in sis:
        for it in si.items.all():
            uom_name = getattr(it.product.base_unit, 'name', '') if hasattr(it.product, 'base_unit') else ""
            add_transaction_row(
                si.date, "Sales Invoice", f"INV #{si.invoice_no}", 
                it.line_total(), 0.0, 
                it.product.name, it.quantity, it.unit_price, uom_name
            )
        if si.tax_percent > 0:
            tax_amt = (si.total_amount * si.tax_percent) / 100
            add_transaction_row(si.date, "Tax", f"INV #{si.invoice_no}", tax_amt, 0.0, f"Sales Tax ({si.tax_percent}%)")
        if si.discount_percent > 0:
            disc_amt = (si.total_amount * si.discount_percent) / 100
            add_transaction_row(si.date, "Discount", f"INV #{si.invoice_no}", 0.0, disc_amt, f"Discount ({si.discount_percent}%)")

    # 2. Sales Returns (Credit for Customers)
    srs = SalesReturn.objects.filter(customer=party, is_deleted=False)
    if branch_id and branch_id != 'all':
        srs = srs.filter(branch_id=branch_id)
    srs = srs.prefetch_related('items__product')
    for sr in srs:
        for it in sr.items.all():
            uom_name = getattr(it.product.base_unit, 'name', '') if hasattr(it.product, 'base_unit') else ""
            add_transaction_row(
                sr.date, "Sales Return", f"SR #{sr.id}", 
                0.0, it.line_total(), 
                it.product.name, it.quantity, it.unit_price, uom_name
            )
        if sr.tax_percent > 0:
            tax_amt = (sr.total_amount * sr.tax_percent) / 100
            add_transaction_row(sr.date, "Tax Return", f"SR #{sr.id}", 0.0, tax_amt, f"Sales Tax Return ({sr.tax_percent}%)")
        if sr.discount_percent > 0:
            disc_amt = (sr.total_amount * sr.discount_percent) / 100
            add_transaction_row(sr.date, "Disc. Reversal", f"SR #{sr.id}", disc_amt, 0.0, f"Discount Reversal ({sr.discount_percent}%)")

    # 3. Purchase Orders (Credit for Vendors)
    pos = PurchaseOrder.objects.filter(supplier=party, is_deleted=False)
    if branch_id and branch_id != 'all':
        pos = pos.filter(branch_id=branch_id)
    pos = pos.prefetch_related('items__product', 'items__uom')
    for po in pos:
        for it in po.items.all():
            add_transaction_row(
                po.date, "Purchase Order", f"PO #{po.id}", 
                0.0, it.total_cost(), 
                it.product.name, it.quantity, it.unit_price, it.uom.name if it.uom else ""
            )
        if po.tax_percent > 0:
            tax_amt = (po.total_cost * po.tax_percent) / 100
            add_transaction_row(po.date, "Tax", f"PO #{po.id}", 0.0, tax_amt, f"Purchase Tax ({po.tax_percent}%)")
        if po.discount_percent > 0:
            disc_amt = (po.total_cost * po.discount_percent) / 100
            add_transaction_row(po.date, "Discount", f"PO #{po.id}", disc_amt, 0.0, f"Discount ({po.discount_percent}%)")

    # 4. Purchase Returns (Debit for Vendors)
    prs = PurchaseReturn.objects.filter(supplier=party, is_deleted=False)
    if branch_id and branch_id != 'all':
        prs = prs.filter(branch_id=branch_id)
    prs = prs.prefetch_related('items__product', 'items__uom')
    for pr in prs:
        for it in pr.items.all():
            add_transaction_row(
                pr.date, "Purchase Return", f"PR #{pr.id}", 
                it.total_cost(), 0.0, 
                it.product.name, it.quantity, it.unit_price, it.uom.name if it.uom else ""
            )
        if pr.tax_percent > 0:
            tax_amt = (pr.total_cost * pr.tax_percent) / 100
            add_transaction_row(pr.date, "Tax Return", f"PR #{pr.id}", tax_amt, 0.0, f"Purchase Tax Return ({pr.tax_percent}%)")
        if pr.discount_percent > 0:
            disc_amt = (pr.total_cost * pr.discount_percent) / 100
            add_transaction_row(pr.date, "Disc. Reversal", f"PR #{pr.id}", 0.0, disc_amt, f"Discount Reversal ({pr.discount_percent}%)")

    # 5. Payments
    payments = Payment.objects.filter(party=party, is_deleted=False)
    if branch_id and branch_id != 'all':
        payments = payments.filter(branch_id=branch_id)
    for p in payments:
        debit = 0.0
        credit = 0.0
        # Standard accounting for Party Ledger:
        # Receipt from party (IN) -> Credit Party
        # Payment to party (OUT) -> Debit Party
        if p.direction == Payment.IN:
            credit = float(p.amount)
        else:
            debit = float(p.amount)
        
        type_label = "Payment" if p.direction == Payment.OUT else "Receipt"
        add_transaction_row(
            p.date, type_label, p.reference or f"PY #{p.id}", 
            debit, credit, 
            p.description or f"{p.get_payment_method_display()} via {p.payment_source}"
        )

    # Sort all by date.
    transactions.sort(key=lambda x: (x['date'], x['id']))

    return JsonResponse({
        "party": {
            "id": party.id,
            "display_name": party.display_name,
            "phone": party.phone,
            "type": party.type,
            "opening_balance": float(party.opening_balance),
            "cached_balance": float(party.cached_balance),
            "branch_id": party.branch_id
        },
        "transactions": transactions
    })
