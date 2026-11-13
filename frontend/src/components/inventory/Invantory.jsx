
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowPathIcon,
  CubeIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../components/layout/DashboardLayout';

function formatCurrency(value) {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
  }).format(Number(value || 0));
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-ZA');
}

function StatusBadge({ status }) {
  const normalized = String(status || 'UNKNOWN').toUpperCase();

  const styles = {
    IN_STOCK: 'bg-green-100 text-green-700',
    LOW_STOCK: 'bg-amber-100 text-amber-700',
    OUT_OF_STOCK: 'bg-red-100 text-red-700',
    UNKNOWN: 'bg-slate-100 text-slate-600',
  };

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${styles[normalized] || styles.UNKNOWN}`}>
      {normalized.replace(/_/g, ' ')}
    </span>
  );
}

export default function Inventory() {
  const { selectedBusinessId } = useWorkspace();

  const [inventory, setInventory] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadInventory = useCallback(async (refresh = false) => {
    if (!selectedBusinessId) {
      setInventory([]);
      setError('No business is currently selected.');
      setLoading(false);
      return;
    }

    refresh ? setRefreshing(true) : setLoading(true);
    setError('');

    try {
      const { data, error: queryError } = await supabase
        .from('stockwise_inventory_summary')
        .select(`
          part_id,
          business_id,
          part_number,
          oem_number,
          description,
          category_id,
          manufacturer_id,
          supplier_id,
          barcode,
          product_minimum_stock,
          total_quantity,
          location_count,
          low_stock_locations,
          empty_locations,
          stock_status,
          inventory_cost,
          inventory_retail,
          buy_price,
          sell_price,
          created_at,
          updated_at
        `)
        .eq('business_id', selectedBusinessId)
        .order('part_number', { ascending: true });

      if (queryError) throw queryError;

      setInventory(data || []);
    } catch (err) {
      console.error('Inventory loading failed:', err);
      setInventory([]);
      setError(err.message || 'Unable to load inventory records.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedBusinessId]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const filteredInventory = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return inventory;

    return inventory.filter((item) =>
      [
        item.part_number,
        item.oem_number,
        item.description,
        item.barcode,
        item.stock_status,
      ].some((value) => String(value || '').toLowerCase().includes(term))
    );
  }, [inventory, search]);

  const totals = useMemo(() => ({
    parts: inventory.length,
    quantity: inventory.reduce(
      (sum, item) => sum + Number(item.total_quantity || 0),
      0
    ),
    lowStock: inventory.filter(
      (item) => Number(item.low_stock_locations || 0) > 0
    ).length,
    outOfStock: inventory.filter(
      (item) => Number(item.total_quantity || 0) === 0
    ).length,
  }), [inventory]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
          <p className="mt-1 text-sm text-slate-500">
            Live stock overview for your selected business.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadInventory(true)}
          disabled={loading || refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <ArrowPathIcon className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Parts</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {loading ? '—' : formatNumber(totals.parts)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Total quantity</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {loading ? '—' : formatNumber(totals.quantity)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Low-stock parts</p>
          <p className="mt-2 text-3xl font-bold text-amber-600">
            {loading ? '—' : formatNumber(totals.lowStock)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Out-of-stock parts</p>
          <p className="mt-2 text-3xl font-bold text-red-600">
            {loading ? '—' : formatNumber(totals.outOfStock)}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Stock records</h2>
            <p className="mt-1 text-sm text-slate-500">
              Retrieved directly from StockWise.
            </p>
          </div>

          <div className="relative w-full sm:max-w-xs">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search part number, OEM or barcode..."
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        {error && (
          <div className="m-4 flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Inventory could not be loaded</p>
              <p className="mt-1">{error}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center py-16">
            <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-600" />
            <p className="mt-3 text-sm text-slate-500">Loading live inventory...</p>
          </div>
        ) : !error && filteredInventory.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <CubeIcon className="mx-auto h-12 w-12 text-slate-300" />
            <h3 className="mt-4 font-semibold text-slate-800">
              {search ? 'No matching parts found' : 'No inventory records found'}
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              {search
                ? 'Try another search term.'
                : 'There are currently no inventory records for this business.'}
            </p>
          </div>
        ) : !error && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {[
                    'Part number',
                    'OEM number',
                    'Description',
                    'Quantity',
                    'Locations',
                    'Minimum stock',
                    'Stock status',
                    'Inventory cost',
                    'Inventory retail',
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredInventory.map((item) => (
                  <tr key={item.part_id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-slate-900">
                      {item.part_number || '—'}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                      {item.oem_number || '—'}
                    </td>
                    <td className="min-w-56 px-5 py-4 text-sm text-slate-700">
                      {item.description || '—'}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-slate-900">
                      {formatNumber(item.total_quantity)}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-700">
                      {formatNumber(item.location_count)}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-700">
                      {formatNumber(item.product_minimum_stock)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <StatusBadge status={item.stock_status} />
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-700">
                      {formatCurrency(item.inventory_cost)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-700">
                      {formatCurrency(item.inventory_retail)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && filteredInventory.length > 0 && (
          <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-500">
            Showing {filteredInventory.length} of {inventory.length} parts
          </div>
        )}
      </div>
    </div>
  );
}
