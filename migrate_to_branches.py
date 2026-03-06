import os
import sys
import django

# Setup Django environment
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import transaction
from api.models import (
    Business, Branch, Party, ProductCategory, Product, Staff,
    BankAccount, CashFlow, BankMovement, PurchaseOrder,
    PurchaseReturn, SalesOrder, SalesInvoice, SalesReturn,
    Payment, Expense, BusinessSettings, BranchSettings
)

def create_main_branch(business):
    """Creates a default 'Main Branch' for a business if one does not exist."""
    branch, created = Branch.objects.get_or_create(
        business=business,
        code='MAIN',
        defaults={
            'name': f"{business.name} - Main Branch",
            'address': 'Main Branch Address', # Placeholder
            'phone': '0000000000',
        }
    )
    if created:
        print(f"  Created Main Branch for business: {business.name}")
        
        # Create BranchSettings
        BranchSettings.objects.get_or_create(branch=branch)
    return branch

@transaction.atomic
def migrate_data():
    businesses = Business.objects.all()
    print(f"Found {businesses.count()} businesses to migrate.")

    for business in businesses:
        print(f"\nMigrating data for Business: {business.name} (Code: {business.code})")

        # 1. Ensure BusinessSettings exists
        BusinessSettings.objects.get_or_create(business=business)

        # 2. Create/Get Main Branch
        main_branch = create_main_branch(business)

        # 3. Migrate Master Data
        # Parties
        parties = Party.objects.filter(business=business, branch__isnull=True)
        party_count = parties.update(branch=main_branch)
        print(f"  Migrated {party_count} Parties to Main Branch.")

        # Product Categories
        categories = ProductCategory.objects.filter(business=business, branch__isnull=True)
        cat_count = categories.update(branch=main_branch)
        print(f"  Migrated {cat_count} Product Categories to Main Branch.")

        # Products
        products = Product.objects.filter(business=business, branch__isnull=True)
        prod_count = products.update(branch=main_branch)
        print(f"  Migrated {prod_count} Products to Main Branch.")

        # Staff
        staff_members = Staff.objects.filter(business=business, branch__isnull=True)
        staff_count = staff_members.update(branch=main_branch)
        print(f"  Migrated {staff_count} Staff to Main Branch.")

        # Bank Accounts
        bank_accounts = BankAccount.objects.filter(business=business, branch__isnull=True)
        bank_count = bank_accounts.update(branch=main_branch)
        print(f"  Migrated {bank_count} Bank Accounts to Main Branch.")

        # 4. Migrate Transactions
        # Purchase Orders
        pos = PurchaseOrder.objects.filter(business=business, branch__isnull=True)
        po_count = pos.update(branch=main_branch)
        print(f"  Migrated {po_count} Purchase Orders to Main Branch.")

        # Purchase Returns
        prs = PurchaseReturn.objects.filter(business=business, branch__isnull=True)
        pr_count = prs.update(branch=main_branch)
        print(f"  Migrated {pr_count} Purchase Returns to Main Branch.")

        # Sales Orders
        sos = SalesOrder.objects.filter(business=business, branch__isnull=True)
        so_count = sos.update(branch=main_branch)
        print(f"  Migrated {so_count} Sales Orders to Main Branch.")

        # Sales Invoices
        sis = SalesInvoice.objects.filter(business=business, branch__isnull=True)
        si_count = sis.update(branch=main_branch)
        print(f"  Migrated {si_count} Sales Invoices to Main Branch.")

        # Sales Returns
        srs = SalesReturn.objects.filter(business=business, branch__isnull=True)
        sr_count = srs.update(branch=main_branch)
        print(f"  Migrated {sr_count} Sales Returns to Main Branch.")

        # Payments
        payments = Payment.objects.filter(business=business, branch__isnull=True)
        payment_count = payments.update(branch=main_branch)
        print(f"  Migrated {payment_count} Payments to Main Branch.")

        # Expenses
        expenses = Expense.objects.filter(business=business, branch__isnull=True)
        expense_count = expenses.update(branch=main_branch)
        print(f"  Migrated {expense_count} Expenses to Main Branch.")

        # CashFlows
        cashflows = CashFlow.objects.filter(business=business, branch__isnull=True)
        cashflow_count = cashflows.update(branch=main_branch)
        print(f"  Migrated {cashflow_count} CashFlows to Main Branch.")

        # BankMovements
        bank_movements = BankMovement.objects.filter(business=business, branch__isnull=True)
        bm_count = bank_movements.update(branch=main_branch)
        print(f"  Migrated {bm_count} Bank Movements to Main Branch.")

        print(f"Finished migrating data for {business.name}.")

    print("\nData migration completed successfully.")

if __name__ == '__main__':
    print("WARNING: This script will associate all existing business data with a newly created 'Main Branch'.")
    print("Ensure you have backed up your database before running this script.")
    response = input("Do you want to proceed? (y/n): ")
    if response.lower() == 'y':
        migrate_data()
    else:
        print("Migration cancelled.")
