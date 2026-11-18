
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../components/layout/DashboardLayout';

const WORKSPACES = {
  automotive: {
    name: 'Automotive',
    description:
      'Manage parts, inventory, suppliers, manufacturers, vehicles and stock movements.',
    icon: '🔧',
    path: '/automotive',
  },
  food_service: {
    name: 'Food & Beverage',
    description:
      'Manage your menu, point of sale, orders, kitchen, ingredients and recipes.',
    icon: '🍽️',
    path: '/food/dashboard',
  },
};

export default function WorkspaceHome() {
  const { selectedBusiness } = useWorkspace();
  const navigate = useNavigate();

  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadWorkspaces() {
      if (!selectedBusiness?.id) {
        setWorkspaces([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      const { data, error: queryError } = await supabase
        .from('business_industries')
        .select('industry_key')
        .eq('business_id', selectedBusiness.id)
        .eq('active', true)
        .order('industry_key');

      if (!mounted) return;

      if (queryError) {
        console.error('Workspace loading failed:', queryError);
        setError('Unable to load your enabled workspaces.');
        setWorkspaces([]);
        setLoading(false);
        return;
      }

      const enabled = (data || [])
        .filter(item => WORKSPACES[item.industry_key])
        .map(item => ({
          key: item.industry_key,
          ...WORKSPACES[item.industry_key],
        }));

      setWorkspaces(enabled);
      setLoading(false);

      if (enabled.length === 1) {
        navigate(enabled[0].path, { replace: true });
      }
    }

    loadWorkspaces();

    return () => {
      mounted = false;
    };
  }, [selectedBusiness?.id, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-amber-500" />
          <p className="text-sm text-gray-500">
            Loading your workspaces...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
        <h2 className="font-semibold">Workspace loading failed</h2>
        <p className="mt-2 text-sm">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!workspaces.length) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">
          No workspaces enabled
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          This business does not currently have any active workspaces.
          Contact your business administrator to configure them.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <p className="text-sm font-medium uppercase tracking-wider text-amber-600">
          Business workspace
        </p>

        <h1 className="mt-2 text-3xl font-bold text-gray-900">
          {selectedBusiness?.name || 'Your business'}
        </h1>

        <p className="mt-2 max-w-2xl text-gray-500">
          Select a workspace to continue managing your business operations.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {workspaces.map(workspace => (
          <button
            key={workspace.key}
            type="button"
            onClick={() => navigate(workspace.path)}
            className="group rounded-2xl border border-gray-200 bg-white p-7 text-left shadow-sm transition hover:-translate-y-1 hover:border-amber-400 hover:shadow-lg"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-amber-50 text-3xl">
                {workspace.icon}
              </div>

              <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                Enabled
              </span>
            </div>

            <h2 className="mt-6 text-xl font-bold text-gray-900 group-hover:text-amber-600">
              {workspace.name}
            </h2>

            <p className="mt-2 min-h-12 text-sm leading-6 text-gray-500">
              {workspace.description}
            </p>

            <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-amber-600">
              Open workspace <span aria-hidden="true">→</span>
            </div>
          </button>
        ))}
      </div>

      <p className="mt-8 text-xs text-gray-400">
        BlaQsWatch · Business operations management
      </p>
    </div>
  );
}
