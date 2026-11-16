import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import '../../styles/subscriptions.css';

const blankPlan = {
  id: null,
  code: '',
  name: '',
  description: '',
  monthly_price_cents: '',
  annual_price_cents: '',
  currency: 'ZAR',
  is_active: true,
  is_published: false,
  is_highlighted: false,
  sort_order: 0,
  cta_text: 'Get started',
  featuresText: '[]',
};

const blankAddon = {
  id: null,
  code: '',
  name: '',
  description: '',
  monthly_price_cents: '',
  one_time_price_cents: '',
  currency: 'ZAR',
  requires_quote: false,
  is_active: true,
  sort_order: 0,
};

const toCents = value =>
  value === '' || value == null
    ? null
    : Math.round(Number(value) * 100);

const fromCents = value =>
  value == null ? '' : (Number(value) / 100).toFixed(2);

const normalizeCode = value =>
  value.trim().toLowerCase().replace(/\s+/g, '_');

export default function SubscriptionManagement() {
  const [plans, setPlans] = useState([]);
  const [addons, setAddons] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [tab, setTab] = useState('plans');
  const [planForm, setPlanForm] = useState(null);
  const [addonForm, setAddonForm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);

    const [planResult, addonResult, subscriptionResult] =
      await Promise.all([
        supabase
          .from('subscription_plans')
          .select('*, subscription_plan_features(*)')
          .order('sort_order'),

        supabase
          .from('subscription_addons')
          .select('*')
          .order('sort_order'),

        supabase
          .from('company_subscriptions')
          .select(`
            id,
            business_id,
            plan_id,
            status,
            billing_interval,
            currency,
            custom_price_cents,
            trial_ends_at,
            current_period_end,
            origin,
            created_at,
            businesses(name),
            subscription_plans(name, code)
          `)
          .order('created_at', { ascending: false }),
      ]);

    const failure =
      planResult.error ||
      addonResult.error ||
      subscriptionResult.error;

    if (failure) {
      toast.error(failure.message);
    }

    setPlans(planResult.data || []);
    setAddons(addonResult.data || []);
    setSubscriptions(subscriptionResult.data || []);

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function editPlan(plan) {
    if (!plan) {
      setPlanForm({ ...blankPlan });
      return;
    }

    const features = (plan.subscription_plan_features || [])
      .map(({
        feature_key,
        label,
        description,
        value,
        is_visible,
        display_order,
      }) => ({
        feature_key,
        label,
        description,
        value,
        is_visible,
        display_order,
      }));

    setPlanForm({
      ...plan,
      monthly_price_cents: fromCents(plan.monthly_price_cents),
      annual_price_cents: fromCents(plan.annual_price_cents),
      featuresText: JSON.stringify(features, null, 2),
    });
  }

  function editAddon(addon) {
    if (!addon) {
      setAddonForm({ ...blankAddon });
      return;
    }

    setAddonForm({
      ...addon,
      monthly_price_cents: fromCents(
        addon.monthly_price_cents
      ),
      one_time_price_cents: fromCents(
        addon.one_time_price_cents
      ),
    });
  }

  async function savePlan(event) {
    event.preventDefault();

    let features;

    try {
      features = JSON.parse(planForm.featuresText || '[]');

      if (!Array.isArray(features)) {
        throw new Error('Features must be a JSON array.');
      }

      features.forEach(feature => {
        if (
          !feature.feature_key ||
          !feature.label ||
          typeof feature.value !== 'object' ||
          feature.value === null ||
          Array.isArray(feature.value)
        ) {
          throw new Error(
            'Each feature needs feature_key, label and a JSON value object.'
          );
        }
      });
    } catch (error) {
      toast.error(error.message || 'Invalid feature JSON.');
      return;
    }

    setSaving(true);

    const {
      featuresText,
      subscription_plan_features,
      created_at,
      updated_at,
      ...values
    } = planForm;

    const payload = {
      code: normalizeCode(values.code),
      name: values.name.trim(),
      description: values.description?.trim() || null,
      monthly_price_cents: toCents(
        values.monthly_price_cents
      ),
      annual_price_cents: toCents(
        values.annual_price_cents
      ),
      currency: values.currency.toUpperCase(),
      is_active: values.is_active,
      is_published: values.is_published,
      is_highlighted: values.is_highlighted,
      sort_order: Number(values.sort_order) || 0,
      cta_text: values.cta_text || 'Get started',
    };

    const planResult = values.id
      ? await supabase
          .from('subscription_plans')
          .update(payload)
          .eq('id', values.id)
          .select('id')
          .single()
      : await supabase
          .from('subscription_plans')
          .insert(payload)
          .select('id')
          .single();

    if (planResult.error) {
      toast.error(planResult.error.message);
      setSaving(false);
      return;
    }

    const planId = planResult.data.id;

    // Upsert the submitted features first. This avoids deleting all
    // existing features before we know the replacement rows are valid.
    const featureRows = features.map((feature, index) => ({
      plan_id: planId,
      feature_key: feature.feature_key,
      label: feature.label,
      description: feature.description || null,
      value: feature.value,
      is_visible: feature.is_visible !== false,
      display_order: Number(
        feature.display_order ?? index + 1
      ),
    }));

    if (featureRows.length) {
      const featureResult = await supabase
        .from('subscription_plan_features')
        .upsert(featureRows, {
          onConflict: 'plan_id,feature_key',
        });

      if (featureResult.error) {
        toast.error(
          `Plan saved, but features could not be saved: ${featureResult.error.message}`
        );
        setSaving(false);
        await load();
        return;
      }
    }

    // Remove only features that were deliberately omitted from the
    // edited feature list.
    const submittedKeys = features.map(f => f.feature_key);

    const existingResult = await supabase
      .from('subscription_plan_features')
      .select('id,feature_key')
      .eq('plan_id', planId);

    if (existingResult.error) {
      toast.error(
        `Plan saved, but existing features could not be checked: ${existingResult.error.message}`
      );
      setSaving(false);
      await load();
      return;
    }

    const staleIds = (existingResult.data || [])
      .filter(feature => !submittedKeys.includes(feature.feature_key))
      .map(feature => feature.id);

    if (staleIds.length) {
      const deleteResult = await supabase
        .from('subscription_plan_features')
        .delete()
        .in('id', staleIds);

      if (deleteResult.error) {
        toast.error(
          `Plan saved, but removed features could not be cleaned up: ${deleteResult.error.message}`
        );
        setSaving(false);
        await load();
        return;
      }
    }

    toast.success('Subscription plan saved.');
    setPlanForm(null);
    setSaving(false);
    await load();
  }

  async function saveAddon(event) {
    event.preventDefault();
    setSaving(true);

    const payload = {
      code: normalizeCode(addonForm.code),
      name: addonForm.name.trim(),
      description: addonForm.description?.trim() || null,
      monthly_price_cents: toCents(
        addonForm.monthly_price_cents
      ),
      one_time_price_cents: toCents(
        addonForm.one_time_price_cents
      ),
      currency: addonForm.currency.toUpperCase(),
      requires_quote: addonForm.requires_quote,
      is_active: addonForm.is_active,
      sort_order: Number(addonForm.sort_order) || 0,
    };

    const result = addonForm.id
      ? await supabase
          .from('subscription_addons')
          .update(payload)
          .eq('id', addonForm.id)
      : await supabase
          .from('subscription_addons')
          .insert(payload);

    if (result.error) {
      toast.error(result.error.message);
    } else {
      toast.success('Add-on saved.');
      setAddonForm(null);
      await load();
    }

    setSaving(false);
  }

  async function togglePublished(plan) {
    const { error } = await supabase
      .from('subscription_plans')
      .update({ is_published: !plan.is_published })
      .eq('id', plan.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(
        plan.is_published
          ? 'Plan unpublished.'
          : 'Plan published.'
      );
      await load();
    }
  }

  async function toggleAddon(addon) {
    const { error } = await supabase
      .from('subscription_addons')
      .update({ is_active: !addon.is_active })
      .eq('id', addon.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(
        addon.is_active
          ? 'Add-on deactivated.'
          : 'Add-on activated.'
      );
      await load();
    }
  }

  return (
    <div className="bw-subscription-admin">
      <header className="bw-admin-heading">
        <div>
          <span className="bw-eyebrow">
            Platform administration
          </span>
          <h1>Subscription management</h1>
          <p>
            Configure public plans, feature entitlements and optional
            services.
          </p>
        </div>

        <button
          type="button"
          className="bw-admin-refresh"
          onClick={load}
        >
          Refresh data
        </button>
      </header>

      <nav className="bw-admin-tabs">
        <button
          type="button"
          className={tab === 'plans' ? 'active' : ''}
          onClick={() => setTab('plans')}
        >
          Plans ({plans.length})
        </button>

        <button
          type="button"
          className={tab === 'addons' ? 'active' : ''}
          onClick={() => setTab('addons')}
        >
          Add-ons ({addons.length})
        </button>

        <button
          type="button"
          className={tab === 'subscriptions' ? 'active' : ''}
          onClick={() => setTab('subscriptions')}
        >
          Company subscriptions ({subscriptions.length})
        </button>
      </nav>

      {loading ? (
        <div className="bw-subscription-state">
          Loading subscription records…
        </div>
      ) : (
        <>
          {tab === 'plans' && (
            <>
              <div className="bw-admin-section-head">
                <h2>Subscription plans</h2>
                <button
                  type="button"
                  className="bw-gold-button"
                  onClick={() => editPlan(null)}
                >
                  Add plan
                </button>
              </div>

              <div className="bw-admin-table-wrap">
                <table className="bw-admin-table">
                  <thead>
                    <tr>
                      <th>Plan</th>
                      <th>Monthly</th>
                      <th>Annual</th>
                      <th>Features</th>
                      <th>Visibility</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {plans.map(plan => (
                      <tr key={plan.id}>
                        <td>
                          <strong>{plan.name}</strong>
                          <small>{plan.code}</small>
                        </td>

                        <td>
                          {plan.monthly_price_cents == null
                            ? 'Custom'
                            : `R${(
                                plan.monthly_price_cents / 100
                              ).toLocaleString('en-ZA')}`}
                        </td>

                        <td>
                          {plan.annual_price_cents == null
                            ? 'Custom'
                            : `R${(
                                plan.annual_price_cents / 100
                              ).toLocaleString('en-ZA')}`}
                        </td>

                        <td>
                          {plan.subscription_plan_features?.length || 0}
                        </td>

                        <td>
                          <span
                            className={`bw-status ${
                              plan.is_published ? 'published' : ''
                            }`}
                          >
                            {plan.is_published ? 'Published' : 'Hidden'}
                          </span>
                        </td>

                        <td className="bw-action-cell">
                          <button
                            type="button"
                            onClick={() => editPlan(plan)}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => togglePublished(plan)}
                          >
                            {plan.is_published
                              ? 'Unpublish'
                              : 'Publish'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'addons' && (
            <>
              <div className="bw-admin-section-head">
                <h2>Optional add-ons</h2>
                <button
                  type="button"
                  className="bw-gold-button"
                  onClick={() => editAddon(null)}
                >
                  Add add-on
                </button>
              </div>

              <div className="bw-admin-table-wrap">
                <table className="bw-admin-table">
                  <thead>
                    <tr>
                      <th>Add-on</th>
                      <th>Monthly</th>
                      <th>Once-off</th>
                      <th>Pricing</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {addons.map(addon => (
                      <tr key={addon.id}>
                        <td>
                          <strong>{addon.name}</strong>
                          <small>{addon.code}</small>
                        </td>

                        <td>
                          {addon.monthly_price_cents == null
                            ? '—'
                            : `R${(
                                addon.monthly_price_cents / 100
                              ).toLocaleString('en-ZA')}`}
                        </td>

                        <td>
                          {addon.one_time_price_cents == null
                            ? '—'
                            : `R${(
                                addon.one_time_price_cents / 100
                              ).toLocaleString('en-ZA')}`}
                        </td>

                        <td>
                          {addon.requires_quote
                            ? 'Quote required'
                            : 'Fixed'}
                        </td>

                        <td>
                          <span
                            className={`bw-status ${
                              addon.is_active ? 'published' : ''
                            }`}
                          >
                            {addon.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>

                        <td className="bw-action-cell">
                          <button
                            type="button"
                            onClick={() => editAddon(addon)}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleAddon(addon)}
                          >
                            {addon.is_active
                              ? 'Deactivate'
                              : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'subscriptions' && (
            <>
              <div className="bw-admin-section-head">
                <h2>Company subscriptions</h2>
                <p>
                  Existing legacy subscriptions are retained as-is.
                </p>
              </div>

              <div className="bw-admin-table-wrap">
                <table className="bw-admin-table">
                  <thead>
                    <tr>
                      <th>Business</th>
                      <th>Plan</th>
                      <th>Status</th>
                      <th>Interval</th>
                      <th>Origin</th>
                      <th>Period ends</th>
                    </tr>
                  </thead>

                  <tbody>
                    {subscriptions.map(subscription => (
                      <tr key={subscription.id}>
                        <td>
                          <strong>
                            {subscription.businesses?.name || 'Business'}
                          </strong>
                          <small>{subscription.business_id}</small>
                        </td>

                        <td>
                          {subscription.subscription_plans?.name ||
                            (subscription.status === 'grandfathered'
                              ? 'Legacy / grandfathered'
                              : 'Unassigned')}
                        </td>

                        <td>
                          <span
                            className={`bw-status ${
                              [
                                'active',
                                'grandfathered',
                                'trialing',
                              ].includes(subscription.status)
                                ? 'published'
                                : ''
                            }`}
                          >
                            {subscription.status}
                          </span>
                        </td>

                        <td>{subscription.billing_interval}</td>
                        <td>{subscription.origin}</td>

                        <td>
                          {subscription.current_period_end
                            ? new Date(
                                subscription.current_period_end
                              ).toLocaleDateString('en-ZA')
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {planForm && (
        <div
          className="bw-modal-backdrop"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) {
              setPlanForm(null);
            }
          }}
        >
          <form
            className="bw-subscription-modal"
            onSubmit={savePlan}
          >
            <div className="bw-modal-title">
              <h2>
                {planForm.id ? 'Edit plan' : 'Create plan'}
              </h2>

              <button
                type="button"
                onClick={() => setPlanForm(null)}
              >
                ×
              </button>
            </div>

            <div className="bw-form-grid">
              <label>
                Plan code
                <input
                  required
                  value={planForm.code}
                  onChange={event =>
                    setPlanForm({
                      ...planForm,
                      code: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Display name
                <input
                  required
                  value={planForm.name}
                  onChange={event =>
                    setPlanForm({
                      ...planForm,
                      name: event.target.value,
                    })
                  }
                />
              </label>

              <label className="wide">
                Description
                <input
                  value={planForm.description || ''}
                  onChange={event =>
                    setPlanForm({
                      ...planForm,
                      description: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Monthly price (R)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={planForm.monthly_price_cents}
                  onChange={event =>
                    setPlanForm({
                      ...planForm,
                      monthly_price_cents: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Annual price (R)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={planForm.annual_price_cents}
                  onChange={event =>
                    setPlanForm({
                      ...planForm,
                      annual_price_cents: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Sort order
                <input
                  type="number"
                  value={planForm.sort_order}
                  onChange={event =>
                    setPlanForm({
                      ...planForm,
                      sort_order: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Currency
                <input
                  maxLength="3"
                  required
                  value={planForm.currency}
                  onChange={event =>
                    setPlanForm({
                      ...planForm,
                      currency: event.target.value.toUpperCase(),
                    })
                  }
                />
              </label>
            </div>

            <label className="bw-json-label">
              Plan features (JSON array)
              <textarea
                rows="12"
                spellCheck="false"
                value={planForm.featuresText}
                onChange={event =>
                  setPlanForm({
                    ...planForm,
                    featuresText: event.target.value,
                  })
                }
              />
            </label>

            <div className="bw-checkbox-row">
              <label>
                <input
                  type="checkbox"
                  checked={planForm.is_active}
                  onChange={event =>
                    setPlanForm({
                      ...planForm,
                      is_active: event.target.checked,
                    })
                  }
                />
                Active
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={planForm.is_published}
                  onChange={event =>
                    setPlanForm({
                      ...planForm,
                      is_published: event.target.checked,
                    })
                  }
                />
                Published
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={planForm.is_highlighted}
                  onChange={event =>
                    setPlanForm({
                      ...planForm,
                      is_highlighted: event.target.checked,
                    })
                  }
                />
                Highlighted
              </label>
            </div>

            <div className="bw-modal-actions">
              <button
                type="button"
                onClick={() => setPlanForm(null)}
              >
                Cancel
              </button>

              <button
                className="bw-gold-button"
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save plan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {addonForm && (
        <div
          className="bw-modal-backdrop"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) {
              setAddonForm(null);
            }
          }}
        >
          <form
            className="bw-subscription-modal compact"
            onSubmit={saveAddon}
          >
            <div className="bw-modal-title">
              <h2>
                {addonForm.id ? 'Edit add-on' : 'Create add-on'}
              </h2>

              <button
                type="button"
                onClick={() => setAddonForm(null)}
              >
                ×
              </button>
            </div>

            <div className="bw-form-grid">
              <label>
                Code
                <input
                  required
                  value={addonForm.code}
                  onChange={event =>
                    setAddonForm({
                      ...addonForm,
                      code: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Name
                <input
                  required
                  value={addonForm.name}
                  onChange={event =>
                    setAddonForm({
                      ...addonForm,
                      name: event.target.value,
                    })
                  }
                />
              </label>

              <label className="wide">
                Description
                <input
                  value={addonForm.description || ''}
                  onChange={event =>
                    setAddonForm({
                      ...addonForm,
                      description: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Monthly price (R)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={addonForm.monthly_price_cents}
                  onChange={event =>
                    setAddonForm({
                      ...addonForm,
                      monthly_price_cents: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Once-off price (R)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={addonForm.one_time_price_cents}
                  onChange={event =>
                    setAddonForm({
                      ...addonForm,
                      one_time_price_cents: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Sort order
                <input
                  type="number"
                  value={addonForm.sort_order}
                  onChange={event =>
                    setAddonForm({
                      ...addonForm,
                      sort_order: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Currency
                <input
                  maxLength="3"
                  required
                  value={addonForm.currency}
                  onChange={event =>
                    setAddonForm({
                      ...addonForm,
                      currency: event.target.value.toUpperCase(),
                    })
                  }
                />
              </label>
            </div>

            <div className="bw-checkbox-row">
              <label>
                <input
                  type="checkbox"
                  checked={addonForm.requires_quote}
                  onChange={event =>
                    setAddonForm({
                      ...addonForm,
                      requires_quote: event.target.checked,
                    })
                  }
                />
                Requires quotation
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={addonForm.is_active}
                  onChange={event =>
                    setAddonForm({
                      ...addonForm,
                      is_active: event.target.checked,
                    })
                  }
                />
                Active
              </label>
            </div>

            <div className="bw-modal-actions">
              <button
                type="button"
                onClick={() => setAddonForm(null)}
              >
                Cancel
              </button>

              <button
                className="bw-gold-button"
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save add-on'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}