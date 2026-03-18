import os

views_path = r"d:\my_full_stack_project\POS\backend\api\purchase_views.py"

if os.path.exists(views_path):
    with open(views_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    new_lines = []
    for line in lines:
        # Patch update_purchase_order (line 279-281 area)
        if 'po.status = status' in line:
            new_lines.append(line)
            new_lines.append('            po.date = data.get("order_date") or po.date\n')
            continue
        
        # Patch list_purchase_orders (line 408-410 area)
        if '"balance": float(o.balance_due),' in line:
            new_lines.append(line)
            new_lines.append('            "date": o.date.strftime("%Y-%m-%d"),\n')
            continue
            
        new_lines.append(line)
    
    with open(views_path, 'w', encoding='utf-8', newline='') as f:
        f.writelines(new_lines)
    print("purchase_views.py patched.")
鼓
