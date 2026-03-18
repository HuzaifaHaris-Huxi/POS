from django.urls import path
from api import views
from api import sales_views
from api import purchase_views
from api import finance_views

urlpatterns = [
    path('me/',                             views.me_view,               name='me'),
    path('login/',                          views.login_view,            name='login'),
    path('logout/',                         views.logout_view,           name='logout'),
    path('businesses/',                     views.business_list_view,    name='business-list'),
    path('businesses/create/',              views.business_create_view,  name='business-create'),
    path('branches/',                   views.branch_list_view,      name='branch-list'),
    path('branches/create/',            views.branch_create_view,    name='branch_create'),
    path('branches/<int:pk>/',          views.branch_detail_view,    name='branch_detail'),
    path('branches/<int:pk>/edit/',     views.branch_edit_view,      name='branch_edit'),
    path('branches/<int:pk>/delete/',   views.branch_delete_view,    name='branch_delete'),
    path('businesses/<int:pk>/update/',     views.business_update_view,  name='business-update'),
    path('businesses/<int:pk>/delete/',     views.business_delete_view,  name='business-delete'),
    path('ledger/',                         views.ledger_view,           name='ledger'),
    path('ledger/record/',                  views.record_subscription_payment_view, name='ledger-record'),
    path('ledger/business/<int:pk>/',       views.business_ledger_detail_view,      name='ledger-business'),
    path('my-ledger/',                      views.my_ledger_view,                   name='my-ledger'),
    path('dashboard-data/',                 views.dashboard_data_view,              name='dashboard-data'),
    
    path('parties/',                        views.party_list_create_view,           name='party-list-create'),
    path('parties/<int:pk>/',               views.party_detail_view,                name='party-detail'),
    
    path('categories/',                     views.category_list_create_view,        name='category-list-create'),
    path('categories/<int:pk>/',            views.category_detail_view,             name='category-detail'),
    
    path('products/',                       views.product_list_create_view,         name='product-list-create'),
    path('products/export/',                views.product_export_view,              name='product-export'),
    path('products/<int:pk>/',              views.product_detail_view,              name='product-detail'),
    path('products/<int:pk>/stock-history/', views.stock_transaction_list_view,     name='product-stock-history'),
    path('products/<int:pk>/stock-adjust/', views.stock_adjust_view,                name='product-stock-adjust'),
    path('products/<int:pk>/stock-history/<int:tx_id>/', views.stock_transaction_detail_view, name='product-stock-history-detail'),
    
    # Warehouses & Transfers
    path('warehouses/',                     views.warehouse_list_create_view,       name='warehouse-list-create'),
    path('warehouses/<int:pk>/',            views.warehouse_detail_view,            name='warehouse-detail'),
    path('warehouses/<int:pk>/stock/',      views.warehouse_stock_view,             name='warehouse-stock'),
    path('warehouses/transfer/',            views.stock_transfer_view,              name='stock-transfer'),
    path('warehouses/stock-check/',         views.stock_check_view,                 name='warehouse-stock-check'),

    path('setup/uoms/',                     views.uom_list_view,                    name='uom-list'),

    # ─── Sales ─────────────────────────────────────────────────────────────────
    path('sales/create/',                   sales_views.create_sales_order,         name='sales-create'),
    path('sales/form-data/',                sales_views.sales_form_data,            name='sales-form-data'),
    path('sales/',                          sales_views.list_sales_orders,          name='sales-list'),
    path('sales/<int:pk>/',                 sales_views.sales_order_detail,         name='sales-detail'),
    path('sales/<int:pk>/status/',          sales_views.update_sales_order_status,  name='sales-status-update'),
    path('sales/<int:pk>/edit/',            sales_views.update_sales_order,         name='sales-edit'),
    path('sales/<int:pk>/full-edit/',       sales_views.full_update_sales_order,    name='sales-full-edit'),

    # ─── Purchases ─────────────────────────────────────────────────────────────
    path('purchase/create/',                purchase_views.create_purchase_order,   name='purchase-create'),
    path('purchase/form-data/',             purchase_views.purchase_form_data,      name='purchase-form-data'),
    path('purchase/',                       purchase_views.list_purchase_orders,    name='purchase-list'),
    path('purchase/<int:pk>/',              purchase_views.purchase_order_detail,   name='purchase-detail'),
    path('purchase/<int:pk>/status/',       purchase_views.update_purchase_order_status, name='purchase-status-update'),
    path('purchase/<int:pk>/edit/',         purchase_views.update_purchase_order,   name='purchase-edit'),

    # ─── Sales Returns ──────────────────────────────────────────────────────────
    path('sales/returns/',                  sales_views.list_sales_returns,         name='sales-return-list'),
    path('sales/returns/create/',           sales_views.create_sales_return,        name='sales-return-create'),
    path('sales/returns/<int:pk>/',         sales_views.sales_return_detail,        name='sales-return-detail'),
    path('sales/returns/<int:pk>/status/',  sales_views.update_sales_return_status, name='sales-return-status-update'),
    path('sales/returns/<int:pk>/edit/',    sales_views.full_update_sales_return,   name='sales-return-edit'),

    # ─── Purchase Returns ────────────────────────────────────────────────────────
    path('purchase/returns/',               purchase_views.list_purchase_returns,         name='purchase-return-list'),
    path('purchase/returns/create/',        purchase_views.create_purchase_return,        name='purchase-return-create'),
    path('purchase/returns/<int:pk>/',      purchase_views.purchase_return_detail,        name='purchase-return-detail'),
    path('purchase/returns/<int:pk>/status/', purchase_views.update_purchase_return_status, name='purchase-return-status-update'),
    path('purchase/returns/<int:pk>/edit/',   purchase_views.full_update_purchase_return,   name='purchase-return-edit'),

    # ─── Finance ────────────────────────────────────────────────────────────────
    path('finance/accounts/',                  finance_views.list_bank_accounts,   name='finance-accounts'),
    path('finance/accounts/create/',           finance_views.create_bank_account, name='finance-accounts-create'),
    path('finance/accounts/<int:pk>/',         finance_views.get_bank_account,    name='finance-accounts-detail'),
    path('finance/accounts/<int:pk>/update/',  finance_views.update_bank_account, name='finance-accounts-update'),
    path('finance/accounts/<int:pk>/ledger/',  finance_views.account_ledger,       name='finance-accounts-ledger'),
    path('finance/parties/',                   finance_views.list_parties_ledger,   name='finance-parties-list'),
    path('finance/parties/<int:pk>/ledger/',   finance_views.get_party_ledger,      name='finance-parties-ledger'),
]
