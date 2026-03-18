import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import AdminLayout from './AdminLayout';
import Businesses from './Businesses';
import CreateBusiness from './CreateBusiness';
import EditBusiness from './EditBusiness';
import Ledger from './Ledger';
import BusinessLedger from './BusinessLedger';
import BusinessDashboard from './BusinessDashboard';
import CreateBranch from './CreateBranch';
import EditBranch from './EditBranch';
import BusinessLayout from './BusinessLayout';
import PlaceholderPage from './PlaceholderPage';
import ProtectedRoute from './ProtectedRoute';
import Parties from './Parties';
import Categories from './Categories';
import Products from './Products';
import StockStatus from './StockStatus';
import NewSaleOrder from './NewSaleOrder';
import SalesOrders from './SalesOrders';
import EditSaleOrder from './EditSaleOrder';
import SalesReturns from './SalesReturns';
import NewSalesReturn from './NewSalesReturn';
import EditSalesReturn from './EditSalesReturn';

import Warehouses from './Warehouses';
import StockTransfer from './StockTransfer';

import PurchaseOrders from './PurchaseOrders';
import NewPurchaseOrder from './NewPurchaseOrder';
import EditPurchaseOrder from './EditPurchaseOrder';
import PurchaseReturns from './PurchaseReturns';
import NewPurchaseReturn from './NewPurchaseReturn';
import EditPurchaseReturn from './EditPurchaseReturn';
import BankAccounts from './BankAccounts';
import NewBankAccount from './NewBankAccount';
import EditBankAccount from './EditBankAccount';
import BankAccountDetails from './BankAccountDetails';
import PartyLedgers from './PartyLedgers';
import PartyLedgerDetails from './PartyLedgerDetails';

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />

        {/* Superuser admin area — wrapped in sidebar layout */}
        <Route element={
          <ProtectedRoute requireSuperuser>
            <AdminLayout />
          </ProtectedRoute>
        }>
          <Route path="/"                    element={<Businesses />} />
          <Route path="/businesses/new"      element={<CreateBusiness />} />
          <Route path="/businesses/:id/edit" element={<EditBusiness />} />
          <Route path="/ledger"              element={<Ledger />} />
          <Route path="/businesses/:id/ledger" element={<BusinessLedger />} />
        </Route>

        {/* Business user routes */}
        <Route element={
          <ProtectedRoute>
            <BusinessLayout />
          </ProtectedRoute>
        }>
          <Route path="/business-dashboard" element={<BusinessDashboard />} />
          <Route path="/branches/new"       element={<CreateBranch />} />
          <Route path="/branches/edit/:id"  element={<EditBranch />} />
          
          {/* Placeholder Routes for Sidebar Sections */}
          <Route path="/parties/customers"      element={<Parties type="CUSTOMER" />} />
          <Route path="/parties/vendors"        element={<Parties type="VENDOR" />} />
          
          <Route path="/catalog/categories"     element={<Categories />} />
          <Route path="/catalog/products"       element={<Products />} />
          
          <Route path="/inventory/stock"        element={<StockStatus />} />
          <Route path="/inventory/warehouses"   element={<Warehouses />} />
          <Route path="/inventory/transfer"     element={<StockTransfer />} />
          
          <Route path="/sales/new"              element={<NewSaleOrder />} />
          <Route path="/sales/invoices"         element={<SalesOrders />} />
          <Route path="/sales/edit/:id"         element={<EditSaleOrder />} />
          <Route path="/sales/returns"          element={<SalesReturns />} />
          <Route path="/sales/returns/new"      element={<NewSalesReturn />} />
          <Route path="/sales/returns/edit/:id" element={<EditSalesReturn />} />
          
          <Route path="/purchase"               element={<PurchaseOrders />} />
          <Route path="/purchase/new"           element={<NewPurchaseOrder />} />
          <Route path="/purchase/edit/:id"      element={<EditPurchaseOrder />} />
          
          <Route path="/purchasing/returns"          element={<PurchaseReturns />} />
          <Route path="/purchasing/returns/new"      element={<NewPurchaseReturn />} />
          <Route path="/purchasing/returns/edit/:id" element={<EditPurchaseReturn />} />
          
          <Route path="/finance/accounts"       element={<BankAccounts />} />
          <Route path="/finance/accounts/new"   element={<NewBankAccount />} />
          <Route path="/finance/accounts/edit/:id" element={<EditBankAccount />} />
          <Route path="/finance/accounts/view/:id" element={<BankAccountDetails />} />
          <Route path="/finance/movements"      element={<PlaceholderPage />} />
          <Route path="/finance/cash-in"        element={<PlaceholderPage />} />
          <Route path="/finance/cash-out"       element={<PlaceholderPage />} />
          <Route path="/finance/ledger"         element={<PartyLedgers />} />
          <Route path="/finance/ledger/view/:id" element={<PartyLedgerDetails />} />
          <Route path="/finance/reports"        element={<PlaceholderPage />} />
          
          <Route path="/staff"                  element={<PlaceholderPage />} />
          <Route path="/activity-logs"          element={<PlaceholderPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}
