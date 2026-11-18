import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowPathIcon,
  PlusIcon,
  ShoppingBagIcon,
  ClipboardDocumentListIcon,
  TableCellsIcon,
  FireIcon,
  CubeIcon,
  BookOpenIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useWorkspace } from '../../components/layout/DashboardLayout';
import { supabase } from '../../lib/supabase';
import {
  createFoodOutlet,
  getFoodWorkspace,
  money,
  placeFoodOrder,
  recordOrderAmendment,
  FOOD_CHANNELS,
} from '../../services/foodService';
import '../../styles/food-service.css';

const viewMeta = {
  dashboard: ['Food & Beverage overview', 'Your food-service operation at a glance.'],
  menu: ['Menu management', 'Manage meals, drinks, categories, pricing and preparation stations.'],
  tables: ['Table management', 'Manage seating, table numbers, areas and occupancy.'],
  pos: ['Waiter & POS', 'Create orders, customize meals and manage customer requests.'],
  orders: ['Order management', 'Track orders, amendments, fulfilment and payment status.'],
  kitchen: ['Kitchen display', 'Manage preparation queues and acknowledge incoming tickets.'],
  ingredients: ['Ingredients & stock', 'Manage ingredients, units, stock levels and reorder points.'],
  recipes: ['Recipes & costing', 'Connect menu items to ingredient quantities and recipe costs.'],
  reports: ['Food-service reports', 'Review sales, stock consumption and operational performance.'],
  settings: ['Food-service settings', 'Configure outlets, channels and operational preferences.'],
};

const defaultForm = {
  name: '',
  description: '',
  item_type: 'food',
  price: '',
  category_id: '',
  station_id: '',
};

const emptyData = {
  menu: [],
  categories: [],
  tables: [],
  orders: [],
  tickets: [],
  ingredients: [],
  recipes: [],
  stations: [],
  categoryStationAssignments: [],
  outletItemAssignments: [],
  modifierGroups: [],
  itemModifierGroups: [],
};

const STATION_TYPES = [
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'hot_kitchen', label: 'Hot kitchen' },
  { value: 'cold_kitchen', label: 'Cold kitchen' },
  { value: 'grill', label: 'Grill' },
  { value: 'bar', label: 'Bar' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'pass', label: 'Pass' },
  { value: 'other', label: 'Other' },
];

export default function FoodServicePage({ view = 'dashboard' }) {
  const { selectedBusiness, selectedBusinessId, user } = useWorkspace();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [outlets, setOutlets] = useState([]);
  const [outletId, setOutletId] = useState('');
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(emptyData);

  const [showForm, setShowForm] = useState(false);
  const [editingMenuItemId, setEditingMenuItemId] = useState('');
  const [form, setForm] = useState(defaultForm);

  const [outletForm, setOutletForm] = useState({
    name: '',
    outlet_type: 'restaurant',
  });

  const [orderForm, setOrderForm] = useState({
    channel: 'dine_in',
    table_id: '',
    guest_count: 2,
    customer_name: '',
    notes: '',
  });

  const [cart, setCart] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const [amendment, setAmendment] = useState({
    itemId: '',
    quantity: 1,
    notes: '',
    reason: '',
    modifierOptionIds: [],
  });

  const [tableForm, setTableForm] = useState({
    table_number: '',
    capacity: 2,
    area: 'Main floor',
  });

  const [ingredientForm, setIngredientForm] = useState({
    name: '',
    base_unit: 'each',
    quantity_on_hand: 0,
    reorder_level: 0,
    average_cost: '0',
  });

  const [categoryName, setCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState('');
  const [editingCategoryName, setEditingCategoryName] = useState('');

  const [stationForm, setStationForm] = useState({
    name: '',
    station_type: 'kitchen',
    sort_order: 0,
  });
  const [editingStationId, setEditingStationId] = useState('');

  const [modifierForm, setModifierForm] = useState({
    name: '',
    option_name: '',
    price_delta: '0',
    menu_item_id: '',
  });

  const activeOutlet =
    outlets.find(item => item.id === outletId) || outlets[0] || null;

  const title = viewMeta[view] || viewMeta.dashboard;

  const currentSelectedOrder = useMemo(
    () => data.orders.find(order => order.id === selectedOrder?.id) || null,
    [data.orders, selectedOrder?.id]
  );

  const amendmentOrderItem = useMemo(
    () =>
      currentSelectedOrder?.food_order_items?.find(
        item => item.id === amendment.itemId
      ) || null,
    [currentSelectedOrder, amendment.itemId]
  );

  const activeStations = useMemo(
    () => data.stations.filter(station => station.active),
    [data.stations]
  );

  const load = useCallback(async (preferredOutletId = null) => {
    if (!selectedBusinessId) {
      setLoading(false);
      setOutlets([]);
      setOutletId('');
      setSettings(null);
      setData(emptyData);
      setSelectedOrder(null);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const workspace = await getFoodWorkspace(selectedBusinessId);
      const availableOutlets = workspace.outlets || [];

      setOutlets(availableOutlets);
      setSettings(workspace.settings || null);

      const storedOutlet = localStorage.getItem(
        `blaqs-food-outlet-${selectedBusinessId}`
      );

      const nextOutlet =
        availableOutlets.find(outlet => outlet.id === preferredOutletId)?.id ||
        availableOutlets.find(outlet => outlet.id === storedOutlet)?.id ||
        availableOutlets[0]?.id ||
        '';

      setOutletId(nextOutlet);

      if (!nextOutlet) {
        setData(emptyData);
        setSelectedOrder(null);
        return;
      }

      const [
        menu,
        categories,
        tables,
        orders,
        tickets,
        ingredients,
        recipes,
        stations,
        categoryStationAssignments,
        outletItemAssignments,
        modifierGroups,
        itemModifierGroups,
      ] = await Promise.all([
        supabase
          .from('food_menu_items')
          .select('*')
          .eq('business_id', selectedBusinessId)
          .eq('active', true)
          .order('name'),

        supabase
          .from('food_menu_categories')
          .select('*')
          .eq('business_id', selectedBusinessId)
          .eq('active', true)
          .order('sort_order'),

        supabase
          .from('food_tables')
          .select('*')
          .eq('outlet_id', nextOutlet)
          .eq('active', true)
          .order('table_number'),

        supabase
          .from('food_orders')
          .select(`
            *,
            food_tables!food_orders_table_id_fkey(table_number),
            food_order_items!food_order_items_order_id_fkey(*)
          `)
          .eq('outlet_id', nextOutlet)
          .order('created_at', { ascending: false })
          .limit(100),

        supabase
          .from('food_kitchen_tickets')
          .select(`
            *,
            food_kitchen_stations!food_kitchen_tickets_station_id_fkey(name),
            food_orders!food_kitchen_tickets_order_id_fkey(order_number, table_id),
            food_kitchen_ticket_items!food_kitchen_ticket_items_ticket_business_fk(
              *,
              food_order_items!food_kitchen_ticket_items_order_item_id_fkey(
                item_name_snapshot,
                quantity,
                preparation_notes,
                modifiers_snapshot
              )
            )
          `)
          .eq('outlet_id', nextOutlet)
          .in('status', ['new', 'acknowledged', 'preparing'])
          .order('sent_at'),

        supabase
          .from('food_ingredients')
          .select('*')
          .eq('business_id', selectedBusinessId)
          .eq('active', true)
          .order('name'),

        supabase
          .from('food_recipes')
          .select('*, food_menu_items!food_recipes_menu_item_id_fkey(name)')
          .eq('business_id', selectedBusinessId)
          .eq('active', true),

        // Include inactive stations so they can be reactivated or edited.
        supabase
          .from('food_kitchen_stations')
          .select('*')
          .eq('outlet_id', nextOutlet)
          .order('sort_order'),

        supabase
          .from('food_menu_category_stations')
          .select('*')
          .eq('business_id', selectedBusinessId)
          .eq('outlet_id', nextOutlet),

        supabase
          .from('food_menu_item_outlets')
          .select('*')
          .eq('business_id', selectedBusinessId)
          .eq('outlet_id', nextOutlet),

        supabase
          .from('food_modifier_groups')
          .select(`
            *,
            food_modifier_options!food_modifier_options_modifier_group_id_fkey(*)
          `)
          .eq('business_id', selectedBusinessId)
          .eq('active', true)
          .order('name'),

        supabase
          .from('food_menu_item_modifier_groups')
          .select('*')
          .eq('business_id', selectedBusinessId),
      ]);

      const results = [
        menu,
        categories,
        tables,
        orders,
        tickets,
        ingredients,
        recipes,
        stations,
        categoryStationAssignments,
        outletItemAssignments,
        modifierGroups,
        itemModifierGroups,
      ];

      for (const result of results) {
        if (result.error) throw result.error;
      }

      const nextData = {
        menu: menu.data || [],
        categories: categories.data || [],
        tables: tables.data || [],
        orders: orders.data || [],
        tickets: tickets.data || [],
        ingredients: ingredients.data || [],
        recipes: recipes.data || [],
        stations: stations.data || [],
        categoryStationAssignments: categoryStationAssignments.data || [],
        outletItemAssignments: outletItemAssignments.data || [],
        modifierGroups: modifierGroups.data || [],
        itemModifierGroups: itemModifierGroups.data || [],
      };

      setData(nextData);

      setSelectedOrder(current => {
        if (!current) return null;
        return nextData.orders.find(order => order.id === current.id) || null;
      });
    } catch (e) {
      console.error('Food-service workspace loading failed:', e);
      setError(e.message || 'Unable to load food-service data.');
    } finally {
      setLoading(false);
    }
  }, [selectedBusinessId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!outletId || !selectedBusinessId) return;

    localStorage.setItem(
      `blaqs-food-outlet-${selectedBusinessId}`,
      outletId
    );
  }, [outletId, selectedBusinessId]);

  useEffect(() => {
    const table = searchParams.get('table');

    if (table && data.tables.some(item => item.id === table)) {
      setOrderForm(current => ({
        ...current,
        channel: 'dine_in',
        table_id: table,
      }));
    }
  }, [searchParams, data.tables]);

  useEffect(() => {
    if (!selectedBusinessId || !outletId) return undefined;

    const channel = supabase
      .channel(`food-ops-${outletId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'food_orders',
          filter: `outlet_id=eq.${outletId}`,
        },
        () => load(outletId)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'food_kitchen_tickets',
          filter: `outlet_id=eq.${outletId}`,
        },
        () => load(outletId)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'food_tables',
          filter: `outlet_id=eq.${outletId}`,
        },
        () => load(outletId)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedBusinessId, outletId, load]);

  async function handleOutletChange(nextOutletId) {
    if (!nextOutletId || nextOutletId === outletId) return;

    setOutletId(nextOutletId);
    setSelectedOrder(null);
    setAmendment({
      itemId: '',
      quantity: 1,
      notes: '',
      reason: '',
      modifierOptionIds: [],
    });
    setCart([]);

    await load(nextOutletId);
  }

  async function setupOutlet(event) {
    event.preventDefault();

    if (!selectedBusinessId) return;

    setBusy(true);

    try {
      const outlet = await createFoodOutlet({
        businessId: selectedBusinessId,
        name: outletForm.name,
        outletType: outletForm.outlet_type,
      });

      toast.success('Food-service outlet created');

      setOutletForm({
        name: '',
        outlet_type: 'restaurant',
      });

      await load(outlet.id);
    } catch (e) {
      toast.error(e.message || 'Unable to create outlet.');
    } finally {
      setBusy(false);
    }
  }

  function resetMenuForm() {
    setForm(defaultForm);
    setEditingMenuItemId('');
    setShowForm(false);
  }

  function editMenuItem(item) {
    const outletAssignment = data.outletItemAssignments.find(
      assignment => assignment.menu_item_id === item.id
    );

    setEditingMenuItemId(item.id);
    setForm({
      name: item.name || '',
      description: item.description || '',
      item_type: item.item_type || 'food',
      price: (Number(item.price_cents || 0) / 100).toFixed(2),
      category_id: item.category_id || '',
      station_id: outletAssignment?.preparation_station_id || '',
    });
    setShowForm(true);
  }

  async function saveItemStationAssignment(menuItemId, stationId) {
    if (!activeOutlet) return;

    const existing = data.outletItemAssignments.find(
      assignment => assignment.menu_item_id === menuItemId
    );

    // Do not create an outlet override when the user chooses inheritance.
    if (!existing && !stationId) return;

    if (existing) {
      const { error: updateError } = await supabase
        .from('food_menu_item_outlets')
        .update({ preparation_station_id: stationId || null })
        .eq('business_id', selectedBusinessId)
        .eq('menu_item_id', menuItemId)
        .eq('outlet_id', activeOutlet.id);

      if (updateError) throw updateError;
      return;
    }

    const { error: insertError } = await supabase
      .from('food_menu_item_outlets')
      .insert({
        business_id: selectedBusinessId,
        menu_item_id: menuItemId,
        outlet_id: activeOutlet.id,
        preparation_station_id: stationId,
      });

    if (insertError) throw insertError;
  }

  async function saveMenuItem(event) {
    event.preventDefault();

    if (!selectedBusinessId || !activeOutlet) return;

    const price = Number(form.price);

    if (!form.name.trim() || !Number.isFinite(price) || price < 0) {
      toast.error('Enter a valid menu item name and price.');
      return;
    }

    if (form.station_id) {
      const selectedStation = activeStations.find(
        station => station.id === form.station_id
      );

      if (!selectedStation || selectedStation.outlet_id !== activeOutlet.id) {
        toast.error('Choose an active preparation station from this outlet.');
        return;
      }
    }

    setBusy(true);

    try {
      const payload = {
        business_id: selectedBusinessId,
        category_id: form.category_id || null,
        name: form.name.trim(),
        description: form.description.trim() || null,
        item_type: form.item_type,
        price_cents: Math.round(price * 100),
      };

      let menuItemId = editingMenuItemId;

      if (editingMenuItemId) {
        const { error: updateError } = await supabase
          .from('food_menu_items')
          .update({
            category_id: payload.category_id,
            name: payload.name,
            description: payload.description,
            item_type: payload.item_type,
            price_cents: payload.price_cents,
          })
          .eq('id', editingMenuItemId)
          .eq('business_id', selectedBusinessId);

        if (updateError) throw updateError;
      } else {
        const { data: insertedItem, error: insertError } = await supabase
          .from('food_menu_items')
          .insert(payload)
          .select('*')
          .single();

        if (insertError) throw insertError;
        menuItemId = insertedItem.id;
      }

      await saveItemStationAssignment(menuItemId, form.station_id);

      toast.success(editingMenuItemId ? 'Menu item updated' : 'Menu item added');
      resetMenuForm();
      await load(outletId);
    } catch (e) {
      toast.error(e.message || 'Unable to save menu item.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleMenuItemAvailability(item) {
    const { error: updateError } = await supabase
      .from('food_menu_items')
      .update({ available: !item.available })
      .eq('id', item.id)
      .eq('business_id', selectedBusinessId);

    if (updateError) {
      toast.error(updateError.message);
      return;
    }

    toast.success(item.available ? 'Menu item marked unavailable' : 'Menu item available');
    await load(outletId);
  }

  async function addCategory(event) {
    event.preventDefault();

    if (!categoryName.trim() || !selectedBusinessId) return;

    setBusy(true);

    try {
      const { error: categoryError } = await supabase
        .from('food_menu_categories')
        .insert({
          business_id: selectedBusinessId,
          name: categoryName.trim(),
        });

      if (categoryError) throw categoryError;

      setCategoryName('');
      toast.success('Category added');
      await load(outletId);
    } catch (e) {
      toast.error(e.message || 'Unable to add category.');
    } finally {
      setBusy(false);
    }
  }

  function beginCategoryEdit(category) {
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.name);
  }

  async function saveCategoryEdit(event) {
    event.preventDefault();

    if (!editingCategoryId || !editingCategoryName.trim()) {
      toast.error('Enter a category name.');
      return;
    }

    setBusy(true);

    try {
      const { error: updateError } = await supabase
        .from('food_menu_categories')
        .update({ name: editingCategoryName.trim() })
        .eq('id', editingCategoryId)
        .eq('business_id', selectedBusinessId);

      if (updateError) throw updateError;

      setEditingCategoryId('');
      setEditingCategoryName('');
      toast.success('Category updated');
      await load(outletId);
    } catch (e) {
      toast.error(e.message || 'Unable to update category.');
    } finally {
      setBusy(false);
    }
  }

  async function saveCategoryStation(categoryId, stationId) {
    if (!activeOutlet) return;

    if (stationId) {
      const station = activeStations.find(item => item.id === stationId);

      if (!station || station.outlet_id !== activeOutlet.id) {
        toast.error('Choose an active station belonging to this outlet.');
        return;
      }
    }

    setBusy(true);

    try {
      const existing = data.categoryStationAssignments.find(
        assignment => assignment.category_id === categoryId
      );

      // A blank selection removes the outlet-level category default.
      if (!stationId) {
        if (existing) {
          const { error: deleteError } = await supabase
            .from('food_menu_category_stations')
            .delete()
            .eq('business_id', selectedBusinessId)
            .eq('outlet_id', activeOutlet.id)
            .eq('category_id', categoryId);

          if (deleteError) throw deleteError;
        }
      } else if (existing) {
        const { error: updateError } = await supabase
          .from('food_menu_category_stations')
          .update({ station_id: stationId })
          .eq('business_id', selectedBusinessId)
          .eq('outlet_id', activeOutlet.id)
          .eq('category_id', categoryId);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('food_menu_category_stations')
          .insert({
            business_id: selectedBusinessId,
            outlet_id: activeOutlet.id,
            category_id: categoryId,
            station_id: stationId,
          });

        if (insertError) throw insertError;
      }

      toast.success(
        stationId ? 'Category preparation station saved' : 'Category station default removed'
      );
      await load(outletId);
    } catch (e) {
      toast.error(e.message || 'Unable to save category station.');
    } finally {
      setBusy(false);
    }
  }

  function getCategoryStation(categoryId) {
    return (
      data.categoryStationAssignments.find(
        assignment => assignment.category_id === categoryId
      )?.station_id || ''
    );
  }

  function getItemStationInfo(item) {
    const override = data.outletItemAssignments.find(
      assignment => assignment.menu_item_id === item.id
    );

    if (override?.preparation_station_id) {
      const station = data.stations.find(
        entry => entry.id === override.preparation_station_id
      );

      return {
        name: station?.name || 'Assigned station',
        source: 'Outlet override',
      };
    }

    const categoryStationId = getCategoryStation(item.category_id);
    if (categoryStationId) {
      const station = data.stations.find(
        entry => entry.id === categoryStationId
      );

      return {
        name: station?.name || 'Category station',
        source: 'Category default',
      };
    }

    return {
      name: 'Automatic fallback',
      source: 'Order routing',
    };
  }

  function beginStationEdit(station) {
    setEditingStationId(station.id);
    setStationForm({
      name: station.name || '',
      station_type: station.station_type || 'kitchen',
      sort_order: station.sort_order ?? 0,
    });
  }

  function resetStationForm() {
    setEditingStationId('');
    setStationForm({
      name: '',
      station_type: 'kitchen',
      sort_order: 0,
    });
  }

  async function saveStation(event) {
    event.preventDefault();

    if (!activeOutlet || !stationForm.name.trim()) {
      toast.error('Enter a preparation station name.');
      return;
    }

    const sortOrder = Number(stationForm.sort_order);

    if (!Number.isInteger(sortOrder)) {
      toast.error('Station order must be a whole number.');
      return;
    }

    setBusy(true);

    try {
      const payload = {
        name: stationForm.name.trim(),
        station_type: stationForm.station_type,
        sort_order: sortOrder,
      };

      if (editingStationId) {
        const { error: updateError } = await supabase
          .from('food_kitchen_stations')
          .update(payload)
          .eq('id', editingStationId)
          .eq('business_id', selectedBusinessId)
          .eq('outlet_id', activeOutlet.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('food_kitchen_stations')
          .insert({
            business_id: selectedBusinessId,
            outlet_id: activeOutlet.id,
            ...payload,
            active: true,
          });

        if (insertError) throw insertError;
      }

      toast.success(editingStationId ? 'Preparation station updated' : 'Preparation station created');
      resetStationForm();
      await load(outletId);
    } catch (e) {
      toast.error(e.message || 'Unable to save preparation station.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleStationActive(station) {
    if (station.active) {
      const assignedToCategory = data.categoryStationAssignments.some(
        assignment => assignment.station_id === station.id
      );

      const assignedToMenuItem = data.outletItemAssignments.some(
        assignment => assignment.preparation_station_id === station.id
      );

      if (assignedToCategory || assignedToMenuItem) {
        toast.error(
          'This station is assigned to menu categories or items. Reassign them before deactivating it.'
        );
        return;
      }
    }

    const { error: updateError } = await supabase
      .from('food_kitchen_stations')
      .update({ active: !station.active })
      .eq('id', station.id)
      .eq('business_id', selectedBusinessId)
      .eq('outlet_id', outletId);

    if (updateError) {
      toast.error(updateError.message);
    } else {
      toast.success(station.active ? 'Station deactivated' : 'Station activated');
      await load(outletId);
    }
  }

  async function addModifier(event) {
    event.preventDefault();

    if (
      !modifierForm.name.trim() ||
      !modifierForm.option_name.trim() ||
      !modifierForm.menu_item_id
    ) {
      toast.error('Complete all modifier fields.');
      return;
    }

    setBusy(true);

    try {
      const { data: group, error: groupError } = await supabase
        .from('food_modifier_groups')
        .insert({
          business_id: selectedBusinessId,
          name: modifierForm.name.trim(),
          selection_type: 'multiple',
          min_selections: 0,
        })
        .select('*')
        .single();

      if (groupError) throw groupError;

      const { error: optionError } = await supabase
        .from('food_modifier_options')
        .insert({
          business_id: selectedBusinessId,
          modifier_group_id: group.id,
          name: modifierForm.option_name.trim(),
          price_delta_cents: Math.round(
            Number(modifierForm.price_delta || 0) * 100
          ),
        });

      if (optionError) throw optionError;

      const { error: linkError } = await supabase
        .from('food_menu_item_modifier_groups')
        .insert({
          business_id: selectedBusinessId,
          menu_item_id: modifierForm.menu_item_id,
          modifier_group_id: group.id,
        });

      if (linkError) throw linkError;

      setModifierForm({
        name: '',
        option_name: '',
        price_delta: '0',
        menu_item_id: '',
      });

      toast.success('Modifier group and option created');
      await load(outletId);
    } catch (e) {
      toast.error(e.message || 'Unable to create modifier.');
    } finally {
      setBusy(false);
    }
  }

  async function addTable(event) {
    event.preventDefault();

    if (!activeOutlet) return;

    const tableNumber = tableForm.table_number.trim();
    const capacity = Number(tableForm.capacity);

    if (!tableNumber || !Number.isInteger(capacity) || capacity < 1) {
      toast.error('Enter a table label and a valid seating capacity.');
      return;
    }

    const { error: tableError } = await supabase
      .from('food_tables')
      .insert({
        business_id: selectedBusinessId,
        outlet_id: activeOutlet.id,
        table_number: tableNumber,
        capacity,
        area: tableForm.area.trim() || null,
      });

    if (tableError) {
      toast.error(tableError.message);
    } else {
      setTableForm({
        table_number: '',
        capacity: 2,
        area: 'Main floor',
      });

      toast.success('Table added');
      await load(outletId);
    }
  }

  async function changeTableStatus(table, status) {
    const { error: statusError } = await supabase
      .from('food_tables')
      .update({ status })
      .eq('id', table.id)
      .eq('outlet_id', outletId);

    if (statusError) {
      toast.error(statusError.message);
    } else {
      await load(outletId);
    }
  }

  async function addIngredient(event) {
    event.preventDefault();

    if (!ingredientForm.name.trim()) {
      toast.error('Enter an ingredient name.');
      return;
    }

    const quantity = Number(ingredientForm.quantity_on_hand);
    const reorderLevel = Number(ingredientForm.reorder_level);
    const averageCost = Number(ingredientForm.average_cost);

    if (
      !Number.isFinite(quantity) ||
      quantity < 0 ||
      !Number.isFinite(reorderLevel) ||
      reorderLevel < 0 ||
      !Number.isFinite(averageCost) ||
      averageCost < 0
    ) {
      toast.error('Enter valid ingredient stock and cost values.');
      return;
    }

    const { error: ingredientError } = await supabase
      .from('food_ingredients')
      .insert({
        business_id: selectedBusinessId,
        name: ingredientForm.name.trim(),
        base_unit: ingredientForm.base_unit,
        quantity_on_hand: quantity,
        reorder_level: reorderLevel,
        average_cost_cents: Math.round(averageCost * 100),
      });

    if (ingredientError) {
      toast.error(ingredientError.message);
    } else {
      setIngredientForm({
        name: '',
        base_unit: 'each',
        quantity_on_hand: 0,
        reorder_level: 0,
        average_cost: '0',
      });

      toast.success('Ingredient added');
      await load(outletId);
    }
  }

  function addToCart(item) {
    setCart(current => {
      const existing = current.find(line => line.id === item.id);

      return existing
        ? current.map(line =>
            line.id === item.id
              ? { ...line, quantity: line.quantity + 1 }
              : line
          )
        : [
            ...current,
            {
              ...item,
              quantity: 1,
              preparationNotes: '',
              modifierOptionIds: [],
            },
          ];
    });
  }

  async function submitOrder(event) {
    event.preventDefault();

    if (!cart.length || !activeOutlet) return;

    if (orderForm.channel === 'dine_in' && !orderForm.table_id) {
      toast.error('Select a table for this dine-in order.');
      return;
    }

    setBusy(true);

    try {
      await placeFoodOrder({
        businessId: selectedBusinessId,
        outletId: activeOutlet.id,
        channel: orderForm.channel,
        tableId: orderForm.table_id,
        guestCount: orderForm.guest_count,
        notes: orderForm.notes,
        customerName: orderForm.customer_name,
        items: cart,
        userId: user?.id,
      });

      toast.success('Order placed and sent to preparation');

      setCart([]);
      setOrderForm({
        channel: 'dine_in',
        table_id: '',
        guest_count: 2,
        customer_name: '',
        notes: '',
      });
      setSelectedOrder(null);

      await load(outletId);
      navigate('/food/orders');
    } catch (e) {
      toast.error(e.message || 'Unable to place order');
    } finally {
      setBusy(false);
    }
  }

  async function updateOrderStatus(order, status) {
    const { error: statusError } = await supabase
      .from('food_orders')
      .update({
        status,
        ...(status === 'placed'
          ? { placed_at: new Date().toISOString() }
          : {}),
      })
      .eq('id', order.id)
      .eq('outlet_id', outletId);

    if (statusError) {
      toast.error(statusError.message);
      return;
    }

    const eventType = {
      placed: 'placed',
      accepted: 'accepted',
      preparing: 'preparation_started',
      ready: 'ready',
      served: 'served',
      completed: 'completed',
      cancelled: 'cancelled',
    }[status] || 'note_added';

    const { error: eventError } = await supabase
      .from('food_order_events')
      .insert({
        business_id: selectedBusinessId,
        order_id: order.id,
        event_type: eventType,
        before_data: { status: order.status },
        after_data: { status },
        actor_id: user?.id,
      });

    if (eventError) {
      toast.error(
        `Status changed, but the audit event failed: ${eventError.message}`
      );
      await load(outletId);
      return;
    }

    toast.success(`Order ${status.replaceAll('_', ' ')}`);
    await load(outletId);
  }

  async function updateTicket(ticket, status) {
    const patch = { status };

    if (status === 'acknowledged') {
      patch.acknowledged_at = new Date().toISOString();
    }

    if (status === 'ready') {
      patch.ready_at = new Date().toISOString();
    }

    const { error: ticketError } = await supabase
      .from('food_kitchen_tickets')
      .update(patch)
      .eq('id', ticket.id)
      .eq('outlet_id', outletId);

    if (ticketError) {
      toast.error(ticketError.message);
      return;
    }

    const { data: ticketLines, error: linesError } = await supabase
      .from('food_kitchen_ticket_items')
      .select('order_item_id')
      .eq('ticket_id', ticket.id);

    if (linesError) {
      toast.error(linesError.message);
      return;
    }

    const itemStatus =
      status === 'preparing'
        ? 'preparing'
        : status === 'ready'
          ? 'ready'
          : null;

    if (itemStatus && ticketLines?.length) {
      const ids = ticketLines.map(line => line.order_item_id);

      const { error: itemUpdateError } = await supabase
        .from('food_order_items')
        .update({ status: itemStatus })
        .in('id', ids);

      if (itemUpdateError) {
        toast.error(itemUpdateError.message);
        return;
      }

      if (status === 'ready') {
        const { data: allItems, error: allItemsError } = await supabase
          .from('food_order_items')
          .select('status')
          .eq('order_id', ticket.order_id);

        if (allItemsError) {
          toast.error(allItemsError.message);
          return;
        }

        if (
          allItems?.length &&
          allItems.every(item =>
            ['ready', 'served', 'cancelled'].includes(item.status)
          )
        ) {
          const { error: orderError } = await supabase
            .from('food_orders')
            .update({ status: 'ready' })
            .eq('id', ticket.order_id);

          if (orderError) {
            toast.error(orderError.message);
            return;
          }

          const { error: eventError } = await supabase
            .from('food_order_events')
            .insert({
              business_id: selectedBusinessId,
              order_id: ticket.order_id,
              event_type: 'ready',
              after_data: { status: 'ready' },
              actor_id: user?.id,
            });

          if (eventError) {
            toast.error(
              `Order is ready, but the audit event failed: ${eventError.message}`
            );
          }
        }
      }
    }

    toast.success('Kitchen ticket updated');
    await load(outletId);
  }

  async function saveAmendment(event) {
    event.preventDefault();

    const order = currentSelectedOrder;
    const item = amendmentOrderItem;

    if (!order || !item) {
      toast.error('Select an order item before recording an amendment.');
      return;
    }

    setBusy(true);

    try {
      await recordOrderAmendment({
        businessId: selectedBusinessId,
        order,
        orderItem: item,
        nextNotes: amendment.notes,
        nextQuantity: amendment.quantity,
        modifierOptionIds: amendment.modifierOptionIds || [],
        modifierOptions: data.modifierGroups.flatMap(
          group => group.food_modifier_options || []
        ),
        settings,
        reason: amendment.reason,
        userId: user?.id,
      });

      toast.success('Amendment recorded');

      setAmendment({
        itemId: '',
        quantity: 1,
        notes: '',
        reason: '',
        modifierOptionIds: [],
      });

      await load(outletId);
    } catch (e) {
      toast.error(e.message || 'Unable to record amendment.');
    } finally {
      setBusy(false);
    }
  }

  const totals = useMemo(
    () => ({
      openOrders: data.orders.filter(
        order =>
          !['completed', 'cancelled', 'collected'].includes(order.status)
      ).length,

      sales: data.orders.reduce(
        (sum, order) => sum + Number(order.total_cents || 0),
        0
      ),

      lowStock: data.ingredients.filter(
        ingredient =>
          Number(ingredient.quantity_on_hand) <=
          Number(ingredient.reorder_level)
      ).length,

      occupiedTables: data.tables.filter(
        table => table.status === 'occupied'
      ).length,
    }),
    [data]
  );

  if (loading) {
    return (
      <div className="food-loading">
        <div className="food-spinner" />
        Loading food-service workspace…
      </div>
    );
  }

  if (error) {
    return (
      <section className="food-page">
        <div className="food-alert error">
          <ExclamationTriangleIcon />
          {error}
        </div>

        <button
          className="food-button secondary"
          onClick={() => load(outletId)}
          type="button"
        >
          <ArrowPathIcon />
          Retry
        </button>
      </section>
    );
  }

  if (!outlets.length) {
    return (
      <section className="food-page">
        <div className="food-setup-card">
          <span className="food-kicker">FOOD & BEVERAGE SETUP</span>

          <h1>Set up your first outlet</h1>

          <p>
            Start with a restaurant, café, takeaway, bar, food truck,
            catering operation or cloud kitchen. You can configure
            additional service channels later.
          </p>

          <form onSubmit={setupOutlet} className="food-form-grid">
            <label>
              Outlet name
              <input
                required
                value={outletForm.name}
                onChange={event =>
                  setOutletForm({
                    ...outletForm,
                    name: event.target.value,
                  })
                }
                placeholder="e.g. Main Street Kitchen"
              />
            </label>

            <label>
              Business model
              <select
                value={outletForm.outlet_type}
                onChange={event =>
                  setOutletForm({
                    ...outletForm,
                    outlet_type: event.target.value,
                  })
                }
              >
                {[
                  'restaurant',
                  'cafe',
                  'takeaway',
                  'bar',
                  'food_truck',
                  'catering',
                  'quick_service',
                  'food_outlet',
                  'cloud_kitchen',
                ].map(type => (
                  <option key={type} value={type}>
                    {type.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </label>

            <button
              className="food-button primary"
              disabled={busy}
              type="submit"
            >
              {busy ? 'Creating…' : 'Create outlet'}
            </button>
          </form>
        </div>
      </section>
    );
  }

  return (
    <main className="food-page">
      <div className="food-page-heading">
        <div>
          <span className="food-kicker">
            {selectedBusiness?.name || 'BUSINESS'} · FOOD & BEVERAGE
          </span>

          <h1>{title[0]}</h1>
          <p>{title[1]}</p>
        </div>

        <div className="food-heading-actions">
          <select
            value={activeOutlet?.id || ''}
            onChange={event => handleOutletChange(event.target.value)}
            aria-label="Select outlet"
          >
            {outlets.map(outlet => (
              <option key={outlet.id} value={outlet.id}>
                {outlet.name}
              </option>
            ))}
          </select>

          <button
            className="food-button secondary"
            onClick={() => load(outletId)}
            type="button"
          >
            <ArrowPathIcon />
            Refresh
          </button>
        </div>
      </div>

      {view === 'dashboard' && (
        <>
          <div className="food-stat-grid">
            <Stat
              icon={ClipboardDocumentListIcon}
              label="Open orders"
              value={totals.openOrders}
            />

            <Stat
              icon={CurrencyDollarIcon}
              label="Order value"
              value={money(totals.sales)}
            />

            <Stat
              icon={TableCellsIcon}
              label="Occupied tables"
              value={`${totals.occupiedTables}/${data.tables.length}`}
            />

            <Stat
              icon={ExclamationTriangleIcon}
              label="Low stock ingredients"
              value={totals.lowStock}
            />
          </div>

          <div className="food-dashboard-grid">
            <section className="food-panel">
              <PanelTitle
                title="Recent orders"
                action={<Link to="/food/orders">View all</Link>}
              />

              <OrderList
                orders={data.orders.slice(0, 6)}
                onSelect={setSelectedOrder}
              />
            </section>

            <section className="food-panel">
              <PanelTitle title="Quick actions" />

              <div className="food-quick-links">
                <Link to="/food/pos">
                  <ShoppingBagIcon /> Start an order
                </Link>

                <Link to="/food/menu">
                  <BookOpenIcon /> Manage menu
                </Link>

                <Link to="/food/tables">
                  <TableCellsIcon /> Manage tables
                </Link>

                <Link to="/food/kitchen">
                  <FireIcon /> Kitchen display
                </Link>
              </div>
            </section>
          </div>
        </>
      )}

      {view === 'menu' && (
        <div className="food-dashboard-grid">
          <section className="food-panel">
            <PanelTitle
              title={`Menu items (${data.menu.length})`}
              action={
                <button
                  className="food-button primary small"
                  onClick={() => {
                    if (showForm) {
                      resetMenuForm();
                    } else {
                      setForm(defaultForm);
                      setEditingMenuItemId('');
                      setShowForm(true);
                    }
                  }}
                  type="button"
                >
                  <PlusIcon /> {showForm ? 'Close form' : 'Add item'}
                </button>
              }
            />

            {showForm && (
              <form className="food-inline-form" onSubmit={saveMenuItem}>
                <h3 className="wide">
                  {editingMenuItemId ? 'Edit menu item' : 'Create menu item'}
                </h3>

                <label>
                  Item name
                  <input
                    required
                    value={form.name}
                    onChange={event =>
                      setForm({ ...form, name: event.target.value })
                    }
                  />
                </label>

                <label>
                  Type
                  <select
                    value={form.item_type}
                    onChange={event =>
                      setForm({ ...form, item_type: event.target.value })
                    }
                  >
                    <option value="food">Food</option>
                    <option value="beverage">Beverage</option>
                    <option value="retail">Retail</option>
                  </select>
                </label>

                <label>
                  Price (R)
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={event =>
                      setForm({ ...form, price: event.target.value })
                    }
                  />
                </label>

                <label>
                  Category
                  <select
                    value={form.category_id}
                    onChange={event =>
                      setForm({ ...form, category_id: event.target.value })
                    }
                  >
                    <option value="">Uncategorised</option>
                    {data.categories.map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="wide">
                  Preparation station for {activeOutlet?.name}
                  <select
                    value={form.station_id}
                    onChange={event =>
                      setForm({ ...form, station_id: event.target.value })
                    }
                  >
                    <option value="">
                      Inherit category default / automatic fallback
                    </option>
                    {activeStations.map(station => (
                      <option key={station.id} value={station.id}>
                        {station.name} · {station.station_type.replaceAll('_', ' ')}
                      </option>
                    ))}
                  </select>
                  <small>
                    Choose a station to override the category default for this
                    item at this outlet. Leave blank to inherit the category
                    assignment.
                  </small>
                </label>

                <label className="wide">
                  Description
                  <input
                    value={form.description}
                    onChange={event =>
                      setForm({ ...form, description: event.target.value })
                    }
                  />
                </label>

                <div className="wide food-form-actions">
                  <button
                    className="food-button primary"
                    disabled={busy}
                    type="submit"
                  >
                    {busy
                      ? 'Saving…'
                      : editingMenuItemId
                        ? 'Update menu item'
                        : 'Save menu item'}
                  </button>

                  <button
                    className="food-button secondary"
                    onClick={resetMenuForm}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div className="food-table-wrap">
              <table className="food-table">
                <thead>
                  <tr>
                    <th>ITEM</th>
                    <th>TYPE</th>
                    <th>PRICE</th>
                    <th>PREPARATION</th>
                    <th>AVAILABILITY</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>

                <tbody>
                  {data.menu.map(item => {
                    const stationInfo = getItemStationInfo(item);

                    return (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.name}</strong>
                          <small>{item.description}</small>
                          <small>
                            {data.categories.find(
                              category => category.id === item.category_id
                            )?.name || 'Uncategorised'}
                          </small>
                        </td>

                        <td>{item.item_type}</td>
                        <td>{money(item.price_cents)}</td>

                        <td>
                          <strong>{stationInfo.name}</strong>
                          <small>{stationInfo.source}</small>
                        </td>

                        <td>
                          <button
                            type="button"
                            className={`food-status ${
                              item.available ? 'good' : 'muted'
                            }`}
                            onClick={() => toggleMenuItemAvailability(item)}
                            title="Toggle menu item availability"
                          >
                            {item.available ? 'Available' : 'Unavailable'}
                          </button>
                        </td>

                        <td>
                          <button
                            className="food-icon-button"
                            title="Edit menu item"
                            type="button"
                            onClick={() => editMenuItem(item)}
                          >
                            <PencilSquareIcon />
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {!data.menu.length && (
                    <EmptyRow
                      text="No menu items yet. Add your first meal or beverage."
                      cols={6}
                    />
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="food-panel">
            <PanelTitle title="Categories" />

            <form className="food-add-row" onSubmit={addCategory}>
              <input
                value={categoryName}
                onChange={event => setCategoryName(event.target.value)}
                placeholder="New category"
              />

              <button
                className="food-button secondary"
                type="submit"
                disabled={busy}
              >
                <PlusIcon /> Add
              </button>
            </form>

            <div className="food-category-list">
              {data.categories.map(category => {
                const categoryStationId = getCategoryStation(category.id);

                return (
                  <div className="food-category-card" key={category.id}>
                    {editingCategoryId === category.id ? (
                      <form
                        className="food-add-row"
                        onSubmit={saveCategoryEdit}
                      >
                        <input
                          autoFocus
                          value={editingCategoryName}
                          onChange={event =>
                            setEditingCategoryName(event.target.value)
                          }
                        />

                        <button
                          className="food-icon-button"
                          title="Save category"
                          type="submit"
                          disabled={busy}
                        >
                          <CheckIcon />
                        </button>

                        <button
                          className="food-icon-button"
                          title="Cancel editing"
                          type="button"
                          onClick={() => {
                            setEditingCategoryId('');
                            setEditingCategoryName('');
                          }}
                        >
                          <XMarkIcon />
                        </button>
                      </form>
                    ) : (
                      <div className="food-category-heading">
                        <strong>{category.name}</strong>
                        <button
                          className="food-icon-button"
                          title="Edit category"
                          type="button"
                          onClick={() => beginCategoryEdit(category)}
                        >
                          <PencilSquareIcon />
                        </button>
                      </div>
                    )}

                    <label>
                      Default preparation station · {activeOutlet?.name}
                      <select
                        value={categoryStationId}
                        disabled={busy}
                        onChange={event =>
                          saveCategoryStation(category.id, event.target.value)
                        }
                      >
                        <option value="">No category default</option>
                        {activeStations.map(station => (
                          <option key={station.id} value={station.id}>
                            {station.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <small>
                      Menu items in this category inherit this station at this
                      outlet unless an item-specific override is selected.
                    </small>
                  </div>
                );
              })}
            </div>

            {!data.categories.length && (
              <p className="food-muted">
                Create categories such as Starters, Main meals, Hot drinks
                or Cocktails.
              </p>
            )}

            <div className="food-subsection">
              <h3>Preparation stations</h3>

              <p className="food-muted">
                Stations belong to the selected outlet. Create stations such
                as Kitchen, Grill, Coffee or Bar, then assign them to
                categories or individual menu items.
              </p>

              <form className="food-inline-form" onSubmit={saveStation}>
                <label>
                  Station name
                  <input
                    required
                    value={stationForm.name}
                    onChange={event =>
                      setStationForm({
                        ...stationForm,
                        name: event.target.value,
                      })
                    }
                    placeholder="e.g. Coffee"
                  />
                </label>

                <label>
                  Station type
                  <select
                    value={stationForm.station_type}
                    onChange={event =>
                      setStationForm({
                        ...stationForm,
                        station_type: event.target.value,
                      })
                    }
                  >
                    {STATION_TYPES.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Display order
                  <input
                    type="number"
                    step="1"
                    value={stationForm.sort_order}
                    onChange={event =>
                      setStationForm({
                        ...stationForm,
                        sort_order: event.target.value,
                      })
                    }
                  />
                </label>

                <div className="wide food-form-actions">
                  <button
                    className="food-button primary"
                    type="submit"
                    disabled={busy}
                  >
                    {editingStationId ? 'Update station' : 'Add station'}
                  </button>

                  {editingStationId && (
                    <button
                      className="food-button secondary"
                      type="button"
                      onClick={resetStationForm}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              <div className="food-station-list">
                {data.stations.map(station => (
                  <div className="food-simple-row" key={station.id}>
                    <div>
                      <strong>{station.name}</strong>
                      <small>
                        {station.station_type.replaceAll('_', ' ')} · Order{' '}
                        {station.sort_order}
                      </small>
                      <small>
                        {station.active ? 'Active' : 'Inactive'}
                      </small>
                    </div>

                    <div className="food-row-actions">
                      <button
                        className="food-icon-button"
                        title="Edit station"
                        type="button"
                        onClick={() => beginStationEdit(station)}
                      >
                        <PencilSquareIcon />
                      </button>

                      <button
                        className="food-button secondary small"
                        type="button"
                        onClick={() => toggleStationActive(station)}
                      >
                        {station.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                ))}

                {!data.stations.length && (
                  <p className="food-muted">
                    No preparation stations have been created for this outlet.
                  </p>
                )}
              </div>
            </div>

            <div className="food-subsection">
              <h3>Meal modifiers</h3>

              <p className="food-muted">
                Create options such as no onions, extra cheese or alternate
                sides.
              </p>

              <form className="food-inline-form" onSubmit={addModifier}>
                <label>
                  Modifier group
                  <input
                    required
                    value={modifierForm.name}
                    onChange={event =>
                      setModifierForm({
                        ...modifierForm,
                        name: event.target.value,
                      })
                    }
                    placeholder="e.g. Add-ons"
                  />
                </label>

                <label>
                  Option
                  <input
                    required
                    value={modifierForm.option_name}
                    onChange={event =>
                      setModifierForm({
                        ...modifierForm,
                        option_name: event.target.value,
                      })
                    }
                    placeholder="e.g. Extra cheese"
                  />
                </label>

                <label>
                  Extra charge (R)
                  <input
                    type="number"
                    step="0.01"
                    value={modifierForm.price_delta}
                    onChange={event =>
                      setModifierForm({
                        ...modifierForm,
                        price_delta: event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Apply to menu item
                  <select
                    required
                    value={modifierForm.menu_item_id}
                    onChange={event =>
                      setModifierForm({
                        ...modifierForm,
                        menu_item_id: event.target.value,
                      })
                    }
                  >
                    <option value="">Select item</option>
                    {data.menu.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  className="food-button secondary"
                  disabled={busy}
                  type="submit"
                >
                  Create modifier
                </button>
              </form>

              {data.modifierGroups.map(group => (
                <div className="food-simple-row" key={group.id}>
                  <strong>{group.name}</strong>

                  <small>
                    {(group.food_modifier_options || [])
                      .map(
                        option =>
                          `${option.name} (+${money(option.price_delta_cents)})`
                      )
                      .join(' · ')}
                  </small>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
            {view === 'tables' && (
        <div className="food-panel">
          <PanelTitle
            title="Floor and table plan"
            action={
              <span className="food-muted">
                {data.tables.length} configured tables
              </span>
            }
          />

          <form className="food-add-row" onSubmit={addTable}>
            <input
              required
              placeholder="Table number / label"
              value={tableForm.table_number}
              onChange={event =>
                setTableForm({
                  ...tableForm,
                  table_number: event.target.value,
                })
              }
            />

            <input
              type="number"
              min="1"
              placeholder="Seats"
              value={tableForm.capacity}
              onChange={event =>
                setTableForm({
                  ...tableForm,
                  capacity: event.target.value,
                })
              }
            />

            <input
              placeholder="Area"
              value={tableForm.area}
              onChange={event =>
                setTableForm({ ...tableForm, area: event.target.value })
              }
            />

            <button className="food-button primary" type="submit">
              <PlusIcon /> Add table
            </button>
          </form>

          <div className="food-table-grid">
            {data.tables.map(table => (
              <article
                className={`food-table-card ${table.status}`}
                key={table.id}
              >
                <div className="food-table-card-top">
                  <span className="food-table-number">
                    {table.table_number}
                  </span>

                  <span className={`food-status ${table.status}`}>
                    {table.status.replaceAll('_', ' ')}
                  </span>
                </div>

                <strong>
                  {table.display_name || `Table ${table.table_number}`}
                </strong>

                <small>
                  {table.capacity} seats · {table.area || 'Unassigned area'}
                </small>

                <select
                  value={table.status}
                  onChange={event =>
                    changeTableStatus(table, event.target.value)
                  }
                >
                  <option value="available">Available</option>
                  <option value="occupied">Occupied</option>
                  <option value="reserved">Reserved</option>
                  <option value="cleaning">Cleaning</option>
                  <option value="out_of_service">Out of service</option>
                </select>

                <Link to={`/food/pos?table=${encodeURIComponent(table.id)}`}>
                  Start table order →
                </Link>
              </article>
            ))}

            {!data.tables.length && (
              <p className="food-muted">
                Add tables to enable dine-in service. Takeaway and counter
                orders can still be processed without tables.
              </p>
            )}
          </div>
        </div>
      )}

      {view === 'pos' && (
        <div className="food-pos-layout">
          <section className="food-panel">
            <PanelTitle title="Menu" />

            <div className="food-menu-grid">
              {data.menu
                .filter(item => item.available)
                .map(item => (
                  <button
                    className="food-menu-card"
                    key={item.id}
                    onClick={() => addToCart(item)}
                    type="button"
                  >
                    <span className="food-menu-type">{item.item_type}</span>
                    <strong>{item.name}</strong>

                    <small>
                      {item.description || 'Tap to add to order'}
                    </small>

                    <b>{money(item.price_cents)}</b>
                  </button>
                ))}

              {!data.menu.length && (
                <p className="food-muted">
                  Add menu items before taking orders.
                </p>
              )}
            </div>
          </section>

          <section className="food-panel food-cart">
            <PanelTitle title="Current order" />

            <form onSubmit={submitOrder} className="food-cart-form">
              <label>
                Service channel
                <select
                  value={orderForm.channel}
                  onChange={event =>
                    setOrderForm({
                      ...orderForm,
                      channel: event.target.value,
                      table_id:
                        event.target.value === 'dine_in'
                          ? orderForm.table_id
                          : '',
                    })
                  }
                >
                  {FOOD_CHANNELS.map(channel => (
                    <option value={channel.value} key={channel.value}>
                      {channel.label}
                    </option>
                  ))}
                </select>
              </label>

              {orderForm.channel === 'dine_in' && (
                <label>
                  Table
                  <select
                    value={orderForm.table_id}
                    onChange={event =>
                      setOrderForm({
                        ...orderForm,
                        table_id: event.target.value,
                      })
                    }
                  >
                    <option value="">Select table</option>

                    {data.tables.map(table => (
                      <option key={table.id} value={table.id}>
                        {table.table_number} · {table.status}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label>
                Customer / reference
                <input
                  value={orderForm.customer_name}
                  onChange={event =>
                    setOrderForm({
                      ...orderForm,
                      customer_name: event.target.value,
                    })
                  }
                  placeholder="Optional customer name"
                />
              </label>

              <label>
                Guests
                <input
                  type="number"
                  min="1"
                  value={orderForm.guest_count}
                  onChange={event =>
                    setOrderForm({
                      ...orderForm,
                      guest_count: event.target.value,
                    })
                  }
                />
              </label>

              <div className="food-cart-lines">
                {cart.map(line => {
                  const linkedGroups = data.modifierGroups.filter(group =>
                    data.itemModifierGroups.some(
                      link =>
                        link.menu_item_id === line.id &&
                        link.modifier_group_id === group.id
                    )
                  );

                  const availableOptions = linkedGroups.flatMap(
                    group => group.food_modifier_options || []
                  );

                  return (
                    <div className="food-cart-line" key={line.id}>
                      <div>
                        <strong>{line.name}</strong>
                        <small>{money(line.price_cents)} each</small>

                        <input
                          placeholder="Preparation notes…"
                          value={line.preparationNotes}
                          onChange={event =>
                            setCart(current =>
                              current.map(item =>
                                item.id === line.id
                                  ? {
                                      ...item,
                                      preparationNotes: event.target.value,
                                    }
                                  : item
                              )
                            )
                          }
                        />

                        {availableOptions.length > 0 && (
                          <select
                            multiple
                            aria-label={`Modifiers for ${line.name}`}
                            value={line.modifierOptionIds}
                            onChange={event =>
                              setCart(current =>
                                current.map(item =>
                                  item.id === line.id
                                    ? {
                                        ...item,
                                        modifierOptionIds: Array.from(
                                          event.target.selectedOptions
                                        ).map(option => option.value),
                                      }
                                    : item
                                )
                              )
                            }
                          >
                            {availableOptions.map(option => (
                              <option key={option.id} value={option.id}>
                                {option.name} (+{money(option.price_delta_cents)})
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      <div className="food-qty">
                        <button
                          type="button"
                          onClick={() =>
                            setCart(current =>
                              current.map(item =>
                                item.id === line.id
                                  ? {
                                      ...item,
                                      quantity: Math.max(1, item.quantity - 1),
                                    }
                                  : item
                              )
                            )
                          }
                        >
                          −
                        </button>

                        {line.quantity}

                        <button
                          type="button"
                          onClick={() =>
                            setCart(current =>
                              current.map(item =>
                                item.id === line.id
                                  ? { ...item, quantity: item.quantity + 1 }
                                  : item
                              )
                            )
                          }
                        >
                          +
                        </button>

                        <button
                          type="button"
                          className="remove"
                          onClick={() =>
                            setCart(current =>
                              current.filter(item => item.id !== line.id)
                            )
                          }
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}

                {!cart.length && (
                  <p className="food-muted">
                    Select menu items to build an order.
                  </p>
                )}
              </div>

              <label>
                Order notes
                <textarea
                  rows="2"
                  value={orderForm.notes}
                  onChange={event =>
                    setOrderForm({
                      ...orderForm,
                      notes: event.target.value,
                    })
                  }
                />
              </label>

              <div className="food-cart-total">
                <span>Estimated total</span>

                <strong>
                  {money(
                    cart.reduce((sum, item) => {
                      const extras = data.modifierGroups
                        .flatMap(group => group.food_modifier_options || [])
                        .filter(option =>
                          item.modifierOptionIds.includes(option.id)
                        )
                        .reduce(
                          (total, option) =>
                            total + Number(option.price_delta_cents || 0),
                          0
                        );

                      return (
                        sum +
                        (Number(item.price_cents) + extras) * item.quantity
                      );
                    }, 0)
                  )}
                </strong>
              </div>

              <button
                className="food-button primary full"
                disabled={!cart.length || busy}
                type="submit"
              >
                {busy
                  ? 'Sending order…'
                  : 'Place order & send to kitchen'}
              </button>
            </form>
          </section>
        </div>
      )}

      {view === 'orders' && (
        <section className="food-panel">
          <PanelTitle title="Live order queue" />

          <OrderList
            orders={data.orders}
            onSelect={setSelectedOrder}
          />

          {currentSelectedOrder && (
            <div className="food-order-detail">
              <div className="food-detail-head">
                <div>
                  <span className="food-kicker">ORDER DETAILS</span>
                  <h2>{currentSelectedOrder.order_number}</h2>

                  <p>
                    {currentSelectedOrder.channel_key.replaceAll('_', ' ')} ·{' '}
                    {currentSelectedOrder.food_tables?.table_number
                      ? `Table ${currentSelectedOrder.food_tables.table_number}`
                      : currentSelectedOrder.customer_name ||
                        'No table assigned'}
                  </p>
                </div>

                <button
                  className="food-button secondary"
                  onClick={() => {
                    setSelectedOrder(null);

                    setAmendment({
                      itemId: '',
                      quantity: 1,
                      notes: '',
                      reason: '',
                      modifierOptionIds: [],
                    });
                  }}
                  type="button"
                >
                  Close
                </button>
              </div>

              <div className="food-detail-items">
                {(currentSelectedOrder.food_order_items || []).map(item => (
                  <div className="food-detail-item" key={item.id}>
                    <div>
                      <strong>
                        {item.quantity} × {item.item_name_snapshot}
                      </strong>

                      <small>
                        {item.preparation_notes || 'No preparation notes'} ·{' '}
                        {item.status}
                      </small>
                    </div>

                    <button
                      className="food-icon-button"
                      title="Record amendment"
                      type="button"
                      onClick={() =>
                        setAmendment({
                          itemId: item.id,
                          quantity: item.quantity,
                          notes: item.preparation_notes || '',
                          reason: '',
                          modifierOptionIds: (
                            item.modifiers_snapshot || []
                          ).map(option => option.id),
                        })
                      }
                    >
                      <PencilSquareIcon />
                    </button>
                  </div>
                ))}
              </div>

              {amendment.itemId && (
                <form
                  className="food-inline-form"
                  onSubmit={saveAmendment}
                >
                  <h3>Record customer amendment</h3>

                  <label>
                    Quantity
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={amendment.quantity}
                      onChange={event =>
                        setAmendment({
                          ...amendment,
                          quantity: event.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    Updated preparation instructions
                    <input
                      value={amendment.notes}
                      onChange={event =>
                        setAmendment({
                          ...amendment,
                          notes: event.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    Meal modifications
                    <select
                      multiple
                      value={amendment.modifierOptionIds || []}
                      onChange={event =>
                        setAmendment({
                          ...amendment,
                          modifierOptionIds: Array.from(
                            event.target.selectedOptions
                          ).map(option => option.value),
                        })
                      }
                    >
                      {data.modifierGroups
                        .filter(group =>
                          data.itemModifierGroups.some(
                            link =>
                              link.menu_item_id ===
                                amendmentOrderItem?.menu_item_id &&
                              link.modifier_group_id === group.id
                          )
                        )
                        .flatMap(group => group.food_modifier_options || [])
                        .map(option => (
                          <option key={option.id} value={option.id}>
                            {option.name} (+{money(option.price_delta_cents)})
                          </option>
                        ))}
                    </select>
                  </label>

                  <label className="wide">
                    Reason
                    <input
                      value={amendment.reason}
                      onChange={event =>
                        setAmendment({
                          ...amendment,
                          reason: event.target.value,
                        })
                      }
                      placeholder="Customer requested no tomato"
                    />
                  </label>

                  <button
                    className="food-button primary"
                    disabled={busy}
                    type="submit"
                  >
                    Save amendment & audit event
                  </button>
                </form>
              )}

              <div className="food-order-actions">
                <button
                  onClick={() =>
                    updateOrderStatus(currentSelectedOrder, 'accepted')
                  }
                  type="button"
                >
                  Accept
                </button>

                <button
                  onClick={() =>
                    updateOrderStatus(currentSelectedOrder, 'preparing')
                  }
                  type="button"
                >
                  Preparing
                </button>

                <button
                  onClick={() =>
                    updateOrderStatus(currentSelectedOrder, 'ready')
                  }
                  type="button"
                >
                  Ready
                </button>

                <button
                  onClick={() =>
                    updateOrderStatus(currentSelectedOrder, 'served')
                  }
                  type="button"
                >
                  Served
                </button>

                <button
                  onClick={() =>
                    updateOrderStatus(currentSelectedOrder, 'completed')
                  }
                  type="button"
                >
                  Complete
                </button>

                <button
                  className="danger"
                  onClick={() =>
                    updateOrderStatus(currentSelectedOrder, 'cancelled')
                  }
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {view === 'kitchen' && (
        <div className="food-kitchen-grid">
          {data.tickets.map(ticket => (
            <article className="food-ticket" key={ticket.id}>
              <div className="food-ticket-head">
                <span>{ticket.ticket_number}</span>

                <span className={`food-status ${ticket.status}`}>
                  {ticket.status}
                </span>
              </div>

              <h3>
                {ticket.food_kitchen_stations?.name ||
                  'Preparation station'}
              </h3>

              <p>Order {ticket.food_orders?.order_number || '—'}</p>

              <div className="food-ticket-items">
                {(ticket.food_kitchen_ticket_items || []).map(line => (
                  <div key={line.id || line.order_item_id}>
                    <strong>
                      {line.quantity} ×{' '}
                      {line.food_order_items?.item_name_snapshot ||
                        'Order item'}
                    </strong>

                    {line.food_order_items?.preparation_notes && (
                      <small>
                        {line.food_order_items.preparation_notes}
                      </small>
                    )}
                  </div>
                ))}
              </div>

              <small>
                Received{' '}
                {new Date(ticket.sent_at).toLocaleTimeString('en-ZA', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </small>

              <div className="food-ticket-actions">
                {ticket.status === 'new' && (
                  <button
                    onClick={() => updateTicket(ticket, 'acknowledged')}
                    type="button"
                  >
                    Acknowledge
                  </button>
                )}

                {['new', 'acknowledged'].includes(ticket.status) && (
                  <button
                    onClick={() => updateTicket(ticket, 'preparing')}
                    type="button"
                  >
                    Start preparation
                  </button>
                )}

                <button
                  onClick={() => updateTicket(ticket, 'ready')}
                  type="button"
                >
                  Mark ready
                </button>
              </div>
            </article>
          ))}

          {!data.tickets.length && (
            <div className="food-empty-state">
              <FireIcon />
              <h3>No active kitchen tickets</h3>
              <p>
                New orders routed to a preparation station will appear here.
              </p>
            </div>
          )}
        </div>
      )}

      {view === 'ingredients' && (
        <div className="food-dashboard-grid">
          <section className="food-panel">
            <PanelTitle title={`Ingredients (${data.ingredients.length})`} />

            <form className="food-inline-form" onSubmit={addIngredient}>
              <label>
                Ingredient name
                <input
                  required
                  value={ingredientForm.name}
                  onChange={event =>
                    setIngredientForm({
                      ...ingredientForm,
                      name: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Base unit
                <select
                  value={ingredientForm.base_unit}
                  onChange={event =>
                    setIngredientForm({
                      ...ingredientForm,
                      base_unit: event.target.value,
                    })
                  }
                >
                  {['g', 'kg', 'ml', 'l', 'each', 'portion', 'pack'].map(
                    unit => (
                      <option key={unit}>{unit}</option>
                    )
                  )}
                </select>
              </label>

              <label>
                Opening quantity
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={ingredientForm.quantity_on_hand}
                  onChange={event =>
                    setIngredientForm({
                      ...ingredientForm,
                      quantity_on_hand: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Reorder level
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={ingredientForm.reorder_level}
                  onChange={event =>
                    setIngredientForm({
                      ...ingredientForm,
                      reorder_level: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Average cost per base unit (R)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={ingredientForm.average_cost}
                  onChange={event =>
                    setIngredientForm({
                      ...ingredientForm,
                      average_cost: event.target.value,
                    })
                  }
                />
              </label>

              <button className="food-button primary" type="submit">
                Add ingredient
              </button>
            </form>
          </section>

          <section className="food-panel">
            <PanelTitle title="Stock watch" />

            <div className="food-table-wrap">
              <table className="food-table">
                <thead>
                  <tr>
                    <th>INGREDIENT</th>
                    <th>ON HAND</th>
                    <th>REORDER AT</th>
                    <th>STATUS</th>
                  </tr>
                </thead>

                <tbody>
                  {data.ingredients.map(ingredient => {
                    const low =
                      Number(ingredient.quantity_on_hand) <=
                      Number(ingredient.reorder_level);

                    return (
                      <tr key={ingredient.id}>
                        <td>
                          <strong>{ingredient.name}</strong>
                        </td>

                        <td>
                          {ingredient.quantity_on_hand} {ingredient.base_unit}
                        </td>

                        <td>
                          {ingredient.reorder_level} {ingredient.base_unit}
                        </td>

                        <td>
                          <span
                            className={`food-status ${
                              low ? 'warning' : 'good'
                            }`}
                          >
                            {low ? 'Reorder' : 'Healthy'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                  {!data.ingredients.length && (
                    <EmptyRow
                      text="No ingredients recorded yet."
                      cols={4}
                    />
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {view === 'recipes' && (
        <section className="food-panel">
          <PanelTitle title="Recipe catalogue" />

          <p className="food-muted">
            Recipes connect menu items to ingredient quantities for costing
            and stock consumption. Recipe editor and controlled stock
            deduction are the next workflow to activate; the database
            schema is included in this package.
          </p>

          <div className="food-table-wrap">
            <table className="food-table">
              <thead>
                <tr>
                  <th>MENU ITEM</th>
                  <th>RECIPE</th>
                  <th>STATUS</th>
                </tr>
              </thead>

              <tbody>
                {data.menu.map(item => {
                  const recipe = data.recipes.find(
                    entry => entry.menu_item_id === item.id
                  );

                  return (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{recipe?.id ? 'Configured' : 'Not configured'}</td>

                      <td>
                        <span className="food-status muted">
                          {recipe?.active ? 'Active' : 'Needs setup'}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {!data.menu.length && (
                  <EmptyRow
                    text="Add menu items before creating recipes."
                    cols={3}
                  />
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {view === 'reports' && (
        <div className="food-stat-grid">
          <Stat
            icon={ClipboardDocumentListIcon}
            label="Orders recorded"
            value={data.orders.length}
          />

          <Stat
            icon={CurrencyDollarIcon}
            label="Gross order value"
            value={money(totals.sales)}
          />

          <Stat
            icon={CubeIcon}
            label="Ingredients tracked"
            value={data.ingredients.length}
          />

          <Stat
            icon={ExclamationTriangleIcon}
            label="Reorder alerts"
            value={totals.lowStock}
          />

          <p className="food-muted report-note">
            These are outlet-level operational totals from the currently
            loaded order history (latest 100 orders), not a complete
            accounting report. Date-filtered sales, refunds, tax and profit
            reporting will be added with the finance workflows.
          </p>
        </div>
      )}

      {view === 'settings' && (
        <div className="food-dashboard-grid">
          <section className="food-panel">
            <PanelTitle title="Outlet configuration" />

            <div className="food-settings-row">
              <span>Active outlet</span>
              <strong>{activeOutlet?.name}</strong>
            </div>

            <div className="food-settings-row">
              <span>Business model</span>
              <strong>
                {activeOutlet?.outlet_type?.replaceAll('_', ' ')}
              </strong>
            </div>

            <div className="food-settings-row">
              <span>Currency</span>
              <strong>
                {settings?.default_currency || activeOutlet?.currency || 'ZAR'}
              </strong>
            </div>

            <div className="food-settings-row">
              <span>Timezone</span>
              <strong>
                {settings?.timezone || 'Africa/Johannesburg'}
              </strong>
            </div>
          </section>

          <section className="food-panel">
            <PanelTitle title="Enabled service channels" />

            <div className="food-channel-list">
              {FOOD_CHANNELS.map(channel => (
                <label key={channel.value}>
                  <input
                    type="checkbox"
                    checked={(settings?.enabled_channels || []).includes(
                      channel.value
                    )}
                    readOnly
                  />
                  <span>{channel.label}</span>
                </label>
              ))}
            </div>

            <p className="food-muted">
              Channel configuration is initialized during outlet setup.
              Full editing controls are planned alongside outlet
              administration.
            </p>
          </section>
        </div>
      )}
    </main>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <article className="food-stat">
      <span className="food-stat-icon">
        <Icon />
      </span>

      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function PanelTitle({ title, action }) {
  return (
    <div className="food-panel-title">
      <h2>{title}</h2>
      {action}
    </div>
  );
}

function EmptyRow({ text, cols }) {
  return (
    <tr>
      <td colSpan={cols} className="food-empty-cell">
        {text}
      </td>
    </tr>
  );
}

function OrderList({ orders, onSelect }) {
  return (
    <div className="food-order-list">
      {orders.map(order => (
        <button
          key={order.id}
          className="food-order-row"
          onClick={() => onSelect(order)}
          type="button"
        >
          <span className="food-order-icon">
            <ClipboardDocumentListIcon />
          </span>

          <span className="food-order-main">
            <strong>{order.order_number}</strong>

            <small>
              {(order.channel_key || '').replaceAll('_', ' ')} ·{' '}
              {order.food_tables?.table_number
                ? `Table ${order.food_tables.table_number}`
                : order.customer_name || 'No table'}
            </small>
          </span>

          <span className="food-order-right">
            <strong>{money(order.total_cents)}</strong>

            <small className={`food-status ${order.status}`}>
              {(order.status || '').replaceAll('_', ' ')}
            </small>
          </span>
        </button>
      ))}

      {!orders.length && (
        <p className="food-muted">
          No orders have been recorded for this outlet yet.
        </p>
      )}
    </div>
  );
}