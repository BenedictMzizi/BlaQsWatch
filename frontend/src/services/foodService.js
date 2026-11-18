
import { supabase } from '../lib/supabase';

export const FOOD_CHANNELS = [
  { value: 'dine_in', label: 'Dine-in' },
  { value: 'counter', label: 'Counter' },
  { value: 'takeaway', label: 'Takeaway' },
  { value: 'collection', label: 'Collection' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'catering', label: 'Catering' },
  { value: 'bar_tab', label: 'Bar tab' },
];

export const RECIPE_UNITS = [
  { value: 'mg', label: 'Milligrams', type: 'weight', factor: 0.001 },
  { value: 'g', label: 'Grams', type: 'weight', factor: 1 },
  { value: 'kg', label: 'Kilograms', type: 'weight', factor: 1000 },
  { value: 'ml', label: 'Millilitres', type: 'volume', factor: 1 },
  { value: 'l', label: 'Litres', type: 'volume', factor: 1000 },
  { value: 'each', label: 'Each', type: 'count', factor: 1 },
  { value: 'unit', label: 'Unit', type: 'count', factor: 1 },
  { value: 'piece', label: 'Piece', type: 'count', factor: 1 },
  { value: 'dozen', label: 'Dozen', type: 'count', factor: 12 },
  { value: 'portion', label: 'Portion', type: 'custom', factor: 1 },
  { value: 'pack', label: 'Pack', type: 'custom', factor: 1 },
];

export const money = cents =>
  new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
  }).format((Number(cents) || 0) / 100);

const normaliseUnit = unit =>
  String(unit || '').trim().toLowerCase();

export function getCompatibleRecipeUnits(baseUnit) {
  const base = normaliseUnit(baseUnit);
  const definition = RECIPE_UNITS.find(unit => unit.value === base);

  if (!definition) {
    return [{ value: base, label: base, type: 'custom', factor: 1 }];
  }

  return RECIPE_UNITS.filter(unit => {
    if (definition.type === 'custom') {
      return unit.value === base;
    }

    return unit.type === definition.type;
  });
}

/**
 * Converts a recipe quantity into the ingredient's stock/base unit.
 * Returns null when the units cannot safely be converted.
 */
export function convertRecipeQuantity(quantity, recipeUnit, baseUnit) {
  const amount = Number(quantity);
  const from = normaliseUnit(recipeUnit);
  const to = normaliseUnit(baseUnit);

  if (!Number.isFinite(amount) || amount < 0 || !from || !to) {
    return null;
  }

  const fromDefinition = RECIPE_UNITS.find(unit => unit.value === from);
  const toDefinition = RECIPE_UNITS.find(unit => unit.value === to);

  if (!fromDefinition || !toDefinition) {
    return from === to ? amount : null;
  }

  if (fromDefinition.type !== toDefinition.type) {
    return null;
  }

  if (fromDefinition.type === 'custom') {
    return from === to ? amount : null;
  }

  return amount * fromDefinition.factor / toDefinition.factor;
}

/**
 * Calculates the cost of one recipe ingredient line.
 * average_cost_cents is the cost of one ingredient base unit.
 */
export function calculateRecipeIngredientCost({
  quantity,
  recipeUnit,
  ingredient,
}) {
  if (!ingredient) {
    return {
      valid: false,
      quantityInBaseUnit: null,
      costCents: 0,
      error: 'Select an ingredient.',
    };
  }

  const quantityInBaseUnit = convertRecipeQuantity(
    quantity,
    recipeUnit,
    ingredient.base_unit
  );

  if (quantityInBaseUnit === null) {
    return {
      valid: false,
      quantityInBaseUnit: null,
      costCents: 0,
      error: `Cannot convert ${recipeUnit} to ${ingredient.base_unit}.`,
    };
  }

  const unitCost = Number(ingredient.average_cost_cents || 0);

  return {
    valid: true,
    quantityInBaseUnit,
    costCents: Math.round(quantityInBaseUnit * unitCost),
    error: '',
  };
}

export function calculateRecipeCost(recipe, ingredients) {
  const lines = (recipe?.food_recipe_ingredients || []).map(line => {
    const ingredient = ingredients.find(
      item => item.id === line.ingredient_id
    );

    const calculation = calculateRecipeIngredientCost({
      quantity: line.quantity,
      recipeUnit: line.unit,
      ingredient,
    });

    return {
      ...line,
      ingredient,
      ...calculation,
    };
  });

  const invalidLines = lines.filter(line => !line.valid);

  const totalCostCents = lines.reduce(
    (sum, line) => sum + (line.valid ? line.costCents : 0),
    0
  );

  const yieldQuantity = Number(recipe?.yield_quantity || 1);
  const menuItem = recipe?.menuItem;

  const costPerServingCents =
    yieldQuantity > 0
      ? Math.round(totalCostCents / yieldQuantity)
      : 0;

  const sellingPriceCents = Number(menuItem?.price_cents || 0);
  const grossProfitCents = sellingPriceCents - costPerServingCents;

  const grossMargin =
    sellingPriceCents > 0
      ? (grossProfitCents / sellingPriceCents) * 100
      : 0;

  return {
    lines,
    totalCostCents,
    costPerServingCents,
    sellingPriceCents,
    grossProfitCents,
    grossMargin,
    valid: invalidLines.length === 0 && lines.length > 0,
    invalidLines,
  };
}

export async function getFoodWorkspace(businessId) {
  if (!businessId) {
    throw new Error(
      'A business must be selected before loading Food & Beverage.'
    );
  }

  const [
    { data: outlets, error: outletError },
    { data: settings, error: settingsError },
  ] = await Promise.all([
    supabase
      .from('food_outlets')
      .select('*')
      .eq('business_id', businessId)
      .eq('active', true)
      .order('created_at'),

    supabase
      .from('food_business_settings')
      .select('*')
      .eq('business_id', businessId)
      .maybeSingle(),
  ]);

  if (outletError) throw outletError;
  if (settingsError) throw settingsError;

  return {
    outlets: outlets || [],
    settings: settings || null,
  };
}

export async function createFoodOutlet({
  businessId,
  name,
  outletType,
}) {
  if (!businessId) {
    throw new Error(
      'A business must be selected before creating an outlet.'
    );
  }

  const cleanName = String(name || '').trim();

  if (!cleanName) throw new Error('Enter an outlet name.');
  if (!outletType) throw new Error('Select an outlet business model.');

  const { data: outlet, error: outletError } = await supabase
    .from('food_outlets')
    .insert({
      business_id: businessId,
      name: cleanName,
      outlet_type: outletType,
      code: `OUT-${Date.now().toString().slice(-6)}`,
    })
    .select('*')
    .single();

  if (outletError) throw outletError;

  const { error: settingsError } = await supabase
    .from('food_business_settings')
    .upsert(
      {
        business_id: businessId,
        default_currency: 'ZAR',
        timezone: 'Africa/Johannesburg',
        enabled_channels: FOOD_CHANNELS.map(channel => channel.value),
      },
      { onConflict: 'business_id' }
    );

  if (settingsError) throw settingsError;

  const channelRows = FOOD_CHANNELS.map(channel => ({
    business_id: businessId,
    outlet_id: outlet.id,
    channel_key: channel.value,
    enabled: true,
  }));

  const { error: channelError } = await supabase
    .from('food_service_channels')
    .upsert(channelRows, {
      onConflict: 'business_id,outlet_id,channel_key',
    });

  if (channelError) throw channelError;

  const { error: stationError } = await supabase
    .from('food_kitchen_stations')
    .insert([
      {
        business_id: businessId,
        outlet_id: outlet.id,
        name: 'Kitchen',
        station_type: 'kitchen',
      },
      {
        business_id: businessId,
        outlet_id: outlet.id,
        name: 'Bar',
        station_type: 'bar',
      },
    ]);

  if (stationError) throw stationError;

  return outlet;
}

export async function placeFoodOrder({
  businessId,
  outletId,
  channel,
  tableId,
  guestCount,
  notes,
  customerName,
  items,
}) {
  if (!businessId) {
    throw new Error('A business must be selected before placing an order.');
  }

  if (!outletId) throw new Error('Select an outlet before placing an order.');
  if (!channel) throw new Error('Select a service channel.');

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Add at least one menu item to the order.');
  }

  const payload = items.map(item => {
    const quantity = Number(item.quantity || 1);

    if (!item.id) {
      throw new Error('An order item is missing its menu item ID.');
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`Invalid quantity for ${item.name || 'a menu item'}.`);
    }

    return {
      menu_item_id: item.id,
      quantity,
      preparation_notes: item.preparationNotes || '',
      modifier_option_ids: item.modifierOptionIds || [],
    };
  });

  const { data, error } = await supabase.rpc('food_create_order', {
    p_business_id: businessId,
    p_outlet_id: outletId,
    p_channel: channel,
    p_table_id: tableId || null,
    p_guest_count: guestCount ? Number(guestCount) : null,
    p_notes: notes || null,
    p_customer_name: customerName || null,
    p_items: payload,
  });

  if (error) throw error;

  return data;
}

/**
 * Saves a recipe and replaces its ingredient lines.
 * This uses the existing food_recipes and food_recipe_ingredients tables.
 */
export async function saveFoodRecipe({
  businessId,
  menuItemId,
  recipeId,
  yieldQuantity,
  preparationNotes,
  ingredients,
}) {
  if (!businessId || !menuItemId) {
    throw new Error('Select a menu item for this recipe.');
  }

  const yieldValue = Number(yieldQuantity);

  if (!Number.isFinite(yieldValue) || yieldValue <= 0) {
    throw new Error('Recipe yield must be greater than zero.');
  }

  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    throw new Error('Add at least one ingredient to the recipe.');
  }

  const cleanLines = ingredients.map(line => {
    const quantity = Number(line.quantity);
    const ingredientId = line.ingredient_id;
    const unit = normaliseUnit(line.unit);

    if (!ingredientId) {
      throw new Error('Every recipe line must have an ingredient.');
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Ingredient quantities must be greater than zero.');
    }

    if (!unit) {
      throw new Error('Select a unit for every recipe ingredient.');
    }

    return {
      business_id: businessId,
      ingredient_id: ingredientId,
      quantity,
      unit,
      optional: Boolean(line.optional),
    };
  });

  // Validate all conversions before writing anything.
  for (const line of cleanLines) {
    const ingredient = ingredients.find(
      item => item.id === line.ingredient_id
    );

    if (!ingredient) {
      throw new Error('A selected recipe ingredient could not be found.');
    }

    const converted = convertRecipeQuantity(
      line.quantity,
      line.unit,
      ingredient.base_unit
    );

    if (converted === null) {
      throw new Error(
        `Cannot convert ${line.unit} to ${ingredient.base_unit} for ${ingredient.name}.`
      );
    }
  }

  let recipe;

  if (recipeId) {
    const { data, error } = await supabase
      .from('food_recipes')
      .update({
        menu_item_id: menuItemId,
        yield_quantity: yieldValue,
        preparation_notes: preparationNotes?.trim() || null,
      })
      .eq('id', recipeId)
      .eq('business_id', businessId)
      .select('*')
      .single();

    if (error) throw error;
    recipe = data;
  } else {
    const { data: existing, error: existingError } = await supabase
      .from('food_recipes')
      .select('*')
      .eq('business_id', businessId)
      .eq('menu_item_id', menuItemId)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing) {
      const { data, error } = await supabase
        .from('food_recipes')
        .update({
          yield_quantity: yieldValue,
          preparation_notes: preparationNotes?.trim() || null,
          active: true,
        })
        .eq('id', existing.id)
        .eq('business_id', businessId)
        .select('*')
        .single();

      if (error) throw error;
      recipe = data;
    } else {
      const { data, error } = await supabase
        .from('food_recipes')
        .insert({
          business_id: businessId,
          menu_item_id: menuItemId,
          yield_quantity: yieldValue,
          preparation_notes: preparationNotes?.trim() || null,
          active: true,
        })
        .select('*')
        .single();

      if (error) throw error;
      recipe = data;
    }
  }

  // Replace the recipe's ingredient lines.
  // These operations are separate requests, not a database transaction.
  const { error: deleteError } = await supabase
    .from('food_recipe_ingredients')
    .delete()
    .eq('recipe_id', recipe.id)
    .eq('business_id', businessId);

  if (deleteError) throw deleteError;

  const rows = cleanLines.map(line => ({
    ...line,
    recipe_id: recipe.id,
  }));

  const { error: insertError } = await supabase
    .from('food_recipe_ingredients')
    .insert(rows);

  if (insertError) {
    throw new Error(
      `Recipe saved, but its ingredient lines could not be saved: ${insertError.message}`
    );
  }

  return recipe;
}

export async function setFoodRecipeActive({
  businessId,
  recipeId,
  active,
}) {
  const { data, error } = await supabase
    .from('food_recipes')
    .update({ active: Boolean(active) })
    .eq('business_id', businessId)
    .eq('id', recipeId)
    .select('*')
    .single();

  if (error) throw error;

  return data;
}

export async function recordOrderAmendment({
  businessId,
  order,
  orderItem,
  nextNotes,
  nextQuantity,
  modifierOptionIds = [],
  modifierOptions = [],
  settings,
  reason,
  userId,
}) {
  if (!businessId || !order?.id || !orderItem?.id) {
    throw new Error('The order and order item are required for an amendment.');
  }

  const quantity = Number(nextQuantity);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('The amended quantity must be greater than zero.');
  }

  const beforeData = {
    quantity: orderItem.quantity,
    preparation_notes: orderItem.preparation_notes,
    modifiers_snapshot: orderItem.modifiers_snapshot,
    status: orderItem.status,
  };

  const selectedModifiers = modifierOptions.filter(option =>
    modifierOptionIds.includes(option.id)
  );

  const modifierTotal = selectedModifiers.reduce(
    (sum, option) => sum + Number(option.price_delta_cents || 0),
    0
  );

  const nextLineTotal = Math.round(
    (Number(orderItem.unit_price_cents) + modifierTotal) * quantity
  );

  const afterData = {
    ...beforeData,
    quantity,
    preparation_notes: nextNotes,
    modifiers_snapshot: selectedModifiers,
    modifier_total_cents: modifierTotal,
    line_total_cents: nextLineTotal,
  };

  const { error: updateError } = await supabase
    .from('food_order_items')
    .update({
      quantity,
      preparation_notes: nextNotes,
      modifiers_snapshot: selectedModifiers,
      modifier_total_cents: modifierTotal,
      line_total_cents: nextLineTotal,
      status: 'queued',
    })
    .eq('id', orderItem.id)
    .eq('order_id', order.id);

  if (updateError) throw updateError;

  const { error: eventError } = await supabase
    .from('food_order_events')
    .insert({
      business_id: businessId,
      order_id: order.id,
      order_item_id: orderItem.id,
      event_type: 'item_modified',
      before_data: beforeData,
      after_data: afterData,
      reason: reason || 'Customer requested an order change',
      actor_id: userId || null,
    });

  if (eventError) throw eventError;

  const otherItems = (order.food_order_items || []).filter(
    item => item.id !== orderItem.id
  );

  const nextSubtotal =
    otherItems.reduce(
      (sum, item) => sum + Number(item.line_total_cents || 0),
      0
    ) + nextLineTotal;

  const taxRate = Number(settings?.tax_rate_basis_points || 0);

  const tax =
    taxRate > 0
      ? Math.round(
          settings?.prices_include_tax
            ? (nextSubtotal * taxRate) / (10000 + taxRate)
            : (nextSubtotal * taxRate) / 10000
        )
      : 0;

  const nextTotal =
    settings?.prices_include_tax === false
      ? nextSubtotal + tax
      : nextSubtotal;

  const { error: orderUpdateError } = await supabase
    .from('food_orders')
    .update({
      subtotal_cents: nextSubtotal,
      tax_cents: tax,
      total_cents: nextTotal,
    })
    .eq('id', order.id);

  if (orderUpdateError) throw orderUpdateError;

  if (orderItem.station_id) {
    const { data: ticket, error: ticketError } = await supabase
      .from('food_kitchen_tickets')
      .insert({
        business_id: businessId,
        outlet_id: order.outlet_id,
        order_id: order.id,
        station_id: orderItem.station_id,
        ticket_number: `AM-${Date.now().toString().slice(-8)}`,
        status: 'new',
        amendment_number: 1,
      })
      .select('id')
      .single();

    if (ticketError) throw ticketError;

    const { error: ticketItemError } = await supabase
      .from('food_kitchen_ticket_items')
      .insert({
        business_id: businessId,
        ticket_id: ticket.id,
        order_item_id: orderItem.id,
        quantity,
        instruction_snapshot: nextNotes || '',
        amendment_type: 'modified',
      });

    if (ticketItemError) throw ticketItemError;
  }
}
