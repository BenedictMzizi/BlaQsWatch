
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet
} from 'react-router-dom';

import DashboardLayout, {
  useWorkspace
} from '../components/layout/DashboardLayout';

import PlatformLayout from '../components/layout/PlatformLayout';
import FoodServiceLayout from '../components/layout/FoodServiceLayout';

import { InventoryProvider } from '../context/InventoryContext';

import Login from '../pages/Login/Login';
import AuthCallback from '../pages/AuthCallback/AuthCallback';
import PasswordReset from '../pages/PasswordReset/PasswordReset';

import Dashboard from '../pages/Dashboard/Dashboard';
import Parts from '../pages/Parts/Parts';
import StockControl from '../pages/Inventory/Inventory';
import InventoryOverview from '../components/inventory/Invantory';
import Warehouses from '../pages/Warehouses/Warehouses';
import Vehicles from '../pages/Vehicles/Vehicles';
import Manufacturers from '../pages/Manufacturers/Manufacturers';
import Suppliers from '../pages/Suppliers/Suppliers';
import Categories from '../pages/Categories/Categories';
import Reports from '../pages/Reports/Reports';
import Settings from '../pages/Settings/Settings';
import PartDetails from '../pages/PartDetails/PartDetails';

import PlatformRoute from './PlatformRoute';
import CompanyAdminRoute from './CompanyAdminRoute';
import ProtectedRoute from './ProtectedRoute';

import PlatformDashboard from '../pages/Platform/PlatformDashboard';
import CompanyManagement from '../pages/Platform/CompanyManagement';
import EmployeeManagement from '../pages/Platform/EmployeeManagement';
import SubscriptionManagement from '../pages/Platform/SubscriptionManagement';
import PlatformMessages from '../pages/Platform/PlatformMessages';

import CompanyEmployeeManagement from '../pages/Company/EmployeeManagement';
import CompanySubscription from '../pages/Company/CompanySubscription';

import Messages from '../pages/Messages/Messages';
import PublicSubscriptions from '../pages/Subscriptions/PublicSubscriptions';

import FoodServicePage from '../pages/FoodService/FoodServicePage';
import WorkspaceHome from '../pages/WorkspaceHome/WorkspaceHome';

function AutomotiveWorkspace() {
  const {
    selectedBusiness,
    enabledWorkspaces,
    loading
  } = useWorkspace();

  if (loading) {
    return null;
  }

  if (
    !selectedBusiness ||
    !enabledWorkspaces.includes('automotive')
  ) {
    return <Navigate to="/" replace />;
  }

  return (
    <InventoryProvider businessId={selectedBusiness.id}>
      <Outlet />
    </InventoryProvider>
  );
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/subscriptions" element={<PublicSubscriptions />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/auth/reset-password" element={<PasswordReset />} />

        {/* Protected application routes */}
        <Route element={<ProtectedRoute />}>
          {/* Platform administration */}
          <Route path="/platform" element={<PlatformRoute />}>
            <Route element={<PlatformLayout />}>
              <Route index element={<PlatformDashboard />} />
              <Route path="companies" element={<CompanyManagement />} />
              <Route path="employees" element={<EmployeeManagement />} />
              <Route path="subscriptions" element={<SubscriptionManagement />} />
              <Route path="messages" element={<PlatformMessages />} />
            </Route>
          </Route>

          {/* Shared company layout */}
          <Route element={<DashboardLayout />}>
            <Route index element={<WorkspaceHome />} />

            {/* Automotive workspace */}
            <Route element={<AutomotiveWorkspace />}>
              <Route path="automotive" element={<Dashboard />} />
              <Route path="parts" element={<Parts />} />
              <Route path="parts/:id" element={<PartDetails />} />
              <Route path="inventory" element={<InventoryOverview />} />
              <Route path="stock-control" element={<StockControl />} />
              <Route path="warehouses" element={<Warehouses />} />
              <Route path="vehicles" element={<Vehicles />} />
              <Route path="manufacturers" element={<Manufacturers />} />
              <Route path="suppliers" element={<Suppliers />} />
              <Route path="categories" element={<Categories />} />
              <Route path="reports" element={<Reports />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            {/* Food & Beverage workspace */}
            <Route path="food" element={<FoodServiceLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<FoodServicePage view="dashboard" />} />
              <Route path="menu" element={<FoodServicePage view="menu" />} />
              <Route path="tables" element={<FoodServicePage view="tables" />} />
              <Route path="pos" element={<FoodServicePage view="pos" />} />
              <Route path="orders" element={<FoodServicePage view="orders" />} />
              <Route path="kitchen" element={<FoodServicePage view="kitchen" />} />
              <Route path="ingredients" element={<FoodServicePage view="ingredients" />} />
              <Route path="recipes" element={<FoodServicePage view="recipes" />} />
              <Route path="reports" element={<FoodServicePage view="reports" />} />
              <Route path="settings" element={<FoodServicePage view="settings" />} />
            </Route>

            {/* Shared company features */}
            <Route path="messages" element={<Messages />} />

            {/* Company administrator routes */}
            <Route element={<CompanyAdminRoute />}>
              <Route path="employees" element={<CompanyEmployeeManagement />} />
              <Route path="subscription" element={<CompanySubscription />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
