import os
import django
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.append(os.getcwd())
django.setup()

from django.contrib.auth import get_user_model
User = get_user_model()

users = User.objects.all()
for u in users:
    print(f"User: {u.username}, ID: {u.id}")
    try:
        profile = u.staff_profile
        print(f"  Business: {profile.business.name} (ID: {profile.business.id})")
        print(f"  Branch: {profile.branch.name if profile.branch else 'All'}")
    except:
        print("  No Profile")
