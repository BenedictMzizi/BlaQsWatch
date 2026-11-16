
-- ============================================================
-- BLAQSWATCH SUBSCRIPTION SYSTEM
-- Migration 001
-- Currency: ZAR
-- Monetary storage: integer cents
-- ============================================================

-- ------------------------------------------------------------
-- 1. SUBSCRIPTION PLANS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,

    monthly_price_cents INTEGER,
    annual_price_cents INTEGER,

    currency TEXT NOT NULL DEFAULT 'ZAR',

    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    is_highlighted BOOLEAN NOT NULL DEFAULT FALSE,

    sort_order INTEGER NOT NULL DEFAULT 0,
    cta_text TEXT NOT NULL DEFAULT 'Get started',

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT subscription_plans_monthly_price_check
        CHECK (monthly_price_cents IS NULL OR monthly_price_cents >= 0),

    CONSTRAINT subscription_plans_annual_price_check
        CHECK (annual_price_cents IS NULL OR annual_price_cents >= 0),

    CONSTRAINT subscription_plans_currency_check
        CHECK (char_length(currency) = 3)
);

-- ------------------------------------------------------------
-- 2. PLAN FEATURES
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.subscription_plan_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    plan_id UUID NOT NULL
        REFERENCES public.subscription_plans(id)
        ON DELETE CASCADE,

    feature_key TEXT NOT NULL,
    label TEXT NOT NULL,
    description TEXT,

    -- Flexible limits and feature configuration.
    -- Examples:
    -- {"limit": 500}
    -- {"enabled": true}
    -- {"unlimited": true}

    value JSONB NOT NULL DEFAULT '{}'::jsonb,

    is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT subscription_plan_features_unique
        UNIQUE (plan_id, feature_key)
);

-- ------------------------------------------------------------
-- 3. COMPANY SUBSCRIPTIONS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.company_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    business_id UUID NOT NULL
        REFERENCES public.businesses(id)
        ON DELETE RESTRICT,

    plan_id UUID
        REFERENCES public.subscription_plans(id)
        ON DELETE RESTRICT,

    status TEXT NOT NULL DEFAULT 'pending',

    billing_interval TEXT NOT NULL DEFAULT 'monthly',

    currency TEXT NOT NULL DEFAULT 'ZAR',

    -- Used when a customer has individually negotiated pricing.
    custom_price_cents INTEGER,

    trial_started_at TIMESTAMPTZ,
    trial_ends_at TIMESTAMPTZ,

    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,

    cancelled_at TIMESTAMPTZ,
    assigned_by UUID REFERENCES public.profiles(id),

    origin TEXT NOT NULL DEFAULT 'manual',

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT company_subscriptions_status_check
        CHECK (
            status IN (
                'pending',
                'trialing',
                'active',
                'past_due',
                'cancelled',
                'suspended',
                'expired',
                'grandfathered'
            )
        ),

    CONSTRAINT company_subscriptions_interval_check
        CHECK (
            billing_interval IN (
                'monthly',
                'annual',
                'custom',
                'none'
            )
        ),

    CONSTRAINT company_subscriptions_origin_check
        CHECK (
            origin IN (
                'manual',
                'trial',
                'online_payment',
                'manual_payment',
                'legacy_migration'
            )
        ),

    CONSTRAINT company_subscriptions_custom_price_check
        CHECK (
            custom_price_cents IS NULL
            OR custom_price_cents >= 0
        ),

    CONSTRAINT company_subscriptions_trial_dates_check
        CHECK (
            status <> 'trialing'
            OR (
                trial_started_at IS NOT NULL
                AND trial_ends_at IS NOT NULL
                AND trial_ends_at > trial_started_at
            )
        ),

    CONSTRAINT company_subscriptions_period_check
        CHECK (
            current_period_end IS NULL
            OR current_period_start IS NULL
            OR current_period_end > current_period_start
        ),

    CONSTRAINT company_subscriptions_grandfathered_check
        CHECK (
            status <> 'grandfathered'
            OR (
                plan_id IS NULL
                AND billing_interval = 'none'
            )
        ),

    CONSTRAINT company_subscriptions_currency_check
        CHECK (char_length(currency) = 3)
);

-- One current subscription record per business.
-- Historical cancelled and expired records remain available.

CREATE UNIQUE INDEX IF NOT EXISTS
    company_subscriptions_one_current_per_business
ON public.company_subscriptions (business_id)
WHERE status IN (
    'pending',
    'trialing',
    'active',
    'past_due',
    'suspended',
    'grandfathered'
);

CREATE INDEX IF NOT EXISTS
    company_subscriptions_business_idx
ON public.company_subscriptions (business_id);

CREATE INDEX IF NOT EXISTS
    company_subscriptions_status_idx
ON public.company_subscriptions (status);

-- ------------------------------------------------------------
-- 4. SUBSCRIPTION ADD-ONS CATALOGUE
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.subscription_addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,

    monthly_price_cents INTEGER,
    one_time_price_cents INTEGER,

    currency TEXT NOT NULL DEFAULT 'ZAR',

    requires_quote BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    sort_order INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT subscription_addons_monthly_price_check
        CHECK (
            monthly_price_cents IS NULL
            OR monthly_price_cents >= 0
        ),

    CONSTRAINT subscription_addons_one_time_price_check
        CHECK (
            one_time_price_cents IS NULL
            OR one_time_price_cents >= 0
        ),

    CONSTRAINT subscription_addons_currency_check
        CHECK (char_length(currency) = 3)
);

-- ------------------------------------------------------------
-- 5. COMPANY SUBSCRIPTION ADD-ONS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.company_subscription_addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    subscription_id UUID NOT NULL
        REFERENCES public.company_subscriptions(id)
        ON DELETE RESTRICT,

    addon_id UUID NOT NULL
        REFERENCES public.subscription_addons(id)
        ON DELETE RESTRICT,

    quantity INTEGER NOT NULL DEFAULT 1,

    agreed_unit_price_cents INTEGER NOT NULL DEFAULT 0,

    billing_interval TEXT NOT NULL DEFAULT 'monthly',

    status TEXT NOT NULL DEFAULT 'pending',

    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT company_subscription_addons_quantity_check
        CHECK (quantity > 0),

    CONSTRAINT company_subscription_addons_price_check
        CHECK (agreed_unit_price_cents >= 0),

    CONSTRAINT company_subscription_addons_interval_check
        CHECK (
            billing_interval IN (
                'monthly',
                'annual',
                'once'
            )
        ),

    CONSTRAINT company_subscription_addons_status_check
        CHECK (
            status IN (
                'pending',
                'active',
                'cancelled'
            )
        )
);

-- ------------------------------------------------------------
-- 6. SUBSCRIPTION PAYMENTS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.subscription_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    business_id UUID NOT NULL
        REFERENCES public.businesses(id)
        ON DELETE RESTRICT,

    subscription_id UUID
        REFERENCES public.company_subscriptions(id)
        ON DELETE RESTRICT,

    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'ZAR',

    collection_method TEXT NOT NULL,

    payment_method TEXT,

    payment_provider TEXT,

    payment_reference TEXT,

    provider_transaction_id TEXT,
    provider_event_id TEXT,

    status TEXT NOT NULL DEFAULT 'pending',

    paid_at TIMESTAMPTZ,

    confirmed_by UUID
        REFERENCES public.profiles(id),

    confirmed_at TIMESTAMPTZ,

    initiated_by UUID
        REFERENCES public.profiles(id),

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT subscription_payments_amount_check
        CHECK (amount_cents > 0),

    CONSTRAINT subscription_payments_currency_check
        CHECK (char_length(currency) = 3),

    CONSTRAINT subscription_payments_collection_check
        CHECK (
            collection_method IN (
                'online',
                'manual'
            )
        ),

    CONSTRAINT subscription_payments_status_check
        CHECK (
            status IN (
                'pending',
                'processing',
                'succeeded',
                'failed',
                'cancelled',
                'refunded',
                'partially_refunded'
            )
        )
);

CREATE INDEX IF NOT EXISTS
    subscription_payments_business_idx
ON public.subscription_payments (business_id);

CREATE INDEX IF NOT EXISTS
    subscription_payments_subscription_idx
ON public.subscription_payments (subscription_id);

CREATE INDEX IF NOT EXISTS
    subscription_payments_status_idx
ON public.subscription_payments (status);

-- Prevent duplicate payment-provider events.
CREATE UNIQUE INDEX IF NOT EXISTS
    subscription_payments_provider_event_unique
ON public.subscription_payments (payment_provider, provider_event_id)
WHERE provider_event_id IS NOT NULL;

-- ------------------------------------------------------------
-- 7. UPDATED_AT TRIGGER
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION
public.stockwise_subscription_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'subscription_plans',
        'subscription_plan_features',
        'company_subscriptions',
        'subscription_addons',
        'company_subscription_addons',
        'subscription_payments'
    ]
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS set_subscription_updated_at ON public.%I',
            table_name
        );

        EXECUTE format(
            'CREATE TRIGGER set_subscription_updated_at
             BEFORE UPDATE ON public.%I
             FOR EACH ROW
             EXECUTE FUNCTION public.stockwise_subscription_set_updated_at()',
            table_name
        );
    END LOOP;
END;
$$;
