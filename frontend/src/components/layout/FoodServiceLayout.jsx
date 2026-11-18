import { Navigate, Outlet } from 'react-router-dom';
import { useWorkspace } from './DashboardLayout';

export default function FoodServiceLayout() {
  const {
    selectedBusiness,
    enabledWorkspaces,
    loading
  } = useWorkspace();

  if (loading) {
    return null;
  }

  if (!selectedBusiness || !enabledWorkspaces.includes('food_service')) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
