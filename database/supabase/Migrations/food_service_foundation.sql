-- BlaQsWatch Food & Beverage foundation
-- Additive migration: does not replace existing automotive, messaging or subscription data.
-- Monetary values are integer minor units (e.g. R95.00 = 9500).

alter table public.businesses
  add column if not exists industry text not null default 'automotive';

alter table public.businesses
  add column if not exists business_model text;

alter table public.businesses
  add column if not exists workspace_configured_at timestamptz;

-- Keep the current businesses on the automotive workspace unless explicitly changed.
update public.businesses
set industry = 'automotive'
where industry is null or btrim(industry) = '';

create table if not exists public.food_business_settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  default_currency text not null default 'ZAR',
  timezone text not null default 'Africa/Johannesburg',
  tax_rate_basis_points integer not null default 0 check (tax_rate_basis_points between 0 and 10000),
  prices_include_tax boolean not null default true,
  enabled_channels text[] not null default array['counter','takeaway']::text[],
  order_prefix text not null default 'FOOD',
  require_kitchen_acceptance boolean not null default true,
  allow_waiter_amendments boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.food_outlets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  code text,
  outlet_type text not null default 'restaurant',
  address text,
  phone text,
  timezone text not null default 'Africa/Johannesburg',
  currency text not null default 'ZAR',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, code)
);

create table if not exists public.food_service_channels (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  outlet_id uuid references public.food_outlets(id) on delete cascade,
  channel_key text not null check (channel_key in ('dine_in','counter','takeaway','collection','delivery','catering','bar_tab')),
  enabled boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (business_id, outlet_id, channel_key)
);

create table if not exists public.food_staff_roles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  outlet_id uuid references public.food_outlets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_key text not null check (role_key in ('owner','general_manager','outlet_manager','supervisor','waiter','cashier','chef','kitchen_supervisor','bartender','inventory_manager','procurement','accountant','auditor')),
  permission_keys text[] not null default '{}'::text[],
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists food_staff_roles_assignment_uidx
  on public.food_staff_roles (business_id, coalesce(outlet_id, '00000000-0000-0000-0000-000000000000'::uuid), user_id);

create table if not exists public.food_tables (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  outlet_id uuid not null references public.food_outlets(id) on delete cascade,
  table_number text not null,
  display_name text,
  capacity integer not null default 2 check (capacity > 0),
  area text,
  status text not null default 'available' check (status in ('available','occupied','reserved','cleaning','out_of_service')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (outlet_id, table_number)
);

create table if not exists public.food_menu_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  outlet_id uuid references public.food_outlets(id) on delete cascade,
  name text not null,
  description text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.food_menu_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_id uuid references public.food_menu_categories(id) on delete set null,
  name text not null,
  description text,
  sku text,
  item_type text not null default 'food' check (item_type in ('food','beverage','retail','service')),
  price_cents bigint not null default 0 check (price_cents >= 0),
  cost_cents bigint not null default 0 check (cost_cents >= 0),
  image_url text,
  preparation_station_id uuid,
  available boolean not null default true,
  active boolean not null default true,
  tax_rate_basis_points integer check (tax_rate_basis_points between 0 and 10000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.food_menu_item_outlets (
  business_id uuid not null references public.businesses(id) on delete cascade,
  menu_item_id uuid not null references public.food_menu_items(id) on delete cascade,
  outlet_id uuid not null references public.food_outlets(id) on delete cascade,
  available boolean not null default true,
  price_override_cents bigint check (price_override_cents >= 0),
  primary key (menu_item_id, outlet_id)
);

create table if not exists public.food_modifier_groups (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  selection_type text not null default 'multiple' check (selection_type in ('single','multiple')),
  min_selections integer not null default 0 check (min_selections >= 0),
  max_selections integer,
  required boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (max_selections is null or max_selections >= min_selections)
);

create table if not exists public.food_modifier_options (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  modifier_group_id uuid not null references public.food_modifier_groups(id) on delete cascade,
  name text not null,
  price_delta_cents bigint not null default 0,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.food_menu_item_modifier_groups (
  business_id uuid not null references public.businesses(id) on delete cascade,
  menu_item_id uuid not null references public.food_menu_items(id) on delete cascade,
  modifier_group_id uuid not null references public.food_modifier_groups(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (menu_item_id, modifier_group_id)
);

create table if not exists public.food_ingredients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  sku text,
  base_unit text not null check (base_unit in ('g','kg','ml','l','each','portion','pack')),
  quantity_on_hand numeric(14,3) not null default 0,
  reorder_level numeric(14,3) not null default 0,
  average_cost_cents bigint not null default 0 check (average_cost_cents >= 0),
  allergen_codes text[] not null default '{}'::text[],
  track_expiry boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.food_recipes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  menu_item_id uuid not null references public.food_menu_items(id) on delete cascade,
  yield_quantity numeric(12,3) not null default 1 check (yield_quantity > 0),
  preparation_notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (menu_item_id)
);

create table if not exists public.food_recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  recipe_id uuid not null references public.food_recipes(id) on delete cascade,
  ingredient_id uuid not null references public.food_ingredients(id) on delete restrict,
  quantity numeric(14,3) not null check (quantity > 0),
  unit text not null,
  optional boolean not null default false,
  created_at timestamptz not null default now(),
  unique (recipe_id, ingredient_id)
);

create table if not exists public.food_stock_locations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  outlet_id uuid references public.food_outlets(id) on delete cascade,
  name text not null,
  location_type text not null default 'storage' check (location_type in ('storage','kitchen','bar','fridge','freezer','other')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.food_stock_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  outlet_id uuid references public.food_outlets(id) on delete set null,
  ingredient_id uuid not null references public.food_ingredients(id) on delete restrict,
  stock_location_id uuid references public.food_stock_locations(id) on delete set null,
  movement_type text not null check (movement_type in ('receipt','sale_consumption','waste','adjustment','transfer_in','transfer_out','return','production')),
  quantity_delta numeric(14,3) not null check (quantity_delta <> 0),
  unit_cost_cents bigint not null default 0 check (unit_cost_cents >= 0),
  reference_type text,
  reference_id uuid,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.food_ingredient_batches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  ingredient_id uuid not null references public.food_ingredients(id) on delete cascade,
  batch_code text,
  quantity_remaining numeric(14,3) not null default 0 check (quantity_remaining >= 0),
  received_at timestamptz not null default now(),
  expires_at date,
  supplier_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.food_kitchen_stations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  outlet_id uuid not null references public.food_outlets(id) on delete cascade,
  name text not null,
  station_type text not null default 'kitchen' check (station_type in ('hot_kitchen','cold_kitchen','grill','bar','dessert','pass','kitchen','other')),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.food_menu_items
  drop constraint if exists food_menu_items_preparation_station_id_fkey;
alter table public.food_menu_items
  add constraint food_menu_items_preparation_station_id_fkey
  foreign key (preparation_station_id) references public.food_kitchen_stations(id) on delete set null;

create table if not exists public.food_orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  outlet_id uuid not null references public.food_outlets(id) on delete restrict,
  order_number text not null,
  channel_key text not null check (channel_key in ('dine_in','counter','takeaway','collection','delivery','catering','bar_tab')),
  table_id uuid references public.food_tables(id) on delete set null,
  customer_name text,
  customer_phone text,
  customer_reference text,
  guest_count integer check (guest_count is null or guest_count > 0),
  status text not null default 'draft' check (status in ('draft','placed','accepted','preparing','partially_ready','ready','served','collected','completed','cancelled','rejected')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','partially_paid','paid','refunded','voided')),
  subtotal_cents bigint not null default 0 check (subtotal_cents >= 0),
  discount_cents bigint not null default 0 check (discount_cents >= 0),
  tax_cents bigint not null default 0 check (tax_cents >= 0),
  total_cents bigint not null default 0 check (total_cents >= 0),
  notes text,
  placed_at timestamptz,
  promised_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  waiter_id uuid references auth.users(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (outlet_id, order_number),
  unique (business_id, idempotency_key)
);

create table if not exists public.food_order_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  order_id uuid not null references public.food_orders(id) on delete cascade,
  menu_item_id uuid references public.food_menu_items(id) on delete set null,
  item_name_snapshot text not null,
  item_type_snapshot text not null default 'food',
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  unit_price_cents bigint not null default 0 check (unit_price_cents >= 0),
  modifier_total_cents bigint not null default 0,
  line_total_cents bigint not null default 0,
  modifiers_snapshot jsonb not null default '[]'::jsonb,
  preparation_notes text,
  allergen_snapshot text[] not null default '{}'::text[],
  station_id uuid references public.food_kitchen_stations(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','accepted','preparing','ready','served','cancelled','rejected')),
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.food_order_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  order_id uuid not null references public.food_orders(id) on delete cascade,
  order_item_id uuid references public.food_order_items(id) on delete set null,
  event_type text not null check (event_type in ('created','placed','accepted','preparation_started','item_ready','ready','served','collected','completed','item_added','item_modified','item_removed','quantity_changed','table_changed','assigned','cancelled','rejected','payment_recorded','note_added')),
  before_data jsonb,
  after_data jsonb,
  reason text,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.food_kitchen_tickets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  outlet_id uuid not null references public.food_outlets(id) on delete cascade,
  order_id uuid not null references public.food_orders(id) on delete cascade,
  station_id uuid not null references public.food_kitchen_stations(id) on delete restrict,
  ticket_number text not null,
  status text not null default 'new' check (status in ('new','acknowledged','preparing','ready','completed','cancelled')),
  amendment_number integer not null default 0,
  sent_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  ready_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (outlet_id, ticket_number)
);

create table if not exists public.food_kitchen_ticket_items (
  business_id uuid not null references public.businesses(id) on delete cascade,
  ticket_id uuid not null references public.food_kitchen_tickets(id) on delete cascade,
  order_item_id uuid not null references public.food_order_items(id) on delete cascade,
  quantity numeric(12,3) not null check (quantity > 0),
  instruction_snapshot text,
  amendment_type text not null default 'new' check (amendment_type in ('new','modified','cancelled')),
  primary key (ticket_id, order_item_id)
);

create table if not exists public.food_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  outlet_id uuid not null references public.food_outlets(id) on delete restrict,
  order_id uuid not null references public.food_orders(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'ZAR',
  payment_method text not null check (payment_method in ('cash','card','eft','mobile','voucher','account','other')),
  status text not null default 'posted' check (status in ('pending','posted','reversed','refunded')),
  reference text,
  idempotency_key text,
  received_by uuid references auth.users(id) on delete set null,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (business_id, idempotency_key)
);

create table if not exists public.food_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  outlet_id uuid references public.food_outlets(id) on delete set null,
  supplier_id uuid,
  purchase_number text not null,
  status text not null default 'draft' check (status in ('draft','submitted','partially_received','received','cancelled')),
  subtotal_cents bigint not null default 0,
  tax_cents bigint not null default 0,
  total_cents bigint not null default 0,
  expected_at date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, purchase_number)
);

create table if not exists public.food_purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  purchase_order_id uuid not null references public.food_purchase_orders(id) on delete cascade,
  ingredient_id uuid not null references public.food_ingredients(id) on delete restrict,
  quantity_ordered numeric(14,3) not null check (quantity_ordered > 0),
  quantity_received numeric(14,3) not null default 0 check (quantity_received >= 0),
  unit_cost_cents bigint not null default 0 check (unit_cost_cents >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.food_waste_records (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  outlet_id uuid references public.food_outlets(id) on delete set null,
  ingredient_id uuid references public.food_ingredients(id) on delete set null,
  menu_item_id uuid references public.food_menu_items(id) on delete set null,
  quantity numeric(14,3) not null check (quantity > 0),
  unit text not null,
  reason text not null,
  estimated_cost_cents bigint not null default 0,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.food_reservations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  outlet_id uuid not null references public.food_outlets(id) on delete cascade,
  table_id uuid references public.food_tables(id) on delete set null,
  customer_name text not null,
  customer_phone text,
  guest_count integer not null default 2 check (guest_count > 0),
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'booked' check (status in ('booked','confirmed','seated','completed','cancelled','no_show')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Composite uniqueness and foreign keys prevent records from one business being
-- attached to another business's outlet, menu, order, recipe or stock record.
create unique index if not exists food_outlets_business_id_uidx on public.food_outlets(business_id, id);
create unique index if not exists food_tables_business_id_uidx on public.food_tables(business_id, id);
create unique index if not exists food_menu_categories_business_id_uidx on public.food_menu_categories(business_id, id);
create unique index if not exists food_menu_items_business_id_uidx on public.food_menu_items(business_id, id);
create unique index if not exists food_modifier_groups_business_id_uidx on public.food_modifier_groups(business_id, id);
create unique index if not exists food_modifier_options_business_id_uidx on public.food_modifier_options(business_id, id);
create unique index if not exists food_ingredients_business_id_uidx on public.food_ingredients(business_id, id);
create unique index if not exists food_recipes_business_id_uidx on public.food_recipes(business_id, id);
create unique index if not exists food_kitchen_stations_business_id_uidx on public.food_kitchen_stations(business_id, id);
create unique index if not exists food_orders_business_id_uidx on public.food_orders(business_id, id);
create unique index if not exists food_order_items_business_id_uidx on public.food_order_items(business_id, id);
create unique index if not exists food_kitchen_tickets_business_id_uidx on public.food_kitchen_tickets(business_id, id);
create unique index if not exists food_purchase_orders_business_id_uidx on public.food_purchase_orders(business_id, id);

do $$
declare c record;
begin
  for c in select * from (values
    ('food_tables','food_tables_outlet_business_fk','foreign key (business_id, outlet_id) references public.food_outlets(business_id, id) on delete cascade'),
    ('food_menu_categories','food_menu_categories_outlet_business_fk','foreign key (business_id, outlet_id) references public.food_outlets(business_id, id) on delete cascade'),
    ('food_orders','food_orders_outlet_business_fk','foreign key (business_id, outlet_id) references public.food_outlets(business_id, id)'),
    ('food_orders','food_orders_table_business_fk','foreign key (business_id, table_id) references public.food_tables(business_id, id)'),
    ('food_kitchen_stations','food_kitchen_stations_outlet_business_fk','foreign key (business_id, outlet_id) references public.food_outlets(business_id, id) on delete cascade'),
    ('food_menu_items','food_menu_items_category_business_fk','foreign key (business_id, category_id) references public.food_menu_categories(business_id, id)'),
    ('food_menu_item_outlets','food_menu_item_outlets_item_business_fk','foreign key (business_id, menu_item_id) references public.food_menu_items(business_id, id) on delete cascade'),
    ('food_menu_item_outlets','food_menu_item_outlets_outlet_business_fk','foreign key (business_id, outlet_id) references public.food_outlets(business_id, id) on delete cascade'),
    ('food_modifier_options','food_modifier_options_group_business_fk','foreign key (business_id, modifier_group_id) references public.food_modifier_groups(business_id, id) on delete cascade'),
    ('food_menu_item_modifier_groups','food_menu_item_modifier_groups_item_business_fk','foreign key (business_id, menu_item_id) references public.food_menu_items(business_id, id) on delete cascade'),
    ('food_menu_item_modifier_groups','food_menu_item_modifier_groups_group_business_fk','foreign key (business_id, modifier_group_id) references public.food_modifier_groups(business_id, id) on delete cascade'),
    ('food_recipes','food_recipes_menu_item_business_fk','foreign key (business_id, menu_item_id) references public.food_menu_items(business_id, id) on delete cascade'),
    ('food_recipe_ingredients','food_recipe_ingredients_recipe_business_fk','foreign key (business_id, recipe_id) references public.food_recipes(business_id, id) on delete cascade'),
    ('food_recipe_ingredients','food_recipe_ingredients_ingredient_business_fk','foreign key (business_id, ingredient_id) references public.food_ingredients(business_id, id) on delete restrict'),
    ('food_order_items','food_order_items_order_business_fk','foreign key (business_id, order_id) references public.food_orders(business_id, id) on delete cascade'),
    ('food_order_items','food_order_items_menu_business_fk','foreign key (business_id, menu_item_id) references public.food_menu_items(business_id, id)'),
    ('food_kitchen_tickets','food_kitchen_tickets_order_business_fk','foreign key (business_id, order_id) references public.food_orders(business_id, id) on delete cascade'),
    ('food_kitchen_tickets','food_kitchen_tickets_station_business_fk','foreign key (business_id, station_id) references public.food_kitchen_stations(business_id, id)'),
    ('food_kitchen_ticket_items','food_kitchen_ticket_items_ticket_business_fk','foreign key (business_id, ticket_id) references public.food_kitchen_tickets(business_id, id) on delete cascade'),
    ('food_kitchen_ticket_items','food_kitchen_ticket_items_item_business_fk','foreign key (business_id, order_item_id) references public.food_order_items(business_id, id) on delete cascade'),
    ('food_stock_movements','food_stock_movements_ingredient_business_fk','foreign key (business_id, ingredient_id) references public.food_ingredients(business_id, id)'),
    ('food_ingredient_batches','food_ingredient_batches_ingredient_business_fk','foreign key (business_id, ingredient_id) references public.food_ingredients(business_id, id) on delete cascade'),
    ('food_payments','food_payments_outlet_business_fk','foreign key (business_id, outlet_id) references public.food_outlets(business_id, id)'),
    ('food_payments','food_payments_order_business_fk','foreign key (business_id, order_id) references public.food_orders(business_id, id)'),
    ('food_purchase_order_items','food_purchase_order_items_order_business_fk','foreign key (business_id, purchase_order_id) references public.food_purchase_orders(business_id, id) on delete cascade'),
    ('food_purchase_order_items','food_purchase_order_items_ingredient_business_fk','foreign key (business_id, ingredient_id) references public.food_ingredients(business_id, id)')
  ) as constraints(table_name, constraint_name, definition)
  loop
    if not exists (select 1 from pg_constraint where conname = c.constraint_name and conrelid = format('public.%I', c.table_name)::regclass) then
      execute format('alter table public.%I add constraint %I %s', c.table_name, c.constraint_name, c.definition);
    end if;
  end loop;
end $$;

-- Membership helper: business_members is the existing authorization boundary.
create or replace function public.food_is_business_member(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.business_members bm
    where bm.business_id = p_business_id
      and bm.user_id = auth.uid()
      and bm.active = true
  );
$$;

create or replace function public.food_has_permission(p_business_id uuid, p_permission text, p_outlet_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.business_members bm
      where bm.business_id = p_business_id
        and bm.user_id = auth.uid()
        and bm.active = true
        and lower(coalesce(bm.role::text, '')) in ('owner','admin','business_admin','general_manager','company_admin','manager')
    )
    or exists (
      select 1 from public.food_staff_roles fsr
      where fsr.business_id = p_business_id
        and fsr.user_id = auth.uid()
        and fsr.active = true
        and (fsr.outlet_id is null or fsr.outlet_id = p_outlet_id)
        and (
          p_permission = any(fsr.permission_keys)
          or 'food.*' = any(fsr.permission_keys)
          or case fsr.role_key
            when 'owner' then true
            when 'general_manager' then true
            when 'outlet_manager' then p_permission in ('food.manage','menu.manage','tables.manage','orders.create','orders.amend','orders.manage','kitchen.manage','stock.manage','payments.manage','reports.read','purchasing.manage')
            when 'supervisor' then p_permission in ('tables.manage','orders.create','orders.amend','orders.manage','kitchen.manage','stock.read','reports.read')
            when 'waiter' then p_permission in ('menu.read','tables.read','tables.manage','orders.create','orders.read','orders.amend')
            when 'cashier' then p_permission in ('menu.read','orders.read','payments.read','payments.manage','reports.read')
            when 'chef' then p_permission in ('orders.read','kitchen.read','kitchen.manage')
            when 'kitchen_supervisor' then p_permission in ('orders.read','kitchen.read','kitchen.manage','reports.read')
            when 'bartender' then p_permission in ('menu.read','orders.read','orders.create','kitchen.read','kitchen.manage')
            when 'inventory_manager' then p_permission in ('stock.read','stock.manage','menu.read','reports.read')
            when 'procurement' then p_permission in ('stock.read','purchasing.read','purchasing.manage')
            when 'accountant' then p_permission in ('orders.read','payments.read','reports.read')
            when 'auditor' then p_permission in ('orders.read','payments.read','reports.read','stock.read')
            else false
          end
        )
    );
$$;

create or replace function public.food_has_ticket_permission(p_business_id uuid, p_ticket_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.food_has_permission(
    p_business_id,
    p_permission,
    (select outlet_id from public.food_kitchen_tickets where id = p_ticket_id and business_id = p_business_id)
  );
$$;

revoke all on function public.food_is_business_member(uuid) from public, anon;
revoke all on function public.food_has_permission(uuid, text, uuid) from public, anon;
revoke all on function public.food_has_ticket_permission(uuid, uuid, text) from public, anon;
grant execute on function public.food_is_business_member(uuid) to authenticated;
grant execute on function public.food_has_permission(uuid, text, uuid) to authenticated;
grant execute on function public.food_has_ticket_permission(uuid, uuid, text) to authenticated;

create or replace function public.food_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- Updated-at triggers on mutable food-service entities.
do $$
declare t text;
begin
  foreach t in array array[
    'food_business_settings','food_outlets','food_staff_roles','food_tables',
    'food_menu_categories','food_menu_items','food_modifier_groups','food_modifier_options',
    'food_ingredients','food_recipes','food_kitchen_stations','food_orders',
    'food_order_items','food_kitchen_tickets','food_purchase_orders','food_reservations'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t || '_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.food_set_updated_at()', t || '_updated_at', t);
  end loop;
end $$;

-- Indexes for outlet operations, order queues and stock reporting.
create index if not exists food_outlets_business_idx on public.food_outlets(business_id, active);
create index if not exists food_tables_outlet_status_idx on public.food_tables(outlet_id, status);
create index if not exists food_menu_items_business_category_idx on public.food_menu_items(business_id, category_id, active);
create index if not exists food_ingredients_business_name_idx on public.food_ingredients(business_id, name);
create index if not exists food_orders_outlet_status_created_idx on public.food_orders(outlet_id, status, created_at desc);
create index if not exists food_orders_business_created_idx on public.food_orders(business_id, created_at desc);
create index if not exists food_order_items_order_idx on public.food_order_items(order_id, created_at);
create index if not exists food_order_events_order_created_idx on public.food_order_events(order_id, created_at desc);
create index if not exists food_kitchen_tickets_station_status_idx on public.food_kitchen_tickets(station_id, status, sent_at);
create index if not exists food_stock_movements_ingredient_created_idx on public.food_stock_movements(ingredient_id, created_at desc);
create index if not exists food_reservations_outlet_start_idx on public.food_reservations(outlet_id, starts_at);

-- Enable RLS on every food-service table.
do $$
declare t text;
begin
  foreach t in array array[
    'food_business_settings','food_outlets','food_service_channels','food_staff_roles',
    'food_tables','food_menu_categories','food_menu_items','food_menu_item_outlets',
    'food_modifier_groups','food_modifier_options','food_menu_item_modifier_groups',
    'food_ingredients','food_recipes','food_recipe_ingredients','food_stock_locations',
    'food_stock_movements','food_ingredient_batches','food_kitchen_stations','food_orders',
    'food_order_items','food_order_events','food_kitchen_tickets','food_kitchen_ticket_items',
    'food_payments','food_purchase_orders','food_purchase_order_items','food_waste_records','food_reservations'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Read and write policies respect business membership and, for outlet-scoped
-- entities, the assigned outlet. Business-wide catalogue data remains readable
-- to active business members; write permissions remain role-gated.
do $$
declare t text; permission_key text; read_key text; outlet_expr text;
begin
  foreach t in array array[
    'food_business_settings','food_outlets','food_service_channels','food_staff_roles',
    'food_tables','food_menu_categories','food_menu_items','food_menu_item_outlets',
    'food_modifier_groups','food_modifier_options','food_menu_item_modifier_groups',
    'food_ingredients','food_recipes','food_recipe_ingredients','food_stock_locations',
    'food_stock_movements','food_ingredient_batches','food_kitchen_stations','food_orders',
    'food_order_items','food_order_events','food_kitchen_tickets','food_kitchen_ticket_items',
    'food_payments','food_purchase_orders','food_purchase_order_items','food_waste_records','food_reservations'
  ] loop
    permission_key := case
      when t in ('food_business_settings','food_outlets','food_service_channels','food_staff_roles') then 'food.manage'
      when t in ('food_tables','food_reservations') then 'tables.manage'
      when t in ('food_menu_categories','food_menu_items','food_menu_item_outlets','food_modifier_groups','food_modifier_options','food_menu_item_modifier_groups') then 'menu.manage'
      when t in ('food_ingredients','food_recipes','food_recipe_ingredients','food_stock_locations','food_stock_movements','food_ingredient_batches','food_waste_records') then 'stock.manage'
      when t = 'food_kitchen_stations' then 'kitchen.manage'
      when t in ('food_kitchen_tickets','food_kitchen_ticket_items') then 'kitchen.manage'
      when t = 'food_payments' then 'payments.manage'
      when t in ('food_purchase_orders','food_purchase_order_items') then 'purchasing.manage'
      when t = 'food_orders' then 'orders.create'
      when t in ('food_order_items','food_order_events') then 'orders.amend'
      else 'food.manage'
    end;
    read_key := case
      when t in ('food_tables','food_reservations') then 'tables.read'
      when t in ('food_menu_categories','food_menu_items','food_menu_item_outlets','food_modifier_groups','food_modifier_options','food_menu_item_modifier_groups') then 'menu.read'
      when t in ('food_ingredients','food_recipes','food_recipe_ingredients','food_stock_locations','food_stock_movements','food_ingredient_batches','food_waste_records') then 'stock.read'
      when t in ('food_kitchen_stations','food_kitchen_tickets','food_kitchen_ticket_items') then 'kitchen.read'
      when t = 'food_payments' then 'payments.read'
      when t in ('food_purchase_orders','food_purchase_order_items') then 'purchasing.read'
      when t in ('food_orders','food_order_items','food_order_events') then 'orders.read'
      else 'food.manage'
    end;
    outlet_expr := case
      when t in ('food_tables','food_stock_movements','food_kitchen_stations','food_orders','food_kitchen_tickets','food_payments','food_purchase_orders','food_waste_records','food_reservations') then 'outlet_id'
      when t in ('food_order_items','food_order_events') then '(select o.outlet_id from public.food_orders o where o.id = order_id)'
      when t = 'food_kitchen_ticket_items' then '(select kt.outlet_id from public.food_kitchen_tickets kt where kt.id = ticket_id)'
      when t = 'food_purchase_order_items' then '(select po.outlet_id from public.food_purchase_orders po where po.id = purchase_order_id)'
      else 'null'
    end;
    execute format('drop policy if exists %I on public.%I', t || '_member_access', t);
    execute format('drop policy if exists %I on public.%I', t || '_member_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_permission_write', t);
    if outlet_expr = 'null' then
      execute format('create policy %I on public.%I for select to authenticated using (public.food_is_business_member(business_id))', t || '_member_read', t);
    else
      execute format('create policy %I on public.%I for select to authenticated using (public.food_is_business_member(business_id) and public.food_has_permission(business_id, %L, %s))', t || '_member_read', t, read_key, outlet_expr);
    end if;
    execute format('create policy %I on public.%I for all to authenticated using (public.food_is_business_member(business_id) and public.food_has_permission(business_id, %L, %s)) with check (public.food_is_business_member(business_id) and public.food_has_permission(business_id, %L, %s))', t || '_permission_write', t, permission_key, outlet_expr, permission_key, outlet_expr);
  end loop;
end $$;

-- Kitchen staff may advance the preparation state of their order items and
-- update the aggregate order status when all stations have completed.
drop policy if exists food_order_items_kitchen_update on public.food_order_items;
create policy food_order_items_kitchen_update on public.food_order_items
  for update to authenticated using (
    public.food_is_business_member(business_id)
    and public.food_has_permission(business_id, 'kitchen.manage', (select o.outlet_id from public.food_orders o where o.id = order_id))
  ) with check (
    public.food_is_business_member(business_id)
    and public.food_has_permission(business_id, 'kitchen.manage', (select o.outlet_id from public.food_orders o where o.id = order_id))
  );
drop policy if exists food_orders_kitchen_update on public.food_orders;
create policy food_orders_kitchen_update on public.food_orders
  for update to authenticated using (
    public.food_is_business_member(business_id)
    and public.food_has_permission(business_id, 'kitchen.manage', outlet_id)
  ) with check (
    public.food_is_business_member(business_id)
    and public.food_has_permission(business_id, 'kitchen.manage', outlet_id)
  );
drop policy if exists food_order_events_kitchen_insert on public.food_order_events;
create policy food_order_events_kitchen_insert on public.food_order_events
  for insert to authenticated with check (
    public.food_is_business_member(business_id)
    and public.food_has_permission(business_id, 'kitchen.manage', (select o.outlet_id from public.food_orders o where o.id = order_id))
  );

-- Waiters may create kitchen tickets as part of placing an order; kitchen staff
-- retain control over acknowledgement and preparation updates.
drop policy if exists food_kitchen_tickets_waiter_insert on public.food_kitchen_tickets;
create policy food_kitchen_tickets_waiter_insert on public.food_kitchen_tickets
  for insert to authenticated with check (
    public.food_is_business_member(business_id)
    and public.food_has_permission(business_id, 'orders.create', outlet_id)
  );
drop policy if exists food_kitchen_ticket_items_waiter_insert on public.food_kitchen_ticket_items;
create policy food_kitchen_ticket_items_waiter_insert on public.food_kitchen_ticket_items
  for insert to authenticated with check (
    public.food_is_business_member(business_id)
    and public.food_has_ticket_permission(business_id, ticket_id, 'orders.create')
  );

-- Basic automatic order event when a new order is created.
create or replace function public.food_log_order_created()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  insert into public.food_order_events (business_id, order_id, event_type, after_data, actor_id)
  values (new.business_id, new.id, 'created', to_jsonb(new), auth.uid());
  return new;
end;
$$;
drop trigger if exists food_orders_log_created on public.food_orders;
create trigger food_orders_log_created after insert on public.food_orders
for each row execute function public.food_log_order_created();

-- Realtime for live waiter and kitchen screens. Safe when publication is absent or tables already added.
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['food_orders','food_order_items','food_order_events','food_kitchen_tickets','food_kitchen_ticket_items','food_tables'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

comment on table public.food_orders is 'Food-service orders across dine-in, counter, takeaway, collection, delivery, catering and bar tabs.';
comment on table public.food_order_events is 'Append-only audit trail for order creation, amendments, fulfilment and payment events.';
comment on column public.food_menu_items.price_cents is 'Integer minor currency units; ZAR 95.00 is stored as 9500.';
comment on column public.food_order_items.item_name_snapshot is 'Historical item description retained even if the menu item is later changed or archived.';

-- Atomic POS order creation. The server calculates item prices from the live menu
-- and modifier options; the client never supplies trusted line totals.
create or replace function public.food_create_order(
  p_business_id uuid,
  p_outlet_id uuid,
  p_channel text,
  p_table_id uuid default null,
  p_guest_count integer default null,
  p_notes text default null,
  p_customer_name text default null,
  p_items jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order_id uuid := gen_random_uuid();
  v_order_number text;
  v_item jsonb;
  v_menu public.food_menu_items%rowtype;
  v_item_id uuid;
  v_order_item_id uuid;
  v_ticket_id uuid;
  v_station_id uuid;
  v_quantity numeric(12,3);
  v_modifier_total bigint;
  v_line_total bigint;
  v_subtotal bigint := 0;
  v_tax bigint := 0;
  v_total bigint := 0;
  v_tax_rate integer := 0;
  v_prices_include_tax boolean := true;
  v_modifier_ids uuid[];
  v_modifier_snapshot jsonb;
  v_item_count integer := 0;
begin
  if not public.food_is_business_member(p_business_id) then
    raise exception 'You do not have access to this business.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.food_outlets where id = p_outlet_id and business_id = p_business_id and active) then
    raise exception 'The selected outlet is invalid or inactive.' using errcode = '22023';
  end if;
  if p_channel not in ('dine_in','counter','takeaway','collection','delivery','catering','bar_tab') then
    raise exception 'Unsupported service channel.' using errcode = '22023';
  end if;
  if p_channel = 'dine_in' and p_table_id is null then
    raise exception 'A table is required for dine-in orders.' using errcode = '22023';
  end if;
  if p_table_id is not null and not exists (
    select 1 from public.food_tables where id = p_table_id and outlet_id = p_outlet_id and business_id = p_business_id and active
  ) then raise exception 'The selected table does not belong to this outlet.' using errcode = '22023'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one menu item to the order.' using errcode = '22023';
  end if;

  select tax_rate_basis_points, prices_include_tax into v_tax_rate, v_prices_include_tax
  from public.food_business_settings where business_id = p_business_id;
  v_tax_rate := coalesce(v_tax_rate, 0);
  v_prices_include_tax := coalesce(v_prices_include_tax, true);

  v_order_number := 'FOOD-' || to_char(now() at time zone 'Africa/Johannesburg', 'YYMMDD') || '-' || upper(substr(replace(v_order_id::text, '-', ''), 1, 6));
  insert into public.food_orders (
    id, business_id, outlet_id, order_number, channel_key, table_id, customer_name,
    guest_count, status, notes, created_by, waiter_id, placed_at
  ) values (
    v_order_id, p_business_id, p_outlet_id, v_order_number, p_channel, p_table_id,
    nullif(btrim(p_customer_name), ''), p_guest_count, 'placed', nullif(btrim(p_notes), ''),
    auth.uid(), auth.uid(), now()
  );

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_item_count := v_item_count + 1;
    select * into v_menu from public.food_menu_items
    where id = (v_item->>'menu_item_id')::uuid
      and business_id = p_business_id and active = true and available = true;
    if not found then raise exception 'A selected menu item is unavailable.' using errcode = '22023'; end if;
    v_quantity := greatest(0.001, coalesce((v_item->>'quantity')::numeric, 1));
    v_modifier_ids := array(
      select jsonb_array_elements_text(coalesce(v_item->'modifier_option_ids', '[]'::jsonb))::uuid
    );
    select coalesce(sum(mo.price_delta_cents), 0),
           coalesce(jsonb_agg(jsonb_build_object('id',mo.id,'name',mo.name,'price_delta_cents',mo.price_delta_cents)), '[]'::jsonb)
      into v_modifier_total, v_modifier_snapshot
    from public.food_modifier_options mo
    where mo.id = any(v_modifier_ids) and mo.business_id = p_business_id and mo.active = true;
    if cardinality(v_modifier_ids) <> (select count(*) from public.food_modifier_options mo where mo.id = any(v_modifier_ids) and mo.business_id = p_business_id and mo.active = true) then
      raise exception 'One or more selected modifiers are invalid.' using errcode = '22023';
    end if;
    v_line_total := round((v_menu.price_cents + v_modifier_total) * v_quantity)::bigint;
    v_subtotal := v_subtotal + v_line_total;
    v_station_id := v_menu.preparation_station_id;
    if v_station_id is null then
      select id into v_station_id from public.food_kitchen_stations
      where outlet_id = p_outlet_id and business_id = p_business_id and active
      order by case when station_type = 'bar' and v_menu.item_type = 'beverage' then 0 when station_type in ('hot_kitchen','kitchen') and v_menu.item_type <> 'beverage' then 0 else 1 end, sort_order
      limit 1;
    end if;
    v_order_item_id := gen_random_uuid();
    insert into public.food_order_items (
      id, business_id, order_id, menu_item_id, item_name_snapshot, item_type_snapshot,
      quantity, unit_price_cents, modifier_total_cents, line_total_cents,
      modifiers_snapshot, preparation_notes, station_id
    ) values (
      v_order_item_id, p_business_id, v_order_id, v_menu.id, v_menu.name, v_menu.item_type,
      v_quantity, v_menu.price_cents, v_modifier_total, v_line_total,
      v_modifier_snapshot, nullif(btrim(v_item->>'preparation_notes'), ''), v_station_id
    );
    if v_station_id is not null then
      insert into public.food_kitchen_tickets (
        business_id, outlet_id, order_id, station_id, ticket_number
      ) values (
        p_business_id, p_outlet_id, v_order_id, v_station_id,
        'TKT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
      ) returning id into v_ticket_id;
      insert into public.food_kitchen_ticket_items (business_id, ticket_id, order_item_id, quantity, instruction_snapshot)
      values (p_business_id, v_ticket_id, v_order_item_id, v_quantity, nullif(btrim(v_item->>'preparation_notes'), ''));
    end if;
  end loop;

  if v_tax_rate > 0 then
    if v_prices_include_tax then
      v_tax := round(v_subtotal::numeric * v_tax_rate / (10000 + v_tax_rate))::bigint;
      v_total := v_subtotal;
    else
      v_tax := round(v_subtotal::numeric * v_tax_rate / 10000)::bigint;
      v_total := v_subtotal + v_tax;
    end if;
  else
    v_total := v_subtotal;
  end if;

  update public.food_orders
  set subtotal_cents = v_subtotal, tax_cents = v_tax, total_cents = v_total
  where id = v_order_id;

  if p_table_id is not null then
    update public.food_tables set status = 'occupied' where id = p_table_id;
  end if;
  return v_order_id;
end;
$$;

revoke all on function public.food_create_order(uuid,uuid,text,uuid,integer,text,text,jsonb) from public, anon;
grant execute on function public.food_create_order(uuid,uuid,text,uuid,integer,text,text,jsonb) to authenticated;
