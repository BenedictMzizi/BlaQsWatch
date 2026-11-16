import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import '../../styles/subscriptions.css';

const formatMoney = (cents, currency = 'ZAR') =>
  new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);

export default function PublicSubscriptions() {
  const [plans, setPlans] = useState([]);
  const [addons, setAddons] = useState([]);
  const [billing, setBilling] = useState('monthly');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadSubscriptions() {
      setLoading(true);
      setError('');

      const [plansResult, addonsResult] = await Promise.all([
        supabase
          .from('subscription_plans')
          .select(`
            id,
            code,
            name,
            description,
            monthly_price_cents,
            annual_price_cents,
            currency,
            is_highlighted,
            sort_order,
            subscription_plan_features (
              id,
              feature_key,
              label,
              description,
              value,
              display_order,
              is_visible
            )
          `)
          .eq('is_active', true)
          .eq('is_published', true)
          .order('sort_order'),

        supabase
          .from('subscription_addons')
          .select(`
            id,
            code,
            name,
            description,
            monthly_price_cents,
            one_time_price_cents,
            currency,
            requires_quote,
            sort_order
          `)
          .eq('is_active', true)
          .order('sort_order'),
      ]);

      if (!mounted) return;

      if (plansResult.error || addonsResult.error) {
        setError(
          plansResult.error?.message ||
          addonsResult.error?.message ||
          'Unable to load subscription information.'
        );
      } else {
        const formattedPlans = (plansResult.data || []).map(plan => ({
          ...plan,
          subscription_plan_features: (
            plan.subscription_plan_features || []
          )
            .filter(feature => feature.is_visible)
            .sort((a, b) => a.display_order - b.display_order),
        }));

        setPlans(formattedPlans);
        setAddons(addonsResult.data || []);
      }

      setLoading(false);
    }

    loadSubscriptions();

    return () => {
      mounted = false;
    };
  }, []);

  const orderedPlans = useMemo(() => plans, [plans]);

  return (
    <main className="bw-subscriptions-page">
      <header className="bw-subscriptions-hero">
        <span className="bw-eyebrow">
          BlaQsWatch · Subscription plans
        </span>

        <h1>
          Inventory control that grows with your business.
        </h1>

        <p>
          Choose the level of visibility, control and operational
          capacity your team needs.
        </p>

        <div
          className="bw-billing-switch"
          role="group"
          aria-label="Billing interval"
        >
          <button
            type="button"
            className={billing === 'monthly' ? 'active' : ''}
            onClick={() => setBilling('monthly')}
          >
            Monthly
          </button>

          <button
            type="button"
            className={billing === 'annual' ? 'active' : ''}
            onClick={() => setBilling('annual')}
          >
            Annually <span>Save 15%</span>
          </button>
        </div>
      </header>

      {loading && (
        <div className="bw-subscription-state">
          Loading available plans…
        </div>
      )}

      {!loading && error && (
        <div className="bw-subscription-state error">
          {error}
        </div>
      )}

      {!loading && !error && plans.length === 0 && (
        <div className="bw-subscription-state">
          Subscription plans will be available here soon.
        </div>
      )}

      {!loading && !error && orderedPlans.length > 0 && (
        <section
          className="bw-plan-grid"
          aria-label="Available subscription plans"
        >
          {orderedPlans.map(plan => {
            const price = billing === 'annual'
              ? plan.annual_price_cents
              : plan.monthly_price_cents;

            const custom = price == null;

            return (
              <article
                key={plan.id}
                className={`bw-plan-card ${
                  plan.is_highlighted ? 'featured' : ''
                }`}
              >
                {plan.is_highlighted && (
                  <span className="bw-plan-ribbon">
                    Recommended
                  </span>
                )}

                <div className="bw-plan-heading">
                  <h2>{plan.name}</h2>
                  <p>{plan.description}</p>
                </div>

                <div className="bw-plan-price">
                  {custom ? (
                    <strong>Custom pricing</strong>
                  ) : (
                    <>
                      <strong>
                        {formatMoney(price, plan.currency)}
                      </strong>
                      <span>
                        /{billing === 'annual' ? 'year' : 'month'}
                      </span>
                    </>
                  )}

                  {billing === 'annual' && !custom && (
                    <small>
                      Equivalent to{' '}
                      {formatMoney(
                        Math.round(price / 12),
                        plan.currency
                      )} per month
                    </small>
                  )}
                </div>

                <ul className="bw-feature-list">
                  {plan.subscription_plan_features.map(feature => {
                    const value = feature.value || {};
                    let detail = '';

                    if (typeof value.limit === 'number') {
                      detail = value.limit.toLocaleString('en-ZA');
                    } else if (value.unlimited) {
                      detail = 'Unlimited';
                    } else if (value.custom) {
                      detail = 'Custom';
                    } else if (value.enabled) {
                      detail = 'Included';
                    }

                    return (
                      <li key={feature.id}>
                        <span>{feature.label}</span>
                        {detail && <strong>{detail}</strong>}
                      </li>
                    );
                  })}
                </ul>

                <Link
                  className="bw-plan-cta"
                  to={`/login?plan=${encodeURIComponent(
                    plan.code
                  )}&interval=${billing}`}
                >
                  {custom ? 'Contact us' : 'Get started'}
                </Link>
              </article>
            );
          })}
        </section>
      )}

      {!loading && addons.length > 0 && (
        <section className="bw-addons-section">
          <div>
            <span className="bw-eyebrow">Extend your plan</span>
            <h2>Optional add-ons</h2>
          </div>

          <div className="bw-addon-grid">
            {addons.map(addon => (
              <article className="bw-addon-card" key={addon.id}>
                <h3>{addon.name}</h3>
                <p>{addon.description}</p>

                <strong>
                  {addon.requires_quote
                    ? 'Custom quotation'
                    : addon.monthly_price_cents != null
                      ? `${formatMoney(
                          addon.monthly_price_cents,
                          addon.currency
                        )} / month`
                      : addon.one_time_price_cents != null
                        ? formatMoney(
                            addon.one_time_price_cents,
                            addon.currency
                          )
                        : 'Contact us'}
                </strong>
              </article>
            ))}
          </div>
        </section>
      )}

      <footer className="bw-pricing-footnote">
        All prices are in South African Rand (ZAR).
        Custom services are quoted according to scope.
      </footer>
    </main>
  );
}