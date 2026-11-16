
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
    IN_STOCK: 'healthy',
    LOW_STOCK: 'low',
    OUT_OF_STOCK: 'out',
    UNKNOWN: '',
  };

  return (
    <span className={`stock-pill ${styles[normalized] || ''}`}>
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
      setRefreshing(false);
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
    <div>
      <div className="page-heading">
        <div>
          <p className="eyebrow">INVENTORY MANAGEMENT</p>
          <h1>Inventory</h1>
          <p className="muted">
            Live stock overview for your selected business.
          </p>
        </div>

        <div className="heading-actions">
          <button
            type="button"
            onClick={() => loadInventory(true)}
            disabled={loading || refreshing}
            className="btn btn-secondary"
          >
            <ArrowPathIcon
              style={{
                width: 18,
                height: 18,
                animation: refreshing ? 'spin 1s linear infinite' : 'none',
              }}
            />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Parts</div>
          <div className="stat-value">
            {loading ? '—' : formatNumber(totals.parts)}
          </div>
          <div className="stat-detail">Registered catalogue parts</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Total quantity</div>
          <div className="stat-value">
            {loading ? '—' : formatNumber(totals.quantity)}
          </div>
          <div className="stat-detail">Units across all locations</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Low-stock parts</div>
          <div className="stat-value" style={{ color: 'var(--bw-gold-light)' }}>
            {loading ? '—' : formatNumber(totals.lowStock)}
          </div>
          <div className="stat-detail">Parts requiring attention</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Out-of-stock parts</div>
          <div className="stat-value" style={{ color: '#e58b83' }}>
            {loading ? '—' : formatNumber(totals.outOfStock)}
          </div>
          <div className="stat-detail">Parts with zero quantity</div>
        </div>
      </div>

      <div className="panel list-panel">
        <div className="panel-heading">
          <div>
            <h2>Stock records</h2>
            <p className="muted">
              Retrieved directly from StockWise.
            </p>
          </div>

          <div className="search-field" style={{ width: '100%', maxWidth: '360px' }}>
            <MagnifyingGlassIcon />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search part number, OEM or barcode..."
            />
          </div>
        </div>

        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              margin: '16px',
              padding: '15px',
              borderRadius: '9px',
              border: '1px solid rgba(210, 100, 90, 0.4)',
              background: 'rgba(150, 45, 40, 0.12)',
              color: '#e58b83',
              fontSize: '13px',
            }}
          >
            <ExclamationTriangleIcon
              style={{ width: 21, height: 21, flexShrink: 0 }}
            />
            <div>
              <strong>Inventory could not be loaded</strong>
              <p style={{ marginTop: '5px' }}>{error}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '64px 20px',
              gap: '12px',
            }}
          >
            <ArrowPathIcon
              style={{
                width: 32,
                height: 32,
                color: 'var(--bw-gold)',
                animation: 'spin 1s linear infinite',
              }}
            />
            <p className="muted">Loading live inventory...</p>
          </div>
        ) : !error && filteredInventory.length === 0 ? (
          <div
            style={{
              padding: '64px 20px',
              textAlign: 'center',
            }}
          >
            <CubeIcon
              style={{
                width: 48,
                height: 48,
                margin: '0 auto',
                color: 'var(--bw-gold-dark)',
              }}
            />
            <h3 style={{ marginTop: '16px', color: 'var(--bw-white)' }}>
              {search ? 'No matching parts found' : 'No inventory records found'}
            </h3>
            <p className="muted" style={{ marginTop: '8px' }}>
              {search
                ? 'Try another search term.'
                : 'There are currently no inventory records for this business.'}
            </p>
          </div>
        ) : !error && (
          <div className="table-wrap">
            <table>
              <thead>
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
                    <th key={heading}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredInventory.map((item) => (
                  <tr key={item.part_id}>
                    <td style={{ fontWeight: 700, color: 'var(--bw-gold-light)' }}>
                      {item.part_number || '—'}
                    </td>

                    <td>
                      {item.oem_number || '—'}
                    </td>

                    <td style={{ minWidth: '220px' }}>
                      {item.description || '—'}
                    </td>

                    <td className="qty-cell">
                      {formatNumber(item.total_quantity)}
                    </td>

                    <td>
                      {formatNumber(item.location_count)}
                    </td>

                    <td>
                      {formatNumber(item.product_minimum_stock)}
                    </td>

                    <td>
                      <StatusBadge status={item.stock_status} />
                    </td>

                    <td className="price-cell">
                      {formatCurrency(item.inventory_cost)}
                    </td>

                    <td className="price-cell">
                      {formatCurrency(item.inventory_retail)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && filteredInventory.length > 0 && (
          <div className="panel-foot">
            Showing {formatNumber(filteredInventory.length)} of{' '}
            {formatNumber(inventory.length)} parts
            <span>
              {formatNumber(totals.quantity)} units in stock
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
