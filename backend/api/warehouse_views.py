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
            # Currently branch stock is represented by the Product's global stock_qty
            # but usually verified that the branch matches if applicable
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
