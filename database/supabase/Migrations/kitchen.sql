
BEGIN;

-- ============================================================
-- 1. Remove the old order-created trigger.
--    The replacement function will write the event after
--    calculating the final order totals.
-- ============================================================

DROP TRIGGER IF EXISTS food_orders_log_created
ON public.food_orders;

-- ============================================================
-- 2. Remove direct client-side INSERT policies.
--    Order creation will happen through the controlled RPC.
-- ============================================================

DROP POLICY IF EXISTS food_orders_authorised_insert
ON public.food_orders;

DROP POLICY IF EXISTS food_order_items_authorised_insert
ON public.food_order_items;

DROP POLICY IF EXISTS food_order_events_authorised_insert
ON public.food_order_events;

DROP POLICY IF EXISTS food_kitchen_tickets_authorised_insert
ON public.food_kitchen_tickets;

DROP POLICY IF EXISTS food_kitchen_ticket_items_authorised_insert
ON public.food_kitchen_ticket_items;

REVOKE INSERT ON TABLE
    public.food_orders,
    public.food_order_items,
    public.food_order_events,
    public.food_kitchen_tickets,
    public.food_kitchen_ticket_items
FROM authenticated;

-- ============================================================
-- 3. Replace food_create_order.
-- ============================================================

CREATE OR REPLACE FUNCTION public.food_create_order(
    p_business_id uuid,
    p_outlet_id uuid,
    p_channel text,
    p_table_id uuid DEFAULT NULL,
    p_guest_count integer DEFAULT NULL,
    p_notes text DEFAULT NULL,
    p_customer_name text DEFAULT NULL,
    p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$

DECLARE
    v_order_id uuid := gen_random_uuid();
    v_order_number text;
    v_order_prefix text := 'FOOD';
    v_timezone text := 'Africa/Johannesburg';

    v_item jsonb;
    v_menu public.food_menu_items%ROWTYPE;
    v_group record;
    v_station record;

    v_item_id uuid;
    v_order_item_id uuid;
    v_ticket_id uuid;
    v_station_id uuid;

    v_quantity numeric;
    v_unit_price bigint;
    v_modifier_total bigint;
    v_line_total bigint;

    v_subtotal bigint := 0;
    v_tax bigint := 0;
    v_total bigint := 0;

    v_tax_rate integer := 0;
    v_prices_include_tax boolean := true;

    v_enabled_channels text[] := ARRAY['counter', 'takeaway'];
    v_channel text;
    v_channel_enabled boolean;
    v_channel_config_found boolean := false;

    v_table_status text;

    v_modifier_ids uuid[];
    v_modifier_snapshot jsonb;
    v_valid_modifier_count integer;
    v_selected_count integer;

    v_outlet_item_found boolean;
    v_outlet_item_available boolean;
    v_price_override bigint;

    v_item_count integer := 0;

BEGIN

    -- --------------------------------------------------------
    -- A. Validate input and authorisation
    -- --------------------------------------------------------

    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication is required.'
            USING ERRCODE = '42501';
    END IF;

    IF p_business_id IS NULL OR p_outlet_id IS NULL THEN
        RAISE EXCEPTION 'A business and outlet are required.'
            USING ERRCODE = '22023';
    END IF;

    IF NOT public.food_is_business_member(p_business_id) THEN
        RAISE EXCEPTION 'You do not have access to this business.'
            USING ERRCODE = '42501';
    END IF;

    IF NOT public.food_has_permission(
        p_business_id,
        'orders.create',
        p_outlet_id
    ) THEN
        RAISE EXCEPTION 'You do not have permission to create orders at this outlet.'
            USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.food_outlets o
        WHERE o.id = p_outlet_id
          AND o.business_id = p_business_id
          AND o.active = true
    ) THEN
        RAISE EXCEPTION 'The selected outlet is invalid or inactive.'
            USING ERRCODE = '22023';
    END IF;

    v_channel := lower(btrim(coalesce(p_channel, '')));

    IF v_channel NOT IN (
        'dine_in',
        'counter',
        'takeaway',
        'collection',
        'delivery',
        'catering',
        'bar_tab'
    ) THEN
        RAISE EXCEPTION 'Unsupported service channel.'
            USING ERRCODE = '22023';
    END IF;

    IF p_guest_count IS NOT NULL AND p_guest_count <= 0 THEN
        RAISE EXCEPTION 'Guest count must be greater than zero.'
            USING ERRCODE = '22023';
    END IF;

    IF p_items IS NULL
       OR jsonb_typeof(p_items) <> 'array'
       OR jsonb_array_length(p_items) = 0 THEN

        RAISE EXCEPTION 'Add at least one menu item to the order.'
            USING ERRCODE = '22023';
    END IF;

    -- --------------------------------------------------------
    -- B. Load business settings
    -- --------------------------------------------------------

    SELECT
        s.tax_rate_basis_points,
        s.prices_include_tax,
        s.enabled_channels,
        s.order_prefix,
        s.timezone

    INTO
        v_tax_rate,
        v_prices_include_tax,
        v_enabled_channels,
        v_order_prefix,
        v_timezone

    FROM public.food_business_settings s
    WHERE s.business_id = p_business_id;

    v_tax_rate := coalesce(v_tax_rate, 0);
    v_prices_include_tax := coalesce(v_prices_include_tax, true);
    v_enabled_channels := coalesce(
        v_enabled_channels,
        ARRAY['counter', 'takeaway']
    );

    v_order_prefix := coalesce(
        nullif(btrim(v_order_prefix), ''),
        'FOOD'
    );

    v_timezone := coalesce(
        nullif(btrim(v_timezone), ''),
        'Africa/Johannesburg'
    );

    -- --------------------------------------------------------
    -- C. Validate outlet-specific service channel.
    --
    -- Outlet configuration takes precedence over the
    -- business-wide channel configuration.
    -- --------------------------------------------------------

    SELECT sc.enabled
    INTO v_channel_enabled

    FROM public.food_service_channels sc

    WHERE sc.business_id = p_business_id
      AND sc.channel_key = v_channel
      AND (
          sc.outlet_id = p_outlet_id
          OR sc.outlet_id IS NULL
      )

    ORDER BY
        (sc.outlet_id = p_outlet_id) DESC

    LIMIT 1;

    v_channel_config_found := FOUND;

    IF v_channel_config_found THEN

        IF NOT coalesce(v_channel_enabled, false) THEN
            RAISE EXCEPTION 'This service channel is disabled for the selected outlet.'
                USING ERRCODE = '22023';
        END IF;

    ELSE

        IF NOT (v_channel = ANY(v_enabled_channels)) THEN
            RAISE EXCEPTION 'This service channel is not enabled for this business.'
                USING ERRCODE = '22023';
        END IF;

    END IF;

    -- --------------------------------------------------------
    -- D. Validate and lock the table if supplied.
    -- --------------------------------------------------------

    IF v_channel = 'dine_in' AND p_table_id IS NULL THEN
        RAISE EXCEPTION 'A table is required for dine-in orders.'
            USING ERRCODE = '22023';
    END IF;

    IF p_table_id IS NOT NULL THEN

        SELECT t.status
        INTO v_table_status

        FROM public.food_tables t

        WHERE t.id = p_table_id
          AND t.business_id = p_business_id
          AND t.outlet_id = p_outlet_id
          AND t.active = true

        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'The selected table is invalid or inactive.'
                USING ERRCODE = '22023';
        END IF;

        IF v_table_status <> 'available' THEN
            RAISE EXCEPTION 'The selected table is not available.'
                USING ERRCODE = '22023';
        END IF;

    END IF;

    -- --------------------------------------------------------
    -- E. Generate order number
    -- --------------------------------------------------------

    v_order_number :=
        v_order_prefix
        || '-'
        || to_char(
            now() AT TIME ZONE v_timezone,
            'YYMMDD'
        )
        || '-'
        || upper(
            substr(
                replace(v_order_id::text, '-', ''),
                1,
                8
            )
        );

    -- --------------------------------------------------------
    -- F. Create order
    -- --------------------------------------------------------

    INSERT INTO public.food_orders (
        id,
        business_id,
        outlet_id,
        order_number,
        channel_key,
        table_id,
        customer_name,
        guest_count,
        status,
        notes,
        created_by,
        waiter_id,
        placed_at
    )
    VALUES (
        v_order_id,
        p_business_id,
        p_outlet_id,
        v_order_number,
        v_channel,
        p_table_id,
        nullif(btrim(p_customer_name), ''),
        p_guest_count,
        'placed',
        nullif(btrim(p_notes), ''),
        auth.uid(),
        auth.uid(),
        now()
    );

    -- --------------------------------------------------------
    -- G. Process order items
    -- --------------------------------------------------------

    FOR v_item IN
        SELECT value
        FROM jsonb_array_elements(p_items)
    LOOP

        v_item_count := v_item_count + 1;

        IF jsonb_typeof(v_item) <> 'object' THEN
            RAISE EXCEPTION 'Each order item must be a JSON object.'
                USING ERRCODE = '22023';
        END IF;

        IF nullif(v_item->>'menu_item_id', '') IS NULL THEN
            RAISE EXCEPTION 'An order item is missing its menu item ID.'
                USING ERRCODE = '22023';
        END IF;

        v_item_id := (v_item->>'menu_item_id')::uuid;

        -- ----------------------------------------------------
        -- Load menu item
        -- ----------------------------------------------------

        SELECT *
        INTO v_menu

        FROM public.food_menu_items m

        WHERE m.id = v_item_id
          AND m.business_id = p_business_id
          AND m.active = true
          AND m.available = true;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'A selected menu item is unavailable.'
                USING ERRCODE = '22023';
        END IF;

        -- ----------------------------------------------------
        -- Validate quantity
        -- ----------------------------------------------------

        v_quantity := coalesce(
            nullif(v_item->>'quantity', '')::numeric,
            1
        );

        IF v_quantity <= 0 THEN
            RAISE EXCEPTION 'Item quantity must be greater than zero.'
                USING ERRCODE = '22023';
        END IF;

        -- ----------------------------------------------------
        -- Apply outlet-specific availability and pricing
        -- ----------------------------------------------------

        SELECT
            mio.available,
            mio.price_override_cents

        INTO
            v_outlet_item_available,
            v_price_override

        FROM public.food_menu_item_outlets mio

        WHERE mio.business_id = p_business_id
          AND mio.menu_item_id = v_menu.id
          AND mio.outlet_id = p_outlet_id;

        v_outlet_item_found := FOUND;

        IF v_outlet_item_found THEN

            IF NOT v_outlet_item_available THEN
                RAISE EXCEPTION 'This menu item is unavailable at the selected outlet.'
                    USING ERRCODE = '22023';
            END IF;

            v_unit_price := coalesce(
                v_price_override,
                v_menu.price_cents
            );

        ELSE

            v_unit_price := v_menu.price_cents;

        END IF;

        -- ----------------------------------------------------
        -- Validate modifier input
        -- ----------------------------------------------------

        IF v_item ? 'modifier_option_ids'
           AND jsonb_typeof(v_item->'modifier_option_ids') <> 'array' THEN

            RAISE EXCEPTION 'Modifier selections must be supplied as an array.'
                USING ERRCODE = '22023';
        END IF;

        SELECT coalesce(
            array_agg(x.value::uuid),
            ARRAY[]::uuid[]
        )

        INTO v_modifier_ids

        FROM jsonb_array_elements_text(
            coalesce(
                v_item->'modifier_option_ids',
                '[]'::jsonb
            )
        ) AS x(value);

        -- Reject duplicate modifier IDs.

        IF cardinality(v_modifier_ids) <>
           (
               SELECT count(DISTINCT selected_id)
               FROM unnest(v_modifier_ids) AS selected_id
           ) THEN

            RAISE EXCEPTION 'Duplicate modifier selections are not allowed.'
                USING ERRCODE = '22023';
        END IF;

        -- Every selected modifier must:
        -- 1. Exist and be active.
        -- 2. Belong to this business.
        -- 3. Belong to an active group.
        -- 4. Belong to a group assigned to this menu item.

        SELECT count(*)
        INTO v_valid_modifier_count

        FROM public.food_modifier_options mo

        JOIN public.food_modifier_groups mg
          ON mg.id = mo.modifier_group_id
         AND mg.business_id = mo.business_id

        JOIN public.food_menu_item_modifier_groups mig
          ON mig.modifier_group_id = mg.id
         AND mig.menu_item_id = v_menu.id
         AND mig.business_id = p_business_id

        WHERE mo.id = ANY(v_modifier_ids)
          AND mo.business_id = p_business_id
          AND mo.active = true
          AND mg.active = true;

        IF cardinality(v_modifier_ids) <> v_valid_modifier_count THEN
            RAISE EXCEPTION 'One or more selected modifiers are invalid for this menu item.'
                USING ERRCODE = '22023';
        END IF;

        -- ----------------------------------------------------
        -- Enforce modifier group selection rules
        -- ----------------------------------------------------

        FOR v_group IN

            SELECT
                mg.id,
                mg.name,
                mg.selection_type,
                mg.min_selections,
                mg.max_selections,
                mg.required,

                count(mo.id)::integer AS selected_count

            FROM public.food_menu_item_modifier_groups mig

            JOIN public.food_modifier_groups mg
              ON mg.id = mig.modifier_group_id
             AND mg.business_id = mig.business_id

            LEFT JOIN public.food_modifier_options mo
              ON mo.modifier_group_id = mg.id
             AND mo.business_id = p_business_id
             AND mo.id = ANY(v_modifier_ids)
             AND mo.active = true

            WHERE mig.business_id = p_business_id
              AND mig.menu_item_id = v_menu.id
              AND mg.active = true

            GROUP BY
                mg.id,
                mg.name,
                mg.selection_type,
                mg.min_selections,
                mg.max_selections,
                mg.required

        LOOP

            IF v_group.selected_count <
               greatest(
                   v_group.min_selections,
                   CASE
                       WHEN v_group.required THEN 1
                       ELSE 0
                   END
               ) THEN

                RAISE EXCEPTION
                    'Please complete the required selections for modifier group: %.',
                    v_group.name
                    USING ERRCODE = '22023';

            END IF;

            IF v_group.max_selections IS NOT NULL
               AND v_group.selected_count > v_group.max_selections THEN

                RAISE EXCEPTION
                    'Too many selections for modifier group: %.',
                    v_group.name
                    USING ERRCODE = '22023';

            END IF;

            IF v_group.selection_type = 'single'
               AND v_group.selected_count > 1 THEN

                RAISE EXCEPTION
                    'Only one option may be selected for modifier group: %.',
                    v_group.name
                    USING ERRCODE = '22023';

            END IF;

        END LOOP;

        -- ----------------------------------------------------
        -- Calculate modifier price and snapshot
        -- ----------------------------------------------------

        SELECT
            coalesce(sum(mo.price_delta_cents), 0),

            coalesce(
                jsonb_agg(
                    jsonb_build_object(
                        'id', mo.id,
                        'name', mo.name,
                        'group_id', mg.id,
                        'group_name', mg.name,
                        'price_delta_cents', mo.price_delta_cents
                    )
                    ORDER BY mg.name, mo.sort_order
                ),
                '[]'::jsonb
            )

        INTO
            v_modifier_total,
            v_modifier_snapshot

        FROM public.food_modifier_options mo

        JOIN public.food_modifier_groups mg
          ON mg.id = mo.modifier_group_id
         AND mg.business_id = mo.business_id

        WHERE mo.id = ANY(v_modifier_ids)
          AND mo.business_id = p_business_id
          AND mo.active = true
          AND mg.active = true;

        IF v_unit_price + v_modifier_total < 0 THEN
            RAISE EXCEPTION 'The selected modifiers result in an invalid item price.'
                USING ERRCODE = '22023';
        END IF;

        v_line_total := round(
            (v_unit_price + v_modifier_total) * v_quantity
        )::bigint;

        v_subtotal := v_subtotal + v_line_total;

        -- ----------------------------------------------------
        -- Resolve preparation station
        -- ----------------------------------------------------

        v_station_id := NULL;

        IF v_menu.preparation_station_id IS NOT NULL THEN

            SELECT ks.id
            INTO v_station_id

            FROM public.food_kitchen_stations ks

            WHERE ks.id = v_menu.preparation_station_id
              AND ks.business_id = p_business_id
              AND ks.outlet_id = p_outlet_id
              AND ks.active = true;

            IF NOT FOUND THEN
                RAISE EXCEPTION
                    'The configured preparation station for % is unavailable at this outlet.',
                    v_menu.name
                    USING ERRCODE = '22023';
            END IF;

        ELSE

            SELECT ks.id
            INTO v_station_id

            FROM public.food_kitchen_stations ks

            WHERE ks.business_id = p_business_id
              AND ks.outlet_id = p_outlet_id
              AND ks.active = true

            ORDER BY

                CASE
                    WHEN v_menu.item_type = 'beverage'
                         AND ks.station_type = 'bar'
                    THEN 0

                    WHEN v_menu.item_type <> 'beverage'
                         AND ks.station_type IN (
                             'hot_kitchen',
                             'kitchen',
                             'grill',
                             'cold_kitchen'
                         )
                    THEN 0

                    ELSE 1
                END,

                ks.sort_order,
                ks.name

            LIMIT 1;

            IF NOT FOUND THEN
                RAISE EXCEPTION
                    'No active preparation station is configured for % at this outlet.',
                    v_menu.name
                    USING ERRCODE = '22023';
            END IF;

        END IF;

        -- ----------------------------------------------------
        -- Insert immutable order item snapshot
        -- ----------------------------------------------------

        v_order_item_id := gen_random_uuid();

        INSERT INTO public.food_order_items (
            id,
            business_id,
            order_id,
            menu_item_id,
            item_name_snapshot,
            item_type_snapshot,
            quantity,
            unit_price_cents,
            modifier_total_cents,
            line_total_cents,
            modifiers_snapshot,
            preparation_notes,
            station_id
        )
        VALUES (
            v_order_item_id,
            p_business_id,
            v_order_id,
            v_menu.id,
            v_menu.name,
            v_menu.item_type,
            v_quantity,
            v_unit_price,
            v_modifier_total,
            v_line_total,
            v_modifier_snapshot,
            nullif(btrim(v_item->>'preparation_notes'), ''),
            v_station_id
        );

    END LOOP;

    -- --------------------------------------------------------
    -- H. Calculate tax and final total
    -- --------------------------------------------------------

    IF v_tax_rate > 0 THEN

        IF v_prices_include_tax THEN

            v_tax := round(
                v_subtotal::numeric
                * v_tax_rate
                / (10000 + v_tax_rate)
            )::bigint;

            v_total := v_subtotal;

        ELSE

            v_tax := round(
                v_subtotal::numeric
                * v_tax_rate
                / 10000
            )::bigint;

            v_total := v_subtotal + v_tax;

        END IF;

    ELSE

        v_total := v_subtotal;

    END IF;

    UPDATE public.food_orders

    SET
        subtotal_cents = v_subtotal,
        tax_cents = v_tax,
        total_cents = v_total

    WHERE id = v_order_id
      AND business_id = p_business_id;

    -- --------------------------------------------------------
    -- I. Create one kitchen ticket per station
    -- --------------------------------------------------------

    FOR v_station IN

        SELECT DISTINCT oi.station_id

        FROM public.food_order_items oi

        WHERE oi.order_id = v_order_id
          AND oi.business_id = p_business_id

        ORDER BY oi.station_id

    LOOP

        INSERT INTO public.food_kitchen_tickets (
            business_id,
            outlet_id,
            order_id,
            station_id,
            ticket_number
        )
        VALUES (
            p_business_id,
            p_outlet_id,
            v_order_id,
            v_station.station_id,
            'TKT-' || upper(
                substr(
                    replace(gen_random_uuid()::text, '-', ''),
                    1,
                    8
                )
            )
        )
        RETURNING id INTO v_ticket_id;

        INSERT INTO public.food_kitchen_ticket_items (
            business_id,
            ticket_id,
            order_item_id,
            quantity,
            instruction_snapshot
        )

        SELECT
            oi.business_id,
            v_ticket_id,
            oi.id,
            oi.quantity,
            oi.preparation_notes

        FROM public.food_order_items oi

        WHERE oi.order_id = v_order_id
          AND oi.business_id = p_business_id
          AND oi.station_id = v_station.station_id;

    END LOOP;

    -- --------------------------------------------------------
    -- J. Mark table occupied
    -- --------------------------------------------------------

    IF p_table_id IS NOT NULL THEN

        UPDATE public.food_tables

        SET status = 'occupied'

        WHERE id = p_table_id
          AND business_id = p_business_id
          AND outlet_id = p_outlet_id
          AND status = 'available';

        IF NOT FOUND THEN
            RAISE EXCEPTION 'The table could not be reserved for this order.'
                USING ERRCODE = '22023';
        END IF;

    END IF;

    -- --------------------------------------------------------
    -- K. Record creation event after final totals are available
    -- --------------------------------------------------------

    INSERT INTO public.food_order_events (
        business_id,
        order_id,
        event_type,
        after_data,
        actor_id
    )
    VALUES (
        p_business_id,
        v_order_id,
        'created',
        (
            SELECT to_jsonb(o)
            FROM public.food_orders o
            WHERE o.id = v_order_id
        ),
        auth.uid()
    );

    RETURN v_order_id;

END;

$function$;

-- ============================================================
-- 4. Restrict RPC execution.
-- ============================================================

REVOKE ALL ON FUNCTION public.food_create_order(
    uuid,
    uuid,
    text,
    uuid,
    integer,
    text,
    text,
    jsonb
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.food_create_order(
    uuid,
    uuid,
    text,
    uuid,
    integer,
    text,
    text,
    jsonb
) FROM anon;

GRANT EXECUTE ON FUNCTION public.food_create_order(
    uuid,
    uuid,
    text,
    uuid,
    integer,
    text,
    text,
    jsonb
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.food_create_order(
    uuid,
    uuid,
    text,
    uuid,
    integer,
    text,
    text,
    jsonb
) TO service_role;

COMMIT;
