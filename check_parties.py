import os
import django

import sys
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Party

parties = Party.objects.all()
print(f"Total Parties: {parties.count()}")
for p in parties[:10]:
    print(f"ID: {p.id}, Display: {p.display_name}, Type: {p.type}, Biz: {p.business_id}")
