import { Navigate, Outlet } from 'react-router-dom';
import { useWorkspace } from '../components/layout/DashboardLayout';

export default function CompanyAdminRoute() {
  const { loading, selectedBusiness, role } = useWorkspace();

  if (loading) {
    return <div className="auth-loading" role="status">Checking company permissions...</div>;
  }

  if (!selectedBusiness || role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
