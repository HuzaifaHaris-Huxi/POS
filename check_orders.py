import os
import django
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.append(os.getcwd())
django.setup()

from api.models import SalesOrder

orders = SalesOrder.objects.all().order_by('-id')
for o in orders:
    print(f"ID: {o.id}, Customer: {o.customer.display_name} (ID: {o.customer.id if o.customer else 'None'}), Biz: {o.business.name} (ID: {o.business.id})")
