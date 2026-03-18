import os
import django
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.append(os.getcwd())
django.setup()

from api.models import Branch

branches = Branch.objects.all()
for b in branches:
    print(f"ID: {b.id}, Name: {b.name}, Biz: {b.business.name} (ID: {b.business.id})")
