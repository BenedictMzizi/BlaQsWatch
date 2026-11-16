
import { useEffect, useState } from 'react';
import {
  CreditCardIcon,
  ClockIcon,
  ShieldCheckIcon,
  CalendarDaysIcon,
  BanknotesIcon,
  ArrowPathIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';

import { supabase } from '../../lib/supabase';
import '../../styles/subscriptions.css';

const SELECTED_BUSINESS_KEY = 'stockwise-selected-business-id';

const formatMoney = (cents, currency = 'ZAR') =>
  new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency,
  }).format((cents || 0) / 100);

const formatDate = date =>
  date
    ? new Date(date).toLocaleDateString('en-ZA', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    : '—';

const statusLabels = {
  active: 'Active',
  trialing: 'Free trial',
  pending: 'Pending activation',
  past_due: 'Payment overdue',
  cancelled: 'Cancelled',
  suspended: 'Suspended',
  expired: 'Expired',
  grandfathered: 'Legacy account'
};

const intervalLabels = {
  monthly: 'Monthly',
  annual: 'Annually',
  custom: 'Custom billing',
  none: 'No recurring billing'
};

const originLabels = {
  manual: 'Manually assigned',
  trial: 'Trial subscription',
  online_payment: 'Online payment',
  manual_payment: 'Manual payment',
  legacy_migration: 'Migrated from previous system'
};

export default function CompanySubscription() {
  const [subscription, setSubscription] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadSubscription() {
      setLoading(true);
      setError('');

      try {
        const { data: authResult, error: authError } =
          await supabase.auth.getUser();

        if (authError) throw authError;

        if (!authResult?.user) {
          throw new Error(
            'Please sign in to view your subscription.'
          );
        }

        const { data: memberships, error: membershipError } =
          await supabase
            .from('business_members')
            .select('business_id')
            .eq('user_id', authResult.user.id)
            .eq('active', true);

        if (membershipError) throw membershipError;

        const selectedBusinessId = localStorage.getItem(
          SELECTED_BUSINESS_KEY
        );

        const selectedMembership = selectedBusinessId
          ? memberships?.find(
              item => item.business_id === selectedBusinessId
            )
          : null;

        let businessId = selectedMembership?.business_id;

        if (!businessId && memberships?.length === 1) {
          businessId = memberships[0].business_id;
        }

        if (!businessId) {
          throw new Error(
            memberships?.length > 1
              ? 'Select a business in your workspace before viewing its subscription.'
              : 'No active business membership was found.'
          );
        }

        const [subscriptionResult, paymentResult] =
          await Promise.all([
            supabase
              .from('company_subscriptions')
              .select(`
                id,
                status,
                billing_interval,
                currency,
                custom_price_cents,
                trial_started_at,
                trial_ends_at,
                current_period_start,
                current_period_end,
                cancelled_at,
                origin,
                created_at,
                subscription_plans (
                  name,
                  code,
                  monthly_price_cents,
                  annual_price_cents
                )
              `)
              .eq('business_id', businessId)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle(),

            supabase
              .from('subscription_payments')
              .select(`
                id,
                amount_cents,
                currency,
                status,
                collection_method,
                payment_method,
                payment_reference,
                paid_at,
                created_at
              `)
              .eq('business_id', businessId)
              .order('created_at', { ascending: false })
              .limit(20),
          ]);

        if (!mounted) return;

        if (subscriptionResult.error) {
          throw subscriptionResult.error;
        }

        if (paymentResult.error) {
          throw paymentResult.error;
        }

        setSubscription(subscriptionResult.data || null);
        setPayments(paymentResult.data || []);
      } catch (loadError) {
        console.error(
          'Subscription loading failed:',
          loadError
        );

        if (mounted) {
          setError(
            loadError.message ||
            'Unable to load subscription details.'
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadSubscription();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <main className="bw-company-subscription">
        <div className="bw-subscription-state">
          <ArrowPathIcon className="bw-loading-icon" />
          <span>Loading subscription details...</span>
        </div>
      </main>
    );
  }

  const isLegacy =
    subscription?.status === 'grandfathered';

  const isHealthy = [
    'active',
    'grandfathered',
    'trialing'
  ].includes(subscription?.status);

  const plan = subscription?.subscription_plans;

  const agreedPrice =
    subscription?.custom_price_cents != null
      ? formatMoney(
          subscription.custom_price_cents,
          subscription.currency
        )
      : plan
        ? subscription.billing_interval === 'annual'
          ? formatMoney(
              plan.annual_price_cents,
              subscription.currency
            )
          : subscription.billing_interval === 'monthly'
            ? formatMoney(
                plan.monthly_price_cents,
                subscription.currency
              )
            : 'Custom pricing'
        : 'No subscription charges assigned';

  return (
    <main className="bw-company-subscription">

      {/* Page heading */}
      <header className="bw-admin-heading">
        <div>
          <span className="bw-eyebrow">
            ACCOUNT MANAGEMENT
          </span>

          <h1>Subscription & billing</h1>

          <p>
            Manage your business subscription, billing
            information and payment history.
          </p>
        </div>
      </header>

      {error && (
        <div className="bw-subscription-state error">
          {error}
        </div>
      )}

      {!error && !subscription && (
        <section className="bw-subscription-empty">
          <div className="bw-subscription-empty-icon">
            <CreditCardIcon />
          </div>

          <h2>No subscription assigned</h2>

          <p>
            There is currently no subscription record
            associated with this business.
          </p>
        </section>
      )}

      {subscription && (
        <>
          {/* Current subscription */}
          <section className="bw-current-subscription">

            <div className="bw-subscription-card-heading">
              <div className="bw-subscription-plan-icon">
                {isLegacy
                  ? <ShieldCheckIcon />
                  : <CreditCardIcon />}
              </div>

              <div>
                <span className="bw-eyebrow">
                  CURRENT SUBSCRIPTION
                </span>

                <h2>
                  {plan?.name ||
                    (isLegacy
                      ? 'Legacy grandfathered access'
                      : 'Unassigned plan')}
                </h2>

                <p>
                  {isLegacy
                    ? 'Your business continues to operate under its original legacy access arrangement.'
                    : `Your subscription is currently ${statusLabels[subscription.status]?.toLowerCase() || subscription.status}.`}
                </p>
              </div>

              <span
                className={`bw-status ${
                  isHealthy ? 'published' : ''
                }`}
              >
                {statusLabels[subscription.status] ||
                  subscription.status}
              </span>
            </div>

            {isLegacy && (
              <div className="bw-legacy-notice">
                <ShieldCheckIcon />

                <div>
                  <strong>Existing access preserved</strong>

                  <p>
                    No recurring subscription charges are
                    currently assigned to this legacy account.
                    Your existing access remains unchanged.
                  </p>
                </div>
              </div>
            )}

            <div className="bw-subscription-details-grid">

              <div className="bw-subscription-detail">
                <div className="bw-detail-icon">
                  <ArrowPathIcon />
                </div>

                <div>
                  <span>Billing interval</span>

                  <strong>
                    {intervalLabels[
                      subscription.billing_interval
                    ] || subscription.billing_interval}
                  </strong>
                </div>
              </div>

              <div className="bw-subscription-detail">
                <div className="bw-detail-icon">
                  <DocumentTextIcon />
                </div>

                <div>
                  <span>Account origin</span>

                  <strong>
                    {originLabels[subscription.origin] ||
                      subscription.origin ||
                      '—'}
                  </strong>
                </div>
              </div>

              <div className="bw-subscription-detail">
                <div className="bw-detail-icon">
                  <CalendarDaysIcon />
                </div>

                <div>
                  <span>Trial ends</span>

                  <strong>
                    {formatDate(subscription.trial_ends_at)}
                  </strong>
                </div>
              </div>

              <div className="bw-subscription-detail">
                <div className="bw-detail-icon">
                  <ClockIcon />
                </div>

                <div>
                  <span>Current period ends</span>

                  <strong>
                    {formatDate(
                      subscription.current_period_end
                    )}
                  </strong>
                </div>
              </div>

              <div className="bw-subscription-detail">
                <div className="bw-detail-icon">
                  <BanknotesIcon />
                </div>

                <div>
                  <span>Agreed price</span>

                  <strong>{agreedPrice}</strong>
                </div>
              </div>

              {subscription.cancelled_at && (
                <div className="bw-subscription-detail">
                  <div className="bw-detail-icon">
                    <CalendarDaysIcon />
                  </div>

                  <div>
                    <span>Cancelled on</span>

                    <strong>
                      {formatDate(subscription.cancelled_at)}
                    </strong>
                  </div>
                </div>
              )}
            </div>

            {plan && (
              <div className="bw-subscription-plan-reference">
                <span>Plan reference</span>
                <strong>{plan.code}</strong>
              </div>
            )}
          </section>

          {/* Payment history */}
          <section className="bw-payment-history">
            <div className="bw-payment-heading">
              <div>
                <span className="bw-eyebrow">
                  BILLING RECORDS
                </span>

                <h2>Payment history</h2>

                <p>
                  Review payments associated with your
                  business subscription.
                </p>
              </div>

              <span className="bw-payment-count">
                {payments.length} records
              </span>
            </div>

            {payments.length === 0 ? (
              <div className="bw-payment-empty">
                <BanknotesIcon />

                <strong>
                  No payment records yet
                </strong>

                <p>
                  {isLegacy
                    ? 'This legacy account has no recorded subscription payments.'
                    : 'Subscription payments will appear here when recorded.'}
                </p>
              </div>
            ) : (
              <div className="bw-admin-table-wrap">
                <table className="bw-admin-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Reference</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {payments.map(payment => (
                      <tr key={payment.id}>
                        <td>
                          {formatDate(
                            payment.paid_at ||
                            payment.created_at
                          )}
                        </td>

                        <td>
                          <strong>
                            {formatMoney(
                              payment.amount_cents,
                              payment.currency
                            )}
                          </strong>
                        </td>

                        <td>
                          {payment.payment_method ||
                            payment.collection_method ||
                            '—'}
                        </td>

                        <td>
                          {payment.payment_reference || '—'}
                        </td>

                        <td>
                          <span
                            className={`bw-status ${
                              payment.status === 'succeeded'
                                ? 'published'
                                : ''
                            }`}
                          >
                            {payment.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
