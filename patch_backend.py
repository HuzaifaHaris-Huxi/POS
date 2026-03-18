import os

models_path = r"d:\my_full_stack_project\POS\backend\api\models.py"
views_path = r"d:\my_full_stack_project\POS\backend\api\purchase_views.py"

# Patch models.py
if os.path.exists(models_path):
    with open(models_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    new_lines = []
    found = False
    for line in lines:
        if 'created_at = models.DateTimeField(default=timezone.now)' in line and not found:
             # Check if we just passed PurchaseOrder (simple heuristic)
             new_lines.append('    date       = models.DateField(default=timezone.now, db_index=True)\n')
             found = True
        new_lines.append(line)
    
    with open(models_path, 'w', encoding='utf-8', newline='') as f:
        f.writelines(new_lines)
    print("models.py patched.")

# Patch purchase_views.py
if os.path.exists(views_path):
    with open(views_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Patch create_purchase_order
    # Using more robust matching (less lines)
    old_create = '            po = PurchaseOrder.objects.create(\n                business=biz,'
    new_create = '            po = PurchaseOrder.objects.create(\n                business=biz,\n                date=data.get("order_date") or timezone.now().date(),'
    if old_create in content:
        content = content.replace(old_create, new_create)
    else:
        print("Warning: create_purchase_order hook not found.")

    # Patch update_purchase_order
    old_update = '            po.status = data.get("status", po.status)\n            po.total_cost = to_dec(data.get("total_cost", po.total_cost))'
    new_update = '            po.status = data.get("status", po.status)\n            po.date = data.get("order_date") or po.date\n            po.total_cost = to_dec(data.get("total_cost", po.total_cost))'
    if old_update in content:
        content = content.replace(old_update, new_update)
    else:
        print("Warning: update_purchase_order hook not found.")

    with open(views_path, 'w', encoding='utf-8', newline='') as f:
        f.write(content)
    print("purchase_views.py patched.")
鼓
