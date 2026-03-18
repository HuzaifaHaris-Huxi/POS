from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.db.models import Sum, Q, F
from django.utils import timezone
from datetime import timedelta, date as date_obj
from decimal import Decimal, InvalidOperation
from api.models import (
    Business, Branch, Staff, BusinessSubscriptionPayment,
    BusinessSummary, BranchSummary, Product, SalesInvoice, Party, ProductCategory, UnitOfMeasure, StockTransaction,
    Warehouse, WarehouseStock, StockMove
)
import json
import csv
from django.http import HttpResponse

@require_http_methods(["GET"])
def dashboard_data_view(request):
    """
    Consolidated data for the Overall Business Dashboard.
    KPIs, Expiries, and monthly sales graph.
    """
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)
    
    try:
        staff = request.user.staff_profile
        biz = staff.business
    except Exception:
        return JsonResponse({"error": "No business profile associated with this user."}, status=403)

    branch_id = request.GET.get('branch_id')
    selected_year = request.GET.get('year', timezone.now().year)
    expiry_days = request.GET.get('expiry_days', 30)
    try:
        selected_year = int(selected_year)
    except ValueError:
        selected_year = timezone.now().year
    
    try:
        expiry_days = int(expiry_days)
    except ValueError:
        expiry_days = 30

    # 1. Branches
    branches = list(biz.branches.filter(is_active=True, is_deleted=False).values("id", "name"))

    # 2. KPIs
    stats = {
        "receivable": 0.0,
        "payable": 0.0,
        "cash_in_hand": 0.0,
        "inventory": 0.0
    }

    if branch_id and branch_id != 'all':
        try:
            summary = BranchSummary.objects.get(branch_id=branch_id, branch__business=biz)
            stats = {
                "receivable": float(summary.total_receivables),
                "payable": float(summary.total_payables),
                "cash_in_hand": float(summary.cash_in_hand),
                "inventory": float(summary.inventory_value)
            }
        except BranchSummary.DoesNotExist:
            pass
    else:
        try:
            summary = BusinessSummary.objects.get(business=biz)
            stats = {
                "receivable": float(summary.total_receivables),
                "payable": float(summary.total_payables),
                "cash_in_hand": float(summary.cash_in_hand),
                "inventory": float(summary.inventory_value)
            }
        except BusinessSummary.DoesNotExist:
            pass

    # 3. Expiry Table (Top 10 products expiring in the next X days)
    today = timezone.now().date()
    expiry_limit = today + timedelta(days=expiry_days)
    
    expiry_query = Product.objects.filter(
        business=biz,
        has_expiry=True,
        expiry_date__gte=today,
        expiry_date__lte=expiry_limit,
        is_active=True,
        is_deleted=False
    )
    if branch_id and branch_id != 'all':
        expiry_query = expiry_query.filter(branch_id=branch_id)

    expiry_products = list(expiry_query.order_by('expiry_date')[:10].values(
        'id', 'name', 'expiry_date', 'stock_qty'
    ))

    # 4. Sales Graph (Monthly totals for the selected year)
    sales_query = SalesInvoice.objects.filter(
        business=biz,
        status=SalesInvoice.Status.POSTED,
        created_at__year=selected_year,
        is_deleted=False
    )
    if branch_id and branch_id != 'all':
        sales_query = sales_query.filter(branch_id=branch_id)

    # Aggregate by month
    monthly_sales = []
    for month in range(1, 13):
        total = sales_query.filter(created_at__month=month).aggregate(total=Sum('net_total'))['total'] or Decimal('0.00')
        monthly_sales.append({
            "month": month,
            "month_name": date_obj(2000, month, 1).strftime('%b'),
            "total": float(total)
        })

    return JsonResponse({
        "business_name": biz.name,
        "branches": branches,
        "stats": stats,
        "expiry_products": expiry_products,
        "sales_graph": monthly_sales,
        "selected_year": selected_year
    })



@require_http_methods(["GET"])
def branch_list_view(request):
    """List all active branches for the user's business."""
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)
    
    try:
        staff = request.user.staff_profile
        biz = staff.business
    except Exception:
        return JsonResponse({"error": "No business profile associated with this user."}, status=403)

    branches = list(biz.branches.filter(is_active=True, is_deleted=False).values("id", "name", "code", "address", "phone", "email"))
    return JsonResponse(branches, safe=False)


@csrf_exempt
@require_http_methods(["POST"])
def branch_create_view(request):
    """Create a new branch for the current user's business."""
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)
    
    try:
        staff = request.user.staff_profile
        biz = staff.business
    except Exception:
        return JsonResponse({"error": "No business profile associated with this user."}, status=403)

    try:
        data = json.loads(request.body)
        name = data.get("name")
        code = data.get("code")
        address = data.get("address", "")
        phone = data.get("phone", "")
        email = data.get("email", "")
        opening_balance = data.get("opening_balance", 0)
        opening_balance_date = data.get("opening_balance_date")

        if not name:
            return JsonResponse({"error": "Branch name is required."}, status=400)

        branch = Branch.objects.create(
            business=biz,
            name=name,
            code=code,
            address=address,
            phone=phone,
            email=email,
            opening_balance=Decimal(str(opening_balance or 0)),
            opening_balance_date=opening_balance_date or timezone.now().date(),
            is_active=True
        )

        return JsonResponse({
            "success": True,
            "branch_id": branch.id,
            "message": f"Branch '{name}' created successfully."
        })
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@require_http_methods(["GET"])
def branch_detail_view(request, pk):
    """Fetch details of a specific branch for the current user's business."""
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)
    
    try:
        staff = request.user.staff_profile
        biz = staff.business
    except Exception:
        return JsonResponse({"error": "No business profile associated with this user."}, status=403)

    try:
        branch = Branch.objects.get(pk=pk, business=biz, is_deleted=False)
        return JsonResponse({
            "id": branch.id,
            "name": branch.name,
            "code": branch.code,
            "address": branch.address,
            "phone": branch.phone,
            "email": branch.email,
            "opening_balance": float(branch.opening_balance),
            "opening_balance_date": str(branch.opening_balance_date) if branch.opening_balance_date else None,
        })
    except Branch.DoesNotExist:
        return JsonResponse({"error": "Branch not found."}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["PUT", "PATCH"])
def branch_edit_view(request, pk):
    """Update an existing branch."""
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)
    
    try:
        staff = request.user.staff_profile
        biz = staff.business
    except Exception:
        return JsonResponse({"error": "No business profile associated with this user."}, status=403)

    try:
        branch = Branch.objects.get(pk=pk, business=biz, is_deleted=False)
        data = json.loads(request.body)
        
        if "name" in data: branch.name = data["name"]
        if "code" in data: branch.code = data["code"]
        if "address" in data: branch.address = data["address"]
        if "phone" in data: branch.phone = data["phone"]
        if "email" in data: branch.email = data["email"]
        if "opening_balance" in data: branch.opening_balance = Decimal(str(data["opening_balance"] or 0))
        if "opening_balance_date" in data: branch.opening_balance_date = data["opening_balance_date"]
        
        branch.save()
        return JsonResponse({"success": True, "message": "Branch updated successfully."})
    except Branch.DoesNotExist:
        return JsonResponse({"error": "Branch not found."}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["DELETE"])
def branch_delete_view(request, pk):
    """Soft-delete a branch."""
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)
    
    try:
        staff = request.user.staff_profile
        biz = staff.business
    except Exception:
        return JsonResponse({"error": "No business profile associated with this user."}, status=403)

    try:
        branch = Branch.objects.get(pk=pk, business=biz, is_deleted=False)
        branch.is_deleted = True
        branch.save()
        return JsonResponse({"success": True, "message": "Branch deleted successfully."})
    except Branch.DoesNotExist:
        return JsonResponse({"error": "Branch not found."}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


# ─── Auth ──────────────────────────────────────────────────────────────────

@require_http_methods(["GET"])
def me_view(request):
    """Return current session user info. 401 if not authenticated."""
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Not authenticated."}, status=401)

    business_id   = None
    business_name = None
    role          = "Unknown"
    full_name     = request.user.get_full_name() or request.user.username

    try:
        staff = request.user.staff_profile
        business_id   = staff.business_id
        business_name = staff.business.name
        role          = staff.get_role_display()
        if not request.user.get_full_name():
            full_name = staff.full_name or full_name
    except Exception:
        if request.user.is_superuser:
            role = "Super Admin"

    return JsonResponse({
        "user": {
            "id": request.user.id,
            "email": request.user.email,
            "is_superuser": request.user.is_superuser,
            "business_id": business_id,
            "business_name": business_name,
            "role": role,
            "full_name": full_name,
            "redirect": "/" if request.user.is_superuser else "/business-dashboard",
        }
    }, status=200)


@require_http_methods(["GET"])
def my_ledger_view(request):
    """Ledger for the LOGGED-IN business user."""
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)
    
    try:
        staff = request.user.staff_profile
        biz = staff.business
    except Exception:
        return JsonResponse({"error": "No business profile associated with this user."}, status=403)

    if biz.is_deleted:
        return JsonResponse({"error": "Business not found."}, status=404)

    today = date_type.today()
    entries = []
    
    # Fetch actual payments
    payments = BusinessSubscriptionPayment.objects.filter(business=biz).order_by("-payment_date")
    paid_map = { (p.payment_type, p.subscription_month): p for p in payments }

    # Logic from business_ledger_detail_view
    created_date = biz.created_at.date() if hasattr(biz.created_at, "date") else biz.created_at
    if not created_date:
         return JsonResponse({"error": "Business records are incomplete."}, status=400)
    
    # 1. Setup Fee
    if biz.down_payment and biz.down_payment > 0:
        paid = paid_map.get((BusinessSubscriptionPayment.TYPE_SETUP, None))
        entries.append({
            "type": "setup",
            "label": "Setup Fee",
            "amount": float(biz.down_payment or 0),
            "due_date": str(created_date),
            "status": "collected" if paid else "pending",
            "paid_on": str(paid.payment_date) if paid else None,
            "notes": paid.notes if paid else ""
        })

    # 2. Monthly Installments
    if not biz.is_lifetime_subscription and biz.monthly_subscription_fee and biz.monthly_subscription_fee > 0:
        month_num = 1
        curr_due = _add_months(created_date, 1)
        future_limit = _add_months(today, 3)

        while curr_due <= future_limit:
            month_key = curr_due.strftime("%Y-%m")
            paid = paid_map.get((BusinessSubscriptionPayment.TYPE_MONTHLY, month_key))
            
            status = "upcoming"
            if curr_due <= today:
                status = "collected" if paid else "pending"

            entries.append({
                "type": "monthly",
                "month_key": month_key,
                "label": f"Month {month_num}",
                "amount": float(biz.monthly_subscription_fee or 0),
                "due_date": str(curr_due),
                "status": status,
                "paid_on": str(paid.payment_date) if paid else None,
                "notes": paid.notes if paid else ""
            })
            month_num += 1
            curr_due = _add_months(created_date, month_num)

    entries.sort(key=lambda e: e["due_date"], reverse=True)

    return JsonResponse({
        "business": {
            "name": biz.name,
            "code": biz.code,
            "is_lifetime": biz.is_lifetime_subscription
        },
        "entries": entries
    })

@csrf_exempt
@require_http_methods(["POST"])
def login_view(request):
    """Authenticate user and return role/redirect info."""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    email    = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return JsonResponse({"error": "Email and password are required."}, status=400)

    try:
        user_obj = User.objects.get(email__iexact=email)
    except User.DoesNotExist:
        return JsonResponse({"error": "Invalid credentials."}, status=401)

    user = authenticate(request, username=user_obj.username, password=password)
    if user is None:
        return JsonResponse({"error": "Invalid credentials."}, status=401)
    if not user.is_active:
        return JsonResponse({"error": "This account is disabled."}, status=403)

    login(request, user)

    # Determine if this is a business-level user
    business_id   = None
    business_name = None
    try:
        staff = user.staff_profile
        business_id   = staff.business_id
        business_name = staff.business.name
    except Exception:
        pass

    return JsonResponse({
        "message": "Login successful.",
        "user": {
            "id": user.id,
            "email": user.email,
            "is_superuser": user.is_superuser,
            "business_id": business_id,
            "business_name": business_name,
            # Tells the frontend where to go
            "redirect": "/" if user.is_superuser else "/business-dashboard",
        }
    }, status=200)


@csrf_exempt
@require_http_methods(["POST"])
def logout_view(request):
    """Log out the current user."""
    logout(request)
    return JsonResponse({"message": "Logged out."}, status=200)


# ─── Business List ──────────────────────────────────────────────────────────

@require_http_methods(["GET"])
def business_list_view(request):
    """Return all businesses. Requires superuser."""
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required."}, status=401)
    if not request.user.is_superuser:
        return JsonResponse({"error": "Superuser access required."}, status=403)

    businesses = list(
        Business.objects.filter(is_deleted=False).values(
            "id", "name", "code", "legal_name",
            "phone", "email", "address", "ntn", "sales_tax_reg",
            "down_payment", "monthly_subscription_fee", "is_lifetime_subscription"
        )
    )
    return JsonResponse({"businesses": businesses}, status=200)


# ─── Business Create ────────────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(["POST"])
def business_create_view(request):
    """
    Create a new business + a dedicated login user for that business.
    Requires superuser.
    """
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required."}, status=401)
    if not request.user.is_superuser:
        return JsonResponse({"error": "Only the app admin can create businesses."}, status=403)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON."}, status=400)

    # ── Required Fields ──
    name     = (data.get("name") or "").strip()
    code     = (data.get("code") or "").strip().upper()
    email    = (data.get("business_email") or "").strip().lower()
    password = (data.get("business_password") or "")

    if not name:
        return JsonResponse({"error": "Business name is required."}, status=400)
    if not code:
        return JsonResponse({"error": "Business code is required."}, status=400)
    if not email or not password:
        return JsonResponse({"error": "Login email and password are required."}, status=400)
    if len(password) < 6:
        return JsonResponse({"error": "Password must be at least 6 characters."}, status=400)

    if Business.objects.filter(code=code).exists():
        return JsonResponse({"error": f"A business with code '{code}' already exists."}, status=400)
    if User.objects.filter(email__iexact=email).exists():
        return JsonResponse({"error": f"Email '{email}' is already in use."}, status=400)

    # ── Create Business ──
    def to_decimal(val):
        try:
            return Decimal(str(val)).quantize(Decimal('0.01'))
        except (InvalidOperation, TypeError, ValueError):
            return Decimal('0.00')

    monthly_charges   = data.get("monthly_charges", False)
    down_payment      = to_decimal(data.get("down_payment", 0))
    monthly_fee       = to_decimal(data.get("monthly_subscription_fee", 0)) if monthly_charges else Decimal('0.00')
    is_lifetime       = not monthly_charges  # if no monthly charges → treat as one-time/lifetime

    business = Business(
        name=name,
        code=code,
        legal_name=(data.get("legal_name") or "").strip(),
        ntn=(data.get("ntn") or "").strip(),
        sales_tax_reg=(data.get("sales_tax_reg") or "").strip(),
        phone=(data.get("phone") or "").strip(),
        email=email,
        address=(data.get("address") or "").strip(),
        down_payment=down_payment,
        monthly_subscription_fee=monthly_fee,
        is_lifetime_subscription=is_lifetime,
        created_by=request.user,
    )
    business.save()


    # ── Create Login User for the business ──
    user = User.objects.create_user(
        username=email,   # use email as username
        email=email,
        password=password,
        is_active=True,
    )

    # ── Link via Staff (Super Admin role for this business) ──
    staff = Staff(
        business=business,
        full_name=name,           # business name as initial staff name
        role=Staff.Roles.SUPER_ADMIN,
        user=user,
        has_software_access=True,
        created_by=request.user,
    )
    # Bypass Staff.save() auto-user creation (user already set)
    super(Staff, staff).save()

    return JsonResponse({
        "message": "Business created successfully.",
        "business": {
            "id": business.id,
            "name": business.name,
            "code": business.code,
        }
    }, status=201)


# ─── Business Update ────────────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(["PUT", "PATCH"])
def business_update_view(request, pk):
    """Update business info and/or its login credentials. Requires superuser."""
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required."}, status=401)
    if not request.user.is_superuser:
        return JsonResponse({"error": "Superuser access required."}, status=403)

    try:
        business = Business.objects.get(pk=pk, is_deleted=False)
    except Business.DoesNotExist:
        return JsonResponse({"error": "Business not found."}, status=404)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON."}, status=400)

    # ── Update business fields ──
    if "name"          in data: business.name          = data["name"].strip()
    if "legal_name"    in data: business.legal_name    = data["legal_name"].strip()
    if "ntn"           in data: business.ntn           = data["ntn"].strip()
    if "sales_tax_reg" in data: business.sales_tax_reg = data["sales_tax_reg"].strip()
    if "phone"         in data: business.phone         = data["phone"].strip()
    if "email"         in data: business.email         = data["email"].strip()
    if "address"       in data: business.address       = data["address"].strip()

    def to_decimal(val):
        try:
            return Decimal(str(val)).quantize(Decimal('0.01'))
        except (InvalidOperation, TypeError, ValueError):
            return Decimal('0.00')

    if "down_payment" in data:
        business.down_payment = to_decimal(data["down_payment"])
    if "monthly_charges" in data:
        monthly = bool(data["monthly_charges"])
        business.is_lifetime_subscription = not monthly
        if not monthly:
            business.monthly_subscription_fee = Decimal('0.00')
    if "monthly_subscription_fee" in data:
        business.monthly_subscription_fee = to_decimal(data["monthly_subscription_fee"])

    business.updated_by = request.user
    business.save()

    # ── Update login credentials if provided ──
    new_email    = (data.get("business_email") or "").strip().lower()
    new_password = data.get("business_password") or ""

    if new_email or new_password:
        # Find the staff super-admin for this business
        try:
            staff = Staff.objects.get(business=business, role=Staff.Roles.SUPER_ADMIN, user__isnull=False)
            user  = staff.user
        except Staff.DoesNotExist:
            return JsonResponse({"error": "No linked user found for this business."}, status=400)

        if new_email:
            # Check the email is not taken by another user
            if User.objects.filter(email__iexact=new_email).exclude(pk=user.pk).exists():
                return JsonResponse({"error": f"Email '{new_email}' is already in use."}, status=400)
            user.email    = new_email
            user.username = new_email
        if new_password:
            if len(new_password) < 6:
                return JsonResponse({"error": "Password must be at least 6 characters."}, status=400)
            user.set_password(new_password)
        user.save()

    return JsonResponse({"message": "Business updated successfully."}, status=200)


# ─── Business Hard Delete ────────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(["DELETE"])
def business_delete_view(request, pk):
    """Hard-delete a business and its linked staff/user. Requires superuser."""
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required."}, status=401)
    if not request.user.is_superuser:
        return JsonResponse({"error": "Superuser access required."}, status=403)

    try:
        business = Business.objects.get(pk=pk)
    except Business.DoesNotExist:
        return JsonResponse({"error": "Business not found."}, status=404)

    # Delete the linked login users (staff super-admins)
    linked_users = User.objects.filter(
        staff_profile__business=business,
        is_superuser=False,
    )
    linked_users.delete()

    # Hard delete the business (cascades to Staff, etc.)
    business.delete()

    return JsonResponse({"message": "Business deleted successfully."}, status=200)


# ─── Business Ledger ────────────────────────────────────────────────────────

import calendar as cal
from datetime import date as date_type


def _add_months(d, months):
    """Add `months` to a date, clamping to month's last day."""
    month = d.month - 1 + months
    year  = d.year + month // 12
    month = month % 12 + 1
    day   = min(d.day, cal.monthrange(year, month)[1])
    return d.replace(year=year, month=month, day=day)


@require_http_methods(["GET"])
def ledger_view(request):
    """
    Virtual ledger — calculates status based on actual data
    from BusinessSubscriptionPayment model. Requires superuser.
    """
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required."}, status=401)
    if not request.user.is_superuser:
        return JsonResponse({"error": "Superuser access required."}, status=403)

    try:
        today = date_type.today()
        all_entries = []
        total_collected = Decimal("0.00")
        total_upcoming = Decimal("0.00")

        businesses = Business.objects.filter(is_deleted=False).order_by("created_at")
        
        # Pre-fetch all payments to avoid N+1
        payments = BusinessSubscriptionPayment.objects.all()
        payment_map = {}
        for p in payments:
            key = (p.business_id, p.payment_type, p.subscription_month)
            payment_map[key] = p

        for biz in businesses:
            created_date = biz.created_at.date() if hasattr(biz.created_at, "date") else biz.created_at
            if not created_date: continue

            # ── Setup Fee ──
            if biz.down_payment and biz.down_payment > 0:
                setup_key = (biz.id, BusinessSubscriptionPayment.TYPE_SETUP, None)
                paid = payment_map.get(setup_key)
                
                all_entries.append({
                    "id": f"setup-{biz.id}",
                    "business_id": biz.id,
                    "business_name": biz.name,
                    "business_code": biz.code,
                    "type": "setup",
                    "label": "Setup Fee",
                    "amount": float(biz.down_payment or 0),
                    "due_date": str(created_date),
                    "status": "collected" if paid else "pending",
                    "payment_id": paid.id if paid else None,
                    "month_key": None
                })
                if paid: total_collected += (biz.down_payment or 0)

            # ── Monthly Fees ──
            if not biz.is_lifetime_subscription and biz.monthly_subscription_fee and biz.monthly_subscription_fee > 0:
                month_num = 1
                curr_due = _add_months(created_date, 1)

                while curr_due <= today:
                    month_key = curr_due.strftime("%Y-%m")
                    m_key = (biz.id, BusinessSubscriptionPayment.TYPE_MONTHLY, month_key)
                    paid = payment_map.get(m_key)

                    all_entries.append({
                        "id": f"monthly-{biz.id}-{month_key}",
                        "business_id": biz.id,
                        "business_name": biz.name,
                        "business_code": biz.code,
                        "type": "monthly",
                        "label": f"Month {month_num} ({curr_due.strftime('%b %Y')})",
                        "amount": float(biz.monthly_subscription_fee or 0),
                        "due_date": str(curr_due),
                        "status": "collected" if paid else "pending",
                        "payment_id": paid.id if paid else None,
                        "month_key": month_key
                    })
                    if paid: total_collected += (biz.monthly_subscription_fee or 0)
                    
                    month_num += 1
                    curr_due = _add_months(created_date, month_num)

                # Upcoming
                month_key = curr_due.strftime("%Y-%m")
                all_entries.append({
                    "id": f"monthly-{biz.id}-upcoming",
                    "business_id": biz.id,
                    "business_name": biz.name,
                    "business_code": biz.code,
                    "type": "monthly",
                    "label": f"Month {month_num} (Upcoming)",
                    "amount": float(biz.monthly_subscription_fee or 0),
                    "due_date": str(curr_due),
                    "status": "upcoming",
                    "month_key": month_key
                })
                total_upcoming += (biz.monthly_subscription_fee or 0)

        all_entries.sort(key=lambda e: e["due_date"], reverse=True)

        return JsonResponse({
            "summary": {
                "total_collected": float(total_collected),
                "total_upcoming": float(total_upcoming),
                "entry_count": len([e for e in all_entries if e["status"] == "collected"]),
            },
            "entries": all_entries,
        }, status=200)
    except Exception as e:
        return JsonResponse({"error": f"Server Logic Error: {str(e)}"}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def record_subscription_payment_view(request):
    """Record a subscription or setup payment. Superuser only."""
    if not request.user.is_authenticated or not request.user.is_superuser:
        return JsonResponse({"error": "Unauthorized."}, status=403)

    try:
        data = json.loads(request.body)
        biz_id = data.get("business_id")
        p_type = data.get("payment_type") # 'setup' or 'monthly'
        month  = data.get("subscription_month") # 'YYYY-MM' or null
        amount = data.get("amount")
        notes  = data.get("notes", "")

        if not all([biz_id, p_type, amount]):
            return JsonResponse({"error": "Missing required fields."}, status=400)

        payment = BusinessSubscriptionPayment.objects.create(
            business_id=biz_id,
            payment_type=p_type,
            subscription_month=month if p_type == 'monthly' else None,
            amount=Decimal(str(amount)),
            notes=notes,
            created_by=request.user
        )

        return JsonResponse({
            "success": True,
            "payment_id": payment.id,
            "message": "Payment recorded successfully."
        })
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@require_http_methods(["GET"])
def business_ledger_detail_view(request, pk):
    """Detailed ledger for ONE business. Superuser only."""
    if not request.user.is_authenticated or not request.user.is_superuser:
        return JsonResponse({"error": "Unauthorized."}, status=403)

    try:
        biz = Business.objects.get(pk=pk, is_deleted=False)
        today = date_type.today()
        entries = []
        
        # Fetch actual payments
        payments = BusinessSubscriptionPayment.objects.filter(business=biz).order_by("-payment_date")
        paid_map = { (p.payment_type, p.subscription_month): p for p in payments }

        # Virtual logic for this specific business
        created_date = biz.created_at.date() if hasattr(biz.created_at, "date") else biz.created_at
        if not created_date:
             return JsonResponse({"error": "Business created_at is missing."}, status=400)
        
        # 1. Setup Fee
        if biz.down_payment and biz.down_payment > 0:
            paid = paid_map.get((BusinessSubscriptionPayment.TYPE_SETUP, None))
            entries.append({
                "type": "setup",
                "label": "Setup Fee",
                "amount": float(biz.down_payment or 0),
                "due_date": str(created_date),
                "status": "collected" if paid else "pending",
                "paid_on": str(paid.payment_date) if paid else None,
                "notes": paid.notes if paid else ""
            })

        # 2. Monthly Installments
        if not biz.is_lifetime_subscription and biz.monthly_subscription_fee and biz.monthly_subscription_fee > 0:
            month_num = 1
            curr_due = _add_months(created_date, 1)

            # Go up to 3 months into the future for "Upcoming" schedule
            future_limit = _add_months(today, 3)

            while curr_due <= future_limit:
                month_key = curr_due.strftime("%Y-%m")
                paid = paid_map.get((BusinessSubscriptionPayment.TYPE_MONTHLY, month_key))
                
                status = "upcoming"
                if curr_due <= today:
                    status = "collected" if paid else "pending"

                entries.append({
                    "type": "monthly",
                    "month_key": month_key,
                    "label": f"Month {month_num} ({curr_due.strftime('%b %Y')})",
                    "amount": float(biz.monthly_subscription_fee or 0),
                    "due_date": str(curr_due),
                    "status": status,
                    "paid_on": str(paid.payment_date) if paid else None,
                    "notes": paid.notes if paid else ""
                })
                month_num += 1
                curr_due = _add_months(created_date, month_num)

        entries.sort(key=lambda e: e["due_date"], reverse=True)

        return JsonResponse({
            "business": {
                "id": biz.id,
                "name": biz.name,
                "code": biz.code,
                "down_payment": float(biz.down_payment or 0),
                "monthly_fee": float(biz.monthly_subscription_fee or 0),
                "is_lifetime": biz.is_lifetime_subscription
            },
            "entries": entries
        })
    except Business.DoesNotExist:
        return JsonResponse({"error": "Business not found."}, status=404)
    except Exception as e:
        return JsonResponse({"error": f"Detail View Error: {str(e)}"}, status=500)


# ─── Parties ────────────────────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(["GET", "POST"])
def party_list_create_view(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)
    
    try:
        staff = request.user.staff_profile
        biz = staff.business
    except Exception:
        return JsonResponse({"error": "No business profile associated with this user."}, status=403)

    if request.method == "GET":
        party_type = request.GET.get('type')
        branch_id = request.GET.get('branch_id')
        search = request.GET.get('search', '').strip()
        
        try:
            page = int(request.GET.get('page', 1))
            limit = int(request.GET.get('limit', 10))
        except ValueError:
            page = 1
            limit = 10

        qs = Party.objects.filter(business=biz, is_deleted=False)
        
        if party_type:
            qs = qs.filter(type=party_type)
            
        if branch_id and branch_id != 'all':
            qs = qs.filter(branch_id=branch_id)
            
        if search:
            qs = qs.filter(
                Q(display_name__icontains=search) | 
                Q(phone__icontains=search) |
                Q(legal_name__icontains=search)
            )
            
        total_count = qs.count()
        qs = qs.order_by('-created_at')
        
        start = (page - 1) * limit
        end = start + limit
        parties = qs[start:end]

        data = []
        for p in parties:
            data.append({
                "id": p.id,
                "type": p.type,
                "display_name": p.display_name,
                "legal_name": p.legal_name,
                "phone": p.phone,
                "email": p.email,
                "address": p.address,
                "gst_number": p.gst_number,
                "opening_balance": float(p.opening_balance),
                "opening_balance_side": p.opening_balance_side,
                "opening_balance_date": str(p.opening_balance_date) if p.opening_balance_date else None,
                "branch_id": p.branch.id if p.branch else None,
                "branch_name": p.branch.name if p.branch else "",
                "created_at": str(p.created_at.date()) if hasattr(p, 'created_at') and p.created_at else None,
            })
            
        return JsonResponse({
            "parties": data,
            "total_count": total_count,
            "page": page,
            "limit": limit
        })

    elif request.method == "POST":
        try:
            data = json.loads(request.body)
            party_type = data.get("type")
            display_name = data.get("display_name")
            branch_id = data.get("branch_id")
            
            if not display_name:
                return JsonResponse({"error": "Display name is required."}, status=400)
            if not party_type or party_type not in [Party.CUSTOMER, Party.VENDOR, Party.BOTH]:
                return JsonResponse({"error": "Invalid or missing party type."}, status=400)
            if not branch_id:
                return JsonResponse({"error": "Branch is required."}, status=400)
                
            try:
                branch = Branch.objects.get(id=branch_id, business=biz, is_deleted=False)
            except Branch.DoesNotExist:
                return JsonResponse({"error": "Invalid branch selected."}, status=400)

            opening_balance = Decimal(str(data.get("opening_balance") or 0))
            
            party = Party.objects.create(
                business=biz,
                branch=branch,
                type=party_type,
                display_name=display_name,
                legal_name=data.get("legal_name", ""),
                phone=data.get("phone", ""),
                email=data.get("email", ""),
                address=data.get("address", ""),
                gst_number=data.get("gst_number", ""),
                opening_balance=opening_balance,
                opening_balance_side=data.get("opening_balance_side", "Dr"),
                opening_balance_date=data.get("opening_balance_date") or timezone.now().date(),
                created_by=request.user
            )
            
            return JsonResponse({
                "success": True,
                "party_id": party.id,
                "message": f"Party '{display_name}' created successfully."
            })
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

@csrf_exempt
@require_http_methods(["PUT", "DELETE"])
def party_detail_view(request, pk):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)
    
    try:
        staff = request.user.staff_profile
        biz = staff.business
    except Exception:
        return JsonResponse({"error": "No business profile associated with this user."}, status=403)

    try:
        party = Party.objects.get(pk=pk, business=biz, is_deleted=False)
    except Party.DoesNotExist:
        return JsonResponse({"error": "Party not found."}, status=404)

    if request.method == "PUT":
        try:
            data = json.loads(request.body)
            branch_id = data.get("branch_id")
            
            if branch_id:
                try:
                    branch = Branch.objects.get(id=branch_id, business=biz, is_deleted=False)
                    party.branch = branch
                except Branch.DoesNotExist:
                    return JsonResponse({"error": "Invalid branch selected."}, status=400)

            if "type" in data:
                ptype = data["type"]
                if ptype in [Party.CUSTOMER, Party.VENDOR, Party.BOTH]:
                    party.type = ptype
            
            if "display_name" in data: party.display_name = data["display_name"]
            if "legal_name" in data: party.legal_name = data["legal_name"]
            if "phone" in data: party.phone = data["phone"]
            if "email" in data: party.email = data["email"]
            if "address" in data: party.address = data["address"]
            if "gst_number" in data: party.gst_number = data["gst_number"]
            if "opening_balance" in data: party.opening_balance = Decimal(str(data.get("opening_balance") or 0))
            if "opening_balance_side" in data: party.opening_balance_side = data["opening_balance_side"]
            if "opening_balance_date" in data: party.opening_balance_date = data["opening_balance_date"]
            
            party.updated_by = request.user
            party.save()
            
            return JsonResponse({"success": True, "message": "Party updated successfully."})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    elif request.method == "DELETE":
        try:
            party.is_deleted = True
            party.updated_by = request.user
            party.save()
            return JsonResponse({"success": True, "message": "Party deleted successfully."})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

# ─── Categories ─────────────────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(["GET", "POST"])
def category_list_create_view(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)
    
    try:
        staff = request.user.staff_profile
        biz = staff.business
    except Exception:
        return JsonResponse({"error": "No business profile associated with this user."}, status=403)

    if request.method == "GET":
        branch_id = request.GET.get('branch_id')
        search = request.GET.get('search', '').strip()
        
        try:
            page = int(request.GET.get('page', 1))
            limit = int(request.GET.get('limit', 10))
        except ValueError:
            page = 1
            limit = 10

        qs = ProductCategory.objects.filter(business=biz)
        
        if branch_id and branch_id != 'all':
            qs = qs.filter(branch_id=branch_id)
            
        if search:
            qs = qs.filter(
                Q(name__icontains=search) | 
                Q(code__icontains=search)
            )
            
        total_count = qs.count()
        qs = qs.order_by('-created_at')
        
        start = (page - 1) * limit
        end = start + limit
        categories = qs[start:end]

        data = []
        for c in categories:
            data.append({
                "id": c.id,
                "name": c.name,
                "code": c.code,
                "branch_id": c.branch.id if c.branch else None,
                "branch_name": c.branch.name if c.branch else "",
                "created_at": str(c.created_at.date()) if hasattr(c, 'created_at') and c.created_at else None,
            })
            
        return JsonResponse({
            "categories": data,
            "total_count": total_count,
            "page": page,
            "limit": limit
        })

    elif request.method == "POST":
        try:
            data = json.loads(request.body)
            name = data.get("name")
            branch_id = data.get("branch_id")
            code = data.get("code")
            
            if not name:
                return JsonResponse({"error": "Category name is required."}, status=400)
            if not branch_id:
                return JsonResponse({"error": "Branch is required."}, status=400)
                
            try:
                branch = Branch.objects.get(id=branch_id, business=biz, is_deleted=False)
            except Branch.DoesNotExist:
                return JsonResponse({"error": "Invalid branch selected."}, status=400)

            # Check if category code is unique in branch if provided
            if code and ProductCategory.objects.filter(branch=branch, code=code).exists():
                return JsonResponse({"error": f"Category code '{code}' already exists in this branch."}, status=400)

            category = ProductCategory.objects.create(
                business=biz,
                branch=branch,
                name=name,
                code=code,
                created_by=request.user
            )
            
            return JsonResponse({
                "success": True,
                "category_id": category.id,
                "message": f"Category '{name}' created successfully."
            })
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

@csrf_exempt
@require_http_methods(["PUT", "DELETE"])
def category_detail_view(request, pk):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)
    
    try:
        staff = request.user.staff_profile
        biz = staff.business
    except Exception:
        return JsonResponse({"error": "No business profile associated with this user."}, status=403)

    try:
        category = ProductCategory.objects.get(pk=pk, business=biz)
    except ProductCategory.DoesNotExist:
        return JsonResponse({"error": "Category not found."}, status=404)

    if request.method == "PUT":
        try:
            data = json.loads(request.body)
            branch_id = data.get("branch_id")
            code = data.get("code")
            
            if branch_id:
                try:
                    branch = Branch.objects.get(id=branch_id, business=biz, is_deleted=False)
                    category.branch = branch
                except Branch.DoesNotExist:
                    return JsonResponse({"error": "Invalid branch selected."}, status=400)

            if code and code != category.code:
                 if ProductCategory.objects.filter(branch=category.branch, code=code).exists():
                     return JsonResponse({"error": f"Category code '{code}' already exists in this branch."}, status=400)

            if "name" in data: category.name = data["name"]
            if "code" in data: category.code = data["code"]
            
            category.updated_by = request.user
            category.save()
            
            return JsonResponse({"success": True, "message": "Category updated successfully."})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    elif request.method == "DELETE":
        try:
            # Check if there are attached products
            if category.products.exists():
                return JsonResponse({
                    "error": "Cannot delete this category because it has products associated with it."
                }, status=400)
                
            category.delete()
            return JsonResponse({"success": True, "message": "Category deleted successfully."})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

# ─── Products ───────────────────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(["GET", "POST"])
def product_list_create_view(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)
    
    try:
        staff = request.user.staff_profile
        biz = staff.business
    except Exception:
        return JsonResponse({"error": "No business profile associated with this user."}, status=403)

    if request.method == "GET":
        branch_id = request.GET.get('branch_id')
        search = request.GET.get('search', '').strip()
        
        try:
            page = int(request.GET.get('page', 1))
            limit = int(request.GET.get('limit', 10))
        except ValueError:
            page = 1
            limit = 10

        qs = Product.objects.filter(business=biz)
        
        if branch_id and branch_id != 'all':
            qs = qs.filter(branch_id=branch_id)
            
        if search:
            qs = qs.filter(
                Q(name__icontains=search) | 
                Q(sku__icontains=search) |
                Q(barcode__icontains=search) |
                Q(company_name__icontains=search)
            )
            
        total_count = qs.count()
        # Calculate overall stock value based on current filters 
        overall_stock_value = sum((p.purchase_price * p.stock_qty for p in qs))
        
        qs = qs.order_by('-created_at')
        
        start = (page - 1) * limit
        end = start + limit
        products = qs[start:end]

        data = []
        for p in products:
            val = p.purchase_price * p.stock_qty
            data.append({
                "id": p.id,
                "name": p.name,
                "sku": p.sku,
                "barcode": p.barcode,
                "company_name": p.company_name,
                "branch_id": p.branch.id if p.branch else None,
                "branch_name": p.branch.name if p.branch else "Global",
                "category_id": p.category.id if p.category else None,
                "category_name": p.category.name if p.category else "",
                "purchase_price": str(p.purchase_price),
                "sale_price": str(p.sale_price),
                "stock_qty": str(p.stock_qty),
                "total_valuation": str(val),
                "uom_id": p.uom.id if p.uom else None,
                "uom_code": p.uom.code if p.uom else "",
                "bulk_uom_id": p.bulk_uom.id if p.bulk_uom else None,
                "bulk_uom_code": p.bulk_uom.code if p.bulk_uom else "",
                "default_bulk_size": str(p.default_bulk_size),
                "has_expiry": p.has_expiry,
                "expiry_date": str(p.expiry_date) if p.expiry_date else None,
                "created_at": str(p.created_at.date()) if hasattr(p, 'created_at') and p.created_at else None,
            })
            
        return JsonResponse({
            "products": data,
            "overall_stock_value": str(overall_stock_value),
            "total_count": total_count,
            "page": page,
            "limit": limit
        })

    elif request.method == "POST":
        try:
            data = json.loads(request.body)
            name = data.get("name")
            branch_id = data.get("branch_id")
            category_id = data.get("category_id")
            uom_id = data.get("uom_id")
            
            if not name: return JsonResponse({"error": "Product name is required."}, status=400)
            if not branch_id: return JsonResponse({"error": "Branch is required."}, status=400)
            if not uom_id: return JsonResponse({"error": "UOM is required."}, status=400)
                
            try:
                branch = Branch.objects.get(id=branch_id, business=biz, is_deleted=False)
            except Branch.DoesNotExist:
                return JsonResponse({"error": "Invalid branch selected."}, status=400)
                
            uom = UnitOfMeasure.objects.get(id=uom_id)
            category = None
            if category_id:
                try:
                    category = ProductCategory.objects.get(id=category_id, business=biz)
                except ProductCategory.DoesNotExist:
                    pass

            from django.db import transaction
            from django.utils import timezone
            
            with transaction.atomic():
                product = Product.objects.create(
                    business=biz,
                    branch=branch,
                    category=category,
                    name=name,
                    company_name=data.get("company_name", ""),
                    sku=data.get("sku", ""),
                    barcode=data.get("barcode", ""),
                    uom=uom,
                    bulk_uom_id=data.get("bulk_uom_id") or None,
                    default_bulk_size=Decimal(str(data.get("default_bulk_size") or 1)),
                    purchase_price=Decimal(str(data.get("purchase_price") or 0)),
                    sale_price=Decimal(str(data.get("sale_price") or 0)),
                    min_stock=Decimal(str(data.get("min_stock") or 0)),
                    stock_qty=Decimal(str(data.get("stock_qty") or 0)),
                    has_expiry=data.get("has_expiry", False),
                    expiry_date=data.get("expiry_date") or None,
                    created_by=request.user,
                    updated_by=request.user
                )

                if product.stock_qty > 0:
                    StockTransaction.objects.create(
                        business=product.business,
                        branch=product.branch,
                        date=timezone.now().date(),
                        movement='in',
                        product=product,
                        uom=product.uom,
                        quantity=product.stock_qty,
                        reference='Opening Stock',
                        notes='Initial stock set during product creation.',
                        created_by=request.user,
                        updated_by=request.user
                    )
            
            return JsonResponse({
                "success": True,
                "product_id": product.id,
                "message": f"Product '{name}' created successfully."
            })
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

@csrf_exempt
@require_http_methods(["PUT", "DELETE"])
def product_detail_view(request, pk):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)
    try:
        staff = request.user.staff_profile
        biz = staff.business
    except Exception:
        return JsonResponse({"error": "No business profile."}, status=403)

    try:
        product = Product.objects.get(pk=pk, business=biz)
    except Product.DoesNotExist:
        return JsonResponse({"error": "Product not found."}, status=404)

    if request.method == "PUT":
        try:
            data = json.loads(request.body)
            
            if "branch_id" in data:
                try:
                    product.branch = Branch.objects.get(id=data["branch_id"], business=biz, is_deleted=False)
                except:
                    pass
            if "category_id" in data:
                try:
                    product.category = ProductCategory.objects.get(id=data["category_id"], business=biz)
                except:
                    product.category = None
            if "uom_id" in data:
                try:
                    product.uom = UnitOfMeasure.objects.get(id=data["uom_id"])
                except:
                    pass

            from django.db import transaction
            from django.utils import timezone
            
            with transaction.atomic():
                if "name" in data: product.name = data["name"]
                if "company_name" in data: product.company_name = data["company_name"]
                if "sku" in data: product.sku = data["sku"]
                if "barcode" in data: product.barcode = data["barcode"]
                if "bulk_uom_id" in data:
                    try: product.bulk_uom_id = data["bulk_uom_id"] or None
                    except: pass
                if "default_bulk_size" in data: product.default_bulk_size = Decimal(str(data["default_bulk_size"] or 1))
                if "purchase_price" in data: product.purchase_price = Decimal(str(data["purchase_price"] or 0))
                if "sale_price" in data: product.sale_price = Decimal(str(data["sale_price"] or 0))
                if "min_stock" in data: product.min_stock = Decimal(str(data["min_stock"] or 0))
                if "has_expiry" in data: product.has_expiry = data["has_expiry"]
                if "expiry_date" in data: product.expiry_date = data["expiry_date"] or None
                
                if "stock_qty" in data:
                    new_qty = Decimal(str(data["stock_qty"] or 0))
                    diff = new_qty - product.stock_qty
                    if diff != 0:
                        movement = 'in' if diff > 0 else 'out'
                        StockTransaction.objects.create(
                            business=product.business,
                            branch=product.branch,
                            date=timezone.now().date(),
                            movement=movement,
                            product=product,
                            uom=product.uom,
                            quantity=abs(diff),
                            reference='Stock Adjustment',
                            notes='Modified via product form directly.',
                            created_by=request.user,
                            updated_by=request.user
                        )
                    product.stock_qty = new_qty
                
                product.updated_by = request.user
                product.save()
            return JsonResponse({"success": True})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    elif request.method == "DELETE":
        try:
            # Check relationships (simplified)
            product.delete()
            return JsonResponse({"success": True})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

@require_http_methods(["GET"])
def product_export_view(request):
    """
    Exports products to CSV filtering by branch_id and search.
    """
    if not request.user.is_authenticated:
        return HttpResponse("Unauthorized", status=401)
    try:
        staff = request.user.staff_profile
        biz = staff.business
    except Exception:
        return HttpResponse("Forbidden", status=403)

    branch_id = request.GET.get('branch_id')
    search = request.GET.get('search', '').strip()
    
    qs = Product.objects.filter(business=biz)
    if branch_id and branch_id != 'all':
        qs = qs.filter(branch_id=branch_id)
        
    if search:
        qs = qs.filter(
            Q(name__icontains=search) | 
            Q(sku__icontains=search) |
            Q(barcode__icontains=search) |
            Q(company_name__icontains=search)
        )
        
    qs = qs.order_by('-created_at')

    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="products_export.csv"'

    writer = csv.writer(response)
    writer.writerow([
        'Product Name', 'Company/Brand', 'SKU', 'Barcode', 'Category', 
        'Branch', 'UOM', 'Purchase Price', 'Sale Price', 'Current Stock', 'Total Valuation'
    ])

    for p in qs:
        val = p.purchase_price * p.stock_qty
        writer.writerow([
            p.name,
            p.company_name,
            p.sku,
            p.barcode,
            p.category.name if p.category else 'N/A',
            p.branch.name if p.branch else 'Global',
            p.uom.code if p.uom else 'N/A',
            p.purchase_price,
            p.sale_price,
            p.stock_qty,
            val
        ])

    return response

@csrf_exempt
@require_http_methods(["GET", "POST"])
def uom_list_view(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)
    
    if request.method == "GET":
        uoms = UnitOfMeasure.objects.all().order_by('code')
        data = [{"id": u.id, "name": u.name, "code": u.code, "symbol": u.symbol} for u in uoms]
        return JsonResponse({"uoms": data})
        
    elif request.method == "POST":
        try:
            data = json.loads(request.body)
            name = data.get("name", "").strip()
            code = data.get("code", "").strip()
            symbol = data.get("symbol", "").strip()
            
            if not name or not code:
                return JsonResponse({"error": "Name and Code are required for UOM."}, status=400)
                
            # Check if exists
            if UnitOfMeasure.objects.filter(code__iexact=code).exists():
                return JsonResponse({"error": "A UOM with this code already exists."}, status=400)
                
            uom = UnitOfMeasure.objects.create(name=name, code=code, symbol=symbol, created_by=request.user)
            return JsonResponse({
                "success": True, 
                "uom": {"id": uom.id, "name": uom.name, "code": uom.code, "symbol": uom.symbol}
            })
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


# ==========================================
# NEW: Stock Status & Adjustments
# ==========================================

@csrf_exempt
@require_http_methods(["GET"])
def stock_transaction_list_view(request, pk):
    """
    Fetch paginated stock history for a specific product.
    Format is intended for the StockDetail frontend view.
    """
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)
        
    try:
        product = Product.objects.get(pk=pk, business=request.user.staff_profile.business)
    except Product.DoesNotExist:
        return JsonResponse({"error": "Product not found."}, status=404)

    page_num = int(request.GET.get('page', 1))
    limit = int(request.GET.get('limit', 10))

    try:
        qs = StockTransaction.objects.filter(product=product).order_by('-date', '-id')

        total_count = qs.count()
        start = (page_num - 1) * limit
        end = start + limit
        page_items = qs[start:end]

        transactions_data = []
        for tx in page_items:
            transactions_data.append({
                "id": tx.id,
                "date": tx.date.strftime("%Y-%m-%d") if tx.date else "",
                "movement": tx.movement,
                "quantity": str(tx.quantity),
                "uom": tx.uom.code if tx.uom else (product.uom.code if product.uom else ""),
                "reference": tx.reference,
                "notes": tx.notes,
                "branch_name": tx.branch.name if tx.branch else "Global"
            })

        return JsonResponse({
            "success": True,
            "product_name": product.name,
            "current_stock": str(product.stock_qty),
            "transactions": transactions_data,
            "total_count": total_count,
            "page": page_num,
            "limit": limit
        })
    except Exception as e:
        return JsonResponse({"error": f"Server error: {str(e)}"}, status=500)


@require_http_methods(["GET"])
def stock_transaction_detail_view(request, pk, tx_id):
    """
    Fetch details of a specific stock transaction.
    """
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)
        
    try:
        product = Product.objects.get(pk=pk, business=request.user.staff_profile.business)
        tx = StockTransaction.objects.get(pk=tx_id, product=product)

        return JsonResponse({
            "success": True,
            "transaction": {
                "id": tx.id,
                "date": tx.date.strftime("%Y-%m-%d") if tx.date else "",
                "movement": tx.movement,
                "quantity": str(tx.quantity),
                "uom": tx.uom.code if tx.uom else (product.uom.code if product.uom else ""),
                "reference": tx.reference,
                "notes": tx.notes,
                "branch_name": tx.branch.name if tx.branch else "Global"
            }
        })
    except (Product.DoesNotExist, StockTransaction.DoesNotExist):
        return JsonResponse({"error": "Transaction not found."}, status=404)
    except Exception as e:
        return JsonResponse({"error": f"Server error: {str(e)}"}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def stock_adjust_view(request, pk):
    """
    Manually add or remove stock.
    Creates a StockTransaction and updates the Product's stock_qty.
    """
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)
        
    try:
        product = Product.objects.get(pk=pk, business=request.user.staff_profile.business)
    except Product.DoesNotExist:
        return JsonResponse({"error": "Product not found."}, status=404)

    try:
        data = json.loads(request.body)
        movement = data.get("movement")  # "in" or "out"
        quantity = Decimal(str(data.get("quantity") or 0))
        reference = data.get("reference", "").strip()
        notes = data.get("notes", "").strip()
        uom_id = data.get("uom_id")

        if movement not in ["in", "out"]:
            return JsonResponse({"error": "Invalid movement type. Must be 'in' or 'out'."}, status=400)
            
        if quantity <= 0:
            return JsonResponse({"error": "Quantity must be positive."}, status=400)

        # Use provided UOM or Product's default
        tx_uom = product.uom
        if uom_id:
            tx_uom = UnitOfMeasure.objects.filter(id=uom_id).first() or product.uom

        # Calculate exact base quantity if bulk unit is selected and it matters
        # Actually, for stock adjustments, letting them define exact unit quantity is better.
        # Ensure we always deal in Base Unit equivalents regarding `product.stock_qty`.
        base_quantity = quantity
        if tx_uom == product.bulk_uom and product.default_bulk_size:
            base_quantity = quantity * product.default_bulk_size

        from django.db import transaction
        with transaction.atomic():
            # 1. Update Product Master Stock
            # Refetch for update to prevent race conditions
            locked_product = Product.objects.select_for_update().get(pk=pk)
            
            if movement == "in":
                locked_product.stock_qty += base_quantity
            else: # "out"
                if locked_product.stock_qty < base_quantity:
                    return JsonResponse({"error": f"Insufficient stock. Current: {locked_product.stock_qty}, Attempted to remove: {base_quantity}"}, status=400)
                locked_product.stock_qty -= base_quantity
                
            locked_product.save(update_fields=['stock_qty'])

            # 2. Record Transaction
            tx = StockTransaction.objects.create(
                business=locked_product.business,
                branch=locked_product.branch, # Record at the product's branch
                date=timezone.now().date(),
                movement=movement,
                product=locked_product,
                uom=tx_uom, # Display whichever UOM they chose
                quantity=quantity, # Store how much of THAT UOM they moved
                reference=reference,
                notes=notes,
                created_by=request.user,
                updated_by=request.user
            )

        return JsonResponse({
            "success": True,
            "new_stock": str(locked_product.stock_qty),
            "transaction_id": tx.id
        })

    except InvalidOperation:
        return JsonResponse({"error": "Invalid number format for quantity."}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


import json
from decimal import Decimal, InvalidOperation
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.db.models import Q
from django.utils import timezone
from api.models import (
    Warehouse, WarehouseStock, StockMove, Product, Branch, UnitOfMeasure, StockTransaction
)

@csrf_exempt
@require_http_methods(["GET", "POST"])
def warehouse_list_create_view(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)
    
    try:
        staff = request.user.staff_profile
        biz = staff.business
    except Exception:
        return JsonResponse({"error": "No business profile associated with this user."}, status=403)

    if request.method == "GET":
        branch_id = request.GET.get('branch_id')
        search = request.GET.get('search', '').strip()
        
        try:
            page = int(request.GET.get('page', 1))
            limit = int(request.GET.get('limit', 10))
        except ValueError:
            page = 1
            limit = 10

        qs = Warehouse.objects.filter(business=biz, is_deleted=False)
        
        if branch_id and branch_id != 'all':
            qs = qs.filter(branch_id=branch_id)
            
        if search:
            qs = qs.filter(
                Q(name__icontains=search) | 
                Q(code__icontains=search)
            )
            
        total_count = qs.count()
        qs = qs.order_by('-created_at')
        
        start = (page - 1) * limit
        end = start + limit
        warehouses = qs[start:end]

        data = []
        for w in warehouses:
            data.append({
                "id": w.id,
                "name": w.name,
                "code": w.code,
                "address": w.address,
                "is_active": w.is_active,
                "branch_id": w.branch.id if w.branch else None,
                "branch_name": w.branch.name if w.branch else "",
                "created_at": str(w.created_at.date()) if hasattr(w, 'created_at') and w.created_at else None,
            })
            
        return JsonResponse({
            "warehouses": data,
            "total_count": total_count,
            "page": page,
            "limit": limit
        })

    elif request.method == "POST":
        try:
            data = json.loads(request.body)
            name = data.get("name")
            code = data.get("code")
            branch_id = data.get("branch_id")
            
            if not name or not code:
                return JsonResponse({"error": "Warehouse name and code are required."}, status=400)
            if not branch_id:
                return JsonResponse({"error": "Branch is required."}, status=400)
                
            try:
                branch = Branch.objects.get(id=branch_id, business=biz, is_deleted=False)
            except Branch.DoesNotExist:
                return JsonResponse({"error": "Invalid branch selected."}, status=400)

            if Warehouse.objects.filter(business=biz, code=code, is_deleted=False).exists():
                return JsonResponse({"error": f"Warehouse code '{code}' already exists."}, status=400)

            warehouse = Warehouse.objects.create(
                business=biz,
                branch=branch,
                name=name,
                code=code,
                address=data.get("address", ""),
                is_active=data.get("is_active", True),
                created_by=request.user
            )
            
            return JsonResponse({
                "success": True,
                "warehouse_id": warehouse.id,
                "message": f"Warehouse '{name}' created successfully."
            })
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["PUT", "DELETE"])
def warehouse_detail_view(request, pk):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)
    
    try:
        staff = request.user.staff_profile
        biz = staff.business
    except Exception:
        return JsonResponse({"error": "No business profile associated with this user."}, status=403)

    try:
        warehouse = Warehouse.objects.get(pk=pk, business=biz, is_deleted=False)
    except Warehouse.DoesNotExist:
        return JsonResponse({"error": "Warehouse not found."}, status=404)

    if request.method == "PUT":
        try:
            data = json.loads(request.body)
            branch_id = data.get("branch_id")
            code = data.get("code")
            
            if branch_id:
                try:
                    branch = Branch.objects.get(id=branch_id, business=biz, is_deleted=False)
                    warehouse.branch = branch
                except Branch.DoesNotExist:
                    return JsonResponse({"error": "Invalid branch selected."}, status=400)

            if code and code != warehouse.code:
                 if Warehouse.objects.filter(business=biz, code=code, is_deleted=False).exists():
                     return JsonResponse({"error": f"Warehouse code '{code}' already exists."}, status=400)
                 warehouse.code = code

            if "name" in data: warehouse.name = data["name"]
            if "address" in data: warehouse.address = data["address"]
            if "is_active" in data: warehouse.is_active = data["is_active"]
            
            warehouse.updated_by = request.user
            warehouse.save()
            
            return JsonResponse({"success": True, "message": "Warehouse updated successfully."})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    elif request.method == "DELETE":
        try:
            if WarehouseStock.objects.filter(warehouse=warehouse, quantity__gt=0).exists():
                return JsonResponse({
                    "error": "Cannot delete this warehouse because it has items in stock."
                }, status=400)
                
            warehouse.is_deleted = True
            warehouse.is_active = False
            warehouse.updated_by = request.user
            warehouse.save()
            return JsonResponse({"success": True, "message": "Warehouse deleted successfully."})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def warehouse_stock_view(request, pk):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)
        
    try:
        staff = request.user.staff_profile
        biz = staff.business
    except Exception:
        return JsonResponse({"error": "No business profile."}, status=403)

    try:
        warehouse = Warehouse.objects.get(pk=pk, business=biz, is_deleted=False)
    except Warehouse.DoesNotExist:
        return JsonResponse({"error": "Warehouse not found."}, status=404)

    qs = WarehouseStock.objects.filter(warehouse=warehouse, quantity__gt=0)
    
    search = request.GET.get('search', '').strip()
    if search:
        qs = qs.filter(
            Q(product__name__icontains=search) | 
            Q(product__sku__icontains=search) |
            Q(product__barcode__icontains=search)
        )
        
    page = int(request.GET.get('page', 1))
    limit = int(request.GET.get('limit', 10))
    start = (page - 1) * limit
    end = start + limit
    
    total_count = qs.count()
    stocks = qs.select_related('product', 'product__uom').order_by('product__name')[start:end]

    data = []
    for s in stocks:
        data.append({
            "id": s.id,
            "product_id": s.product.id,
            "product_name": s.product.name,
            "sku": s.product.sku,
            "barcode": s.product.barcode,
            "quantity": str(s.quantity),
            "uom": s.product.uom.code if s.product.uom else "",
        })

    return JsonResponse({
        "success": True,
        "stocks": data,
        "total_count": total_count,
        "page": page,
        "limit": limit
    })


@csrf_exempt
@require_http_methods(["POST"])
def stock_transfer_view(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)
        
    try:
        staff = request.user.staff_profile
        biz = staff.business
    except Exception:
        return JsonResponse({"error": "No business profile."}, status=403)

    try:
        data = json.loads(request.body)
        
        source_type = data.get("source_type") # "branch" or "warehouse"
        source_id = data.get("source_id")
        dest_type = data.get("dest_type")
        dest_id = data.get("dest_id")
        items = data.get("items", []) # [{"product_id": 1, "quantity": 10}]
        reference = data.get("reference", "")
        
        if not all([source_type, source_id, dest_type, dest_id, items]):
            return JsonResponse({"error": "Missing required fields."}, status=400)
            
        if source_type == dest_type and source_id == dest_id:
            return JsonResponse({"error": "Source and destination cannot be the same."}, status=400)

        source_branch, source_warehouse = None, None
        dest_branch, dest_warehouse = None, None

        if source_type == "branch":
            source_branch = Branch.objects.get(id=source_id, business=biz, is_deleted=False)
        elif source_type == "warehouse":
            source_warehouse = Warehouse.objects.get(id=source_id, business=biz, is_deleted=False)
        else:
            return JsonResponse({"error": "Invalid source type."}, status=400)

        if dest_type == "branch":
            dest_branch = Branch.objects.get(id=dest_id, business=biz, is_deleted=False)
        elif dest_type == "warehouse":
            dest_warehouse = Warehouse.objects.get(id=dest_id, business=biz, is_deleted=False)
        else:
            return JsonResponse({"error": "Invalid destination type."}, status=400)

        from django.db import transaction
        with transaction.atomic():
            for item in items:
                product_id = item.get("product_id")
                quantity = Decimal(str(item.get("quantity") or 0))
                
                if quantity <= 0:
                    raise ValueError(f"Invalid quantity for product ID {product_id}")
                    
                product = Product.objects.get(id=product_id, business=biz)
                
                move = StockMove(
                    product=product,
                    source_branch=source_branch,
                    source_warehouse=source_warehouse,
                    dest_branch=dest_branch,
                    dest_warehouse=dest_warehouse,
                    quantity=quantity,
                    reference=reference,
                    status=StockMove.Status.DRAFT,
                    created_by=request.user,
                    updated_by=request.user
                )
                
                # Perform the transfer
                move.post(user=request.user)
                
        return JsonResponse({
            "success": True,
            "message": "Stock transfer completed successfully."
        })

    except (Branch.DoesNotExist, Warehouse.DoesNotExist, Product.DoesNotExist) as e:
        return JsonResponse({"error": "Invalid location or product selected."}, status=400)
    except ValueError as e:
        return JsonResponse({"error": str(e)}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def stock_check_view(request):
    """
    Returns the available stock for a specific product at a specific location
    Usage: GET /api/warehouses/stock-check/?source_type=...&source_id=...&product_id=...
    """
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized."}, status=401)
        
    try:
        staff = request.user.staff_profile
        biz = staff.business
    except Exception:
        return JsonResponse({"error": "No business profile."}, status=403)

    source_type = request.GET.get('source_type')
    source_id = request.GET.get('source_id')
    product_id = request.GET.get('product_id')

    if not all([source_type, source_id, product_id]):
        return JsonResponse({"error": "Missing required parameters."}, status=400)

    try:
        product = Product.objects.get(id=product_id, business=biz)
        
        available_qty = Decimal("0.00")
        
        if source_type == "branch":
            available_qty = product.stock_qty or Decimal("0.00")
        elif source_type == "warehouse":
            warehouse = Warehouse.objects.get(id=source_id, business=biz, is_deleted=False)
            ws = WarehouseStock.objects.filter(warehouse=warehouse, product=product).first()
            if ws:
                available_qty = ws.quantity or Decimal("0.00")
        else:
            return JsonResponse({"error": "Invalid source type."}, status=400)

        return JsonResponse({
            "success": True,
            "available_quantity": str(available_qty)
        })

    except Product.DoesNotExist:
        return JsonResponse({"error": "Product not found."}, status=400)
    except Warehouse.DoesNotExist:
        return JsonResponse({"error": "Warehouse not found."}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
