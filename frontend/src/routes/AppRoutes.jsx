import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import DashboardLayout from '../components/layout/DashboardLayout';
import PlatformLayout from '../components/layout/PlatformLayout';

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
import PlatformDashboard from '../pages/Platform/PlatformDashboard';
import CompanyManagement from '../pages/Platform/CompanyManagement';
import EmployeeManagement from '../pages/Platform/EmployeeManagement';
import ProtectedRoute from './ProtectedRoute';

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public authentication routes */}
        <Route path="/login" element={<Login />} />
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
            </Route>
          </Route>

          {/* Company workspace */}
          <Route element={<DashboardLayout />}>
            <Route index element={<Dashboard />} />
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
        </Route>

        {/* Unknown routes */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}