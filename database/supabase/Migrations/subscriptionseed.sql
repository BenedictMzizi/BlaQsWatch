
-- ============================================================
-- INITIAL BLAQSWATCH PACKAGES
-- ============================================================

INSERT INTO public.subscription_plans (
    code,
    name,
    description,
    monthly_price_cents,
    annual_price_cents,
    currency,
    is_active,
    is_published,
    is_highlighted,
    sort_order,
    cta_text
)
VALUES
(
    'starter',
    'Starter',
    'Essential inventory management for smaller businesses.',
    49900,
    509000,
    'ZAR',
    TRUE,
    FALSE,
    FALSE,
    1,
    'Get started'
),
(
    'professional',
    'Professional',
    'More control over stock, suppliers and employees.',
    99900,
    1019000,
    'ZAR',
    TRUE,
    FALSE,
    TRUE,
    2,
    'Choose Professional'
),
(
    'business',
    'Business',
    'Advanced inventory operations for growing businesses.',
    199900,
    2039000,
    'ZAR',
    TRUE,
    FALSE,
    FALSE,
    3,
    'Choose Business'
),
(
    'enterprise',
    'Enterprise',
    'Flexible solutions for larger and multi-location operations.',
    NULL,
    NULL,
    'ZAR',
    TRUE,
    FALSE,
    FALSE,
    4,
    'Contact us'
)
ON CONFLICT (code)
DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    monthly_price_cents = EXCLUDED.monthly_price_cents,
    annual_price_cents = EXCLUDED.annual_price_cents,
    currency = EXCLUDED.currency,
    sort_order = EXCLUDED.sort_order,
    cta_text = EXCLUDED.cta_text;

-- ============================================================
-- PACKAGE FEATURES
-- ============================================================

INSERT INTO public.subscription_plan_features (
    plan_id,
    feature_key,
    label,
    value,
    display_order
)
SELECT
    p.id,
    f.feature_key,
    f.label,
    f.value,
    f.display_order
FROM public.subscription_plans p
CROSS JOIN (
    VALUES
        (
            'starter',
            'locations',
            'Business locations',
            '{"limit": 1}'::jsonb,
            1
        ),
        (
            'starter',
            'staff',
            'Staff accounts',
            '{"limit": 2}'::jsonb,
            2
        ),
        (
            'starter',
            'active_products',
            'Active products',
            '{"limit": 500}'::jsonb,
            3
        ),
        (
            'starter',
            'basic_inventory',
            'Basic inventory management',
            '{"enabled": true}'::jsonb,
            4
        ),
        (
            'starter',
            'basic_reports',
            'Basic inventory reports',
            '{"enabled": true}'::jsonb,
            5
        ),

        (
            'professional',
            'locations',
            'Business locations',
            '{"limit": 1}'::jsonb,
            1
        ),
        (
            'professional',
            'staff',
            'Staff accounts',
            '{"limit": 5}'::jsonb,
            2
        ),
        (
            'professional',
            'active_products',
            'Active products',
            '{"limit": 2500}'::jsonb,
            3
        ),
        (
            'professional',
            'supplier_management',
            'Supplier management',
            '{"enabled": true}'::jsonb,
            4
        ),
        (
            'professional',
            'stock_movements',
            'Stock movement tracking',
            '{"enabled": true}'::jsonb,
            5
        ),
        (
            'professional',
            'employee_permissions',
            'Employee roles and permissions',
            '{"enabled": true}'::jsonb,
            6
        ),
        (
            'professional',
            'expanded_reports',
            'Expanded reports',
            '{"enabled": true}'::jsonb,
            7
        ),

        (
            'business',
            'locations',
            'Business locations',
            '{"limit": 3}'::jsonb,
            1
        ),
        (
            'business',
            'staff',
            'Staff accounts',
            '{"limit": 15}'::jsonb,
            2
        ),
        (
            'business',
            'active_products',
            'Active products',
            '{"limit": 10000}'::jsonb,
            3
        ),
        (
            'business',
            'location_transfers',
            'Inter-location transfers',
            '{"enabled": true}'::jsonb,
            4
        ),
        (
            'business',
            'advanced_reports',
            'Advanced reporting',
            '{"enabled": true}'::jsonb,
            5
        ),
        (
            'business',
            'audit_visibility',
            'Enhanced audit visibility',
            '{"enabled": true}'::jsonb,
            6
        ),

        (
            'enterprise',
            'locations',
            'Business locations',
            '{"unlimited": true, "custom": true}'::jsonb,
            1
        ),
        (
            'enterprise',
            'staff',
            'Staff accounts',
            '{"unlimited": true, "custom": true}'::jsonb,
            2
        ),
        (
            'enterprise',
            'custom_workflows',
            'Custom workflows and integrations',
            '{"enabled": true}'::jsonb,
            3
        ),
        (
            'enterprise',
            'dedicated_support',
            'Dedicated onboarding and support',
            '{"enabled": true}'::jsonb,
            4
        )
) AS f (
    plan_code,
    feature_key,
    label,
    value,
    display_order
)
WHERE p.code = f.plan_code
ON CONFLICT (plan_id, feature_key)
DO UPDATE SET
    label = EXCLUDED.label,
    value = EXCLUDED.value,
    display_order = EXCLUDED.display_order;

-- ============================================================
-- ADD-ON CATALOGUE
-- ============================================================

INSERT INTO public.subscription_addons (
    code,
    name,
    description,
    monthly_price_cents,
    one_time_price_cents,
    currency,
    requires_quote,
    is_active,
    sort_order
)
VALUES
(
    'additional_staff',
    'Additional staff member',
    'Add an additional employee account.',
    5000,
    NULL,
    'ZAR',
    FALSE,
    TRUE,
    1
),
(
    'additional_location',
    'Additional location',
    'Add an additional business location.',
    25000,
    NULL,
    'ZAR',
    FALSE,
    TRUE,
    2
),
(
    'onboarding',
    'Setup and onboarding',
    'Initial setup and onboarding assistance.',
    NULL,
    NULL,
    'ZAR',
    TRUE,
    TRUE,
    3
),
(
    'data_migration',
    'Data migration',
    'Migration of existing inventory and business data.',
    NULL,
    NULL,
    'ZAR',
    TRUE,
    TRUE,
    4
),
(
    'onsite_training',
    'On-site training',
    'On-site staff training and implementation assistance.',
    NULL,
    NULL,
    'ZAR',
    TRUE,
    TRUE,
    5
)
ON CONFLICT (code)
DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    monthly_price_cents = EXCLUDED.monthly_price_cents,
    one_time_price_cents = EXCLUDED.one_time_price_cents,
    requires_quote = EXCLUDED.requires_quote,
    sort_order = EXCLUDED.sort_order;
