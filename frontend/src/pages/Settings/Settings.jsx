
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  BuildingStorefrontIcon,
  ShieldCheckIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useInventoryData } from '../../context/InventoryContext';

const DEFAULT_SETTINGS = {
  businessName: '',
  currency: 'ZAR',
  lowStockDefault: 5,
};

export default function Settings() {
  const d = useInventoryData();

  const [form, setForm] = useState({
    ...DEFAULT_SETTINGS,
    ...d.settings,
  });

  const [saving, setSaving] = useState(false);

  const isLoading = Boolean(d.loading);
  const hasError = Boolean(d.error);
  const hasBusiness = Boolean(d.businessId);

  // Keep the form in sync when the selected business changes
  // or when its settings finish loading from Supabase.
  useEffect(() => {
    setForm({
      ...DEFAULT_SETTINGS,
      ...d.settings,
    });
  }, [
    d.businessId,
    d.settings.businessName,
    d.settings.currency,
    d.settings.lowStockDefault,
  ]);

  function updateField(field, value) {
    setForm(current => ({
      ...current,
      [field]: value,
    }));
  }

  async function save(e) {
    e.preventDefault();

    if (!hasBusiness) {
      toast.error('Select a business before saving settings.');
      return;
    }

    if (!form.businessName.trim()) {
      toast.error('Business name is required.');
      return;
    }

    const threshold = Number(form.lowStockDefault);

    if (!Number.isInteger(threshold) || threshold < 0) {
      toast.error(
        'Enter a valid whole-number low-stock threshold.'
      );
      return;
    }

    setSaving(true);

    try {
      await d.updateSettings({
        businessName: form.businessName.trim(),
        currency: form.currency,
        lowStockDefault: threshold,
      });

      toast.success('Business settings saved successfully.');

    } catch (err) {
      console.error('Settings save failed:', err);

      toast.error(
        err.message || 'Unable to save business settings.'
      );

    } finally {
      setSaving(false);
    }
  }

  async function reloadSettings() {
    try {
      await d.refresh();
      toast.success('Workspace data refreshed.');
    } catch (err) {
      toast.error(
        err.message || 'Unable to refresh workspace data.'
      );
    }
  }

  const canSaveSettings =
    hasBusiness &&
    !isLoading &&
    !saving &&
    Boolean(form.businessName.trim());

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">WORKSPACE CONFIGURATION</p>
          <h1>Settings</h1>
          <p className="muted">
            Configure your business identity and inventory defaults.
          </p>
        </div>
      </div>

      <div className="two-column-layout">
        <section className="panel form-panel">
          <div className="panel-heading">
            <div>
              <h2>
                <BuildingStorefrontIcon className="inline-heading-icon" />
                Business settings
              </h2>
              <p>
                These details personalise your inventory workspace.
              </p>
            </div>
          </div>

          <form onSubmit={save}>
            <label className="field">
              Business / workspace name
              <input
                type="text"
                value={form.businessName || ''}
                onChange={e =>
                  updateField('businessName', e.target.value)
                }
                placeholder="Enter your business name"
                required
                disabled={!hasBusiness || isLoading || saving}
              />
            </label>

            <label className="field">
              Currency
              <select
                value={form.currency || 'ZAR'}
                onChange={e =>
                  updateField('currency', e.target.value)
                }
                disabled={!hasBusiness || isLoading || saving}
              >
                <option value="ZAR">
                  South African Rand (ZAR)
                </option>
                <option value="USD">
                  US Dollar (USD)
                </option>
                <option value="GBP">
                  British Pound (GBP)
                </option>
                <option value="EUR">
                  Euro (EUR)
                </option>
              </select>
            </label>

            <label className="field">
              Default low-stock threshold
              <input
                type="number"
                min="0"
                step="1"
                value={form.lowStockDefault ?? 5}
                onChange={e =>
                  updateField(
                    'lowStockDefault',
                    e.target.value === ''
                      ? ''
                      : Number(e.target.value)
                  )
                }
                disabled={!hasBusiness || isLoading || saving}
              />
            </label>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={!canSaveSettings}
            >
              {saving ? (
                <>
                  <ArrowPathIcon className="inline-heading-icon animate-spin" />
                  Saving settings...
                </>
              ) : (
                'Save settings'
              )}
            </button>

            <p className="muted">
              Changes are saved to the selected business in Supabase
              and loaded again when you return to this workspace.
            </p>

            {!hasBusiness && (
              <div className="tip-box">
                <strong>No business selected</strong>
                <p>
                  Select a business before changing its workspace settings.
                </p>
              </div>
            )}
          </form>
        </section>

        <section className="panel form-panel">
          <div className="panel-heading">
            <div>
              <h2>
                <ShieldCheckIcon className="inline-heading-icon" />
                Data &amp; integration
              </h2>
              <p>
                Current inventory connection and loading status.
              </p>
            </div>
          </div>

          <div className="integration-status">
            {isLoading ? (
              <>
                <ClockIcon className="status-icon" />
                <div>
                  <strong>Loading workspace data</strong>
                  <small>
                    Retrieving inventory and business settings from Supabase.
                  </small>
                </div>
              </>
            ) : hasError ? (
              <>
                <ExclamationCircleIcon className="status-icon" />
                <div>
                  <strong>Unable to load workspace</strong>
                  <small>
                    Supabase returned an error while loading workspace data.
                  </small>
                </div>
              </>
            ) : hasBusiness ? (
              <>
                <CheckCircleIcon className="status-icon" />
                <div>
                  <strong>Supabase connection active</strong>
                  <small>
                    Business settings and inventory are connected to your
                    selected workspace.
                  </small>
                </div>
              </>
            ) : (
              <>
                <ExclamationCircleIcon className="status-icon" />
                <div>
                  <strong>No business selected</strong>
                  <small>
                    Select a workspace to load its inventory and settings.
                  </small>
                </div>
              </>
            )}
          </div>

          {hasError && (
            <div className="tip-box">
              <strong>Workspace loading error</strong>
              <p>{String(d.error)}</p>
            </div>
          )}

          {isLoading && (
            <div className="tip-box">
              <p>
                Please wait while workspace records are retrieved from
                Supabase.
              </p>
            </div>
          )}

          <button
            type="button"
            className="btn btn-secondary"
            onClick={reloadSettings}
            disabled={isLoading || !hasBusiness}
          >
            <ArrowPathIcon className="inline-heading-icon" />
            Refresh workspace data
          </button>
        </section>
      </div>
    </>
  );
}
