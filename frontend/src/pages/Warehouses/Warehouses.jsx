
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PlusIcon,
  PencilSquareIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  BuildingOffice2Icon,
  MapPinIcon,
  Squares2X2Icon,
  CheckCircleIcon,
  XCircleIcon,
  XMarkIcon,
  CubeIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../components/layout/DashboardLayout';

const SECTIONS = [
  { key: 'branches', label: 'Branches', table: 'branches' },
  { key: 'warehouses', label: 'Warehouses', table: 'warehouses' },
  { key: 'aisles', label: 'Aisles', table: 'warehouse_aisles' },
  { key: 'racks', label: 'Racks', table: 'warehouse_racks' },
  { key: 'shelves', label: 'Shelves', table: 'warehouse_shelves' },
  { key: 'locations', label: 'Storage locations', table: 'locations' }
];

const EMPTY_FORM = {
  name: '',
  code: '',
  description: '',
  address: '',
  phone: '',
  email: '',
  branch_id: '',
  warehouse_id: '',
  aisle_id: '',
  rack_id: '',
  shelf_id: '',
  aisle: '',
  rack: '',
  shelf: '',
  bin: '',
  active: true,
  sort_order: 0
};

const DEFAULT_LAYOUT = {
  aisles: 2,
  racks: 3,
  shelves: 4,
  bins: 2
};

function getErrorMessage(error) {
  if (error?.code === '42501') {
    return 'You do not have permission to manage this record. Business admin access is required.';
  }

  if (error?.code === '23503') {
    return 'This record is linked to other records and cannot be changed or removed in this way.';
  }

  if (error?.code === '23505') {
    return 'A record with these details already exists.';
  }

  return error?.message || 'The operation could not be completed.';
}

function Field({ label, children, required = false }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-slate-700">
        {label}{required ? ' *' : ''}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-ZA');
}

function sequenceNumber(value) {
  const match = String(value || '').match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function nextSequence(items, parentId, parentField, valueField) {
  const highest = items
    .filter(item => item[parentField] === parentId)
    .reduce((max, item) => {
      return Math.max(
        max,
        sequenceNumber(item[valueField])
      );
    }, 0);

  return highest + 1;
}

function paddedCode(prefix, number) {
  return `${prefix}${String(number).padStart(2, '0')}`;
}

function layoutTotal(layout) {
  return (
    Number(layout.aisles || 0) *
    Number(layout.racks || 0) *
    Number(layout.shelves || 0) *
    Number(layout.bins || 0)
  );
}

export default function Warehouses() {
  const { selectedBusinessId, role } = useWorkspace();

  const [section, setSection] = useState('branches');

  const [records, setRecords] = useState({
    branches: [],
    warehouses: [],
    aisles: [],
    racks: [],
    shelves: [],
    locations: [],
    inventory: []
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [layoutSaving, setLayoutSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [layoutModalOpen, setLayoutModalOpen] = useState(false);
  const [layoutWarehouse, setLayoutWarehouse] = useState(null);
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);

  const isAdmin = String(role || '').toLowerCase() === 'admin';

  const loadData = useCallback(async () => {
    if (!selectedBusinessId) {
      setRecords({
        branches: [],
        warehouses: [],
        aisles: [],
        racks: [],
        shelves: [],
        locations: [],
        inventory: []
      });

      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const [
        branchesResult,
        warehousesResult,
        aislesResult,
        racksResult,
        shelvesResult,
        locationsResult,
        inventoryResult
      ] = await Promise.all([
        supabase
          .from('branches')
          .select('*')
          .eq('business_id', selectedBusinessId)
          .order('name'),

        supabase
          .from('warehouses')
          .select('*')
          .eq('business_id', selectedBusinessId)
          .order('name'),

        supabase
          .from('warehouse_aisles')
          .select('*')
          .eq('business_id', selectedBusinessId)
          .order('sort_order')
          .order('name'),

        supabase
          .from('warehouse_racks')
          .select('*')
          .eq('business_id', selectedBusinessId)
          .order('sort_order')
          .order('name'),

        supabase
          .from('warehouse_shelves')
          .select('*')
          .eq('business_id', selectedBusinessId)
          .order('sort_order')
          .order('name'),

        supabase
          .from('locations')
          .select('*')
          .eq('business_id', selectedBusinessId)
          .order('aisle')
          .order('rack')
          .order('shelf'),

        supabase
          .from('inventory')
          .select('location_id, quantity')
          .eq('business_id', selectedBusinessId)
      ]);

      const results = [
        branchesResult,
        warehousesResult,
        aislesResult,
        racksResult,
        shelvesResult,
        locationsResult,
        inventoryResult
      ];

      const failed = results.find(result => result.error);

      if (failed) throw failed.error;

      setRecords({
        branches: branchesResult.data || [],
        warehouses: warehousesResult.data || [],
        aisles: aislesResult.data || [],
        racks: racksResult.data || [],
        shelves: shelvesResult.data || [],
        locations: locationsResult.data || [],
        inventory: inventoryResult.data || []
      });
    } catch (err) {
      console.error('Warehouse data loading failed:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [selectedBusinessId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const countsByLocation = useMemo(() => {
    const result = {};

    records.inventory.forEach(item => {
      result[item.location_id] =
        (result[item.location_id] || 0) +
        Number(item.quantity || 0);
    });

    return result;
  }, [records.inventory]);

  const activeCounts = useMemo(() => ({
    branches: records.branches.filter(item => item.active).length,
    warehouses: records.warehouses.filter(item => item.active).length,
    aisles: records.aisles.filter(item => item.active).length,
    racks: records.racks.filter(item => item.active).length,
    shelves: records.shelves.filter(item => item.active).length,
    locations: records.locations.filter(item => item.active !== false).length
  }), [records]);

  const currentRecords = records[section] || [];

  const filteredRecords = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return currentRecords;

    return currentRecords.filter(item =>
      Object.values(item).some(value =>
        String(value ?? '').toLowerCase().includes(term)
      )
    );
  }, [currentRecords, search]);

  function openCreate() {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      active: true,
      sort_order: 0
    });
    setModalOpen(true);
  }

  function openEdit(record) {
    setEditing(record);

    setForm({
      ...EMPTY_FORM,
      ...record,
      active: record.active !== false
    });

    setModalOpen(true);
  }

  function openLayoutWizard(warehouse) {
    setLayoutWarehouse(warehouse);
    setLayout({ ...DEFAULT_LAYOUT });
    setLayoutModalOpen(true);
  }

  function updateField(field, value) {
    setForm(previous => {
      const next = { ...previous, [field]: value };

      if (field === 'warehouse_id') {
        next.aisle_id = '';
        next.rack_id = '';
        next.shelf_id = '';
      }

      if (field === 'aisle_id') {
        next.rack_id = '';
        next.shelf_id = '';
      }

      if (field === 'rack_id') {
        next.shelf_id = '';
      }

      return next;
    });
  }

  function updateLayout(field, value) {
    setLayout(previous => ({
      ...previous,
      [field]: value
    }));
  }

  function getPayload() {
    const business_id = selectedBusinessId;

    switch (section) {
      case 'branches':
        return {
          business_id,
          name: form.name.trim(),
          code: form.code.trim() || null,
          address: form.address.trim() || null,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          active: form.active
        };

      case 'warehouses':
        return {
          business_id,
          branch_id: form.branch_id,
          name: form.name.trim(),
          code: form.code.trim() || null,
          description: form.description.trim() || null,
          active: form.active
        };

      case 'aisles':
        return {
          business_id,
          warehouse_id: form.warehouse_id,
          name: form.name.trim(),
          code: form.code.trim() || null,
          description: form.description.trim() || null,
          active: form.active,
          sort_order: Number(form.sort_order || 0)
        };

      case 'racks': {
        const aisle = records.aisles.find(
          item => item.id === form.aisle_id
        );

        if (!aisle) throw new Error('Select a valid aisle.');

        return {
          business_id,
          warehouse_id: aisle.warehouse_id,
          aisle_id: aisle.id,
          name: form.name.trim(),
          code: form.code.trim() || null,
          description: form.description.trim() || null,
          active: form.active,
          sort_order: Number(form.sort_order || 0)
        };
      }

      case 'shelves': {
        const rack = records.racks.find(
          item => item.id === form.rack_id
        );

        if (!rack) throw new Error('Select a valid rack.');

        return {
          business_id,
          warehouse_id: rack.warehouse_id,
          aisle_id: rack.aisle_id,
          rack_id: rack.id,
          name: form.name.trim(),
          code: form.code.trim() || null,
          description: form.description.trim() || null,
          active: form.active,
          sort_order: Number(form.sort_order || 0)
        };
      }

      case 'locations': {
        const shelf = records.shelves.find(
          item => item.id === form.shelf_id
        );

        if (!shelf) throw new Error('Select a valid shelf.');

        const aisle = records.aisles.find(
          item => item.id === shelf.aisle_id
        );

        const rack = records.racks.find(
          item => item.id === shelf.rack_id
        );

        if (!aisle || !rack) {
          throw new Error('The selected shelf has an invalid hierarchy.');
        }

        return {
          business_id,
          warehouse_id: shelf.warehouse_id,
          aisle_id: shelf.aisle_id,
          rack_id: shelf.rack_id,
          shelf_id: shelf.id,
          aisle: aisle.code || aisle.name,
          rack: rack.code || rack.name,
          shelf: shelf.code || shelf.name,
          bin: form.bin.trim() || null,
          description: form.description.trim() || null,
          active: form.active
        };
      }

      default:
        throw new Error('Unknown warehouse section.');
    }
  }

  async function handleSave(event) {
    event.preventDefault();

    if (!selectedBusinessId) {
      toast.error('Select a business first.');
      return;
    }

    if (!isAdmin) {
      toast.error('Only business administrators can manage warehouse structures.');
      return;
    }

    if (!form.name.trim() && section !== 'locations') {
      toast.error('Enter a name.');
      return;
    }

    if (section === 'locations' && !form.shelf_id) {
      toast.error('Select a shelf.');
      return;
    }

    setSaving(true);

    try {
      const table = SECTIONS.find(
        item => item.key === section
      ).table;

      const payload = getPayload();

      let query = supabase.from(table);

      if (editing?.id) {
        query = query
          .update(payload)
          .eq('id', editing.id)
          .eq('business_id', selectedBusinessId);
      } else {
        query = query.insert(payload);
      }

      const { error: saveError } = await query;

      if (saveError) throw saveError;

      toast.success(editing ? 'Record updated.' : 'Record created.');

      setModalOpen(false);
      setEditing(null);

      await loadData();
    } catch (err) {
      console.error('Warehouse save failed:', err);
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function createWarehouseLayout(event) {
    event.preventDefault();

    if (!selectedBusinessId || !layoutWarehouse) {
      toast.error('Select a valid warehouse.');
      return;
    }

    if (!isAdmin) {
      toast.error('Business administrator access is required.');
      return;
    }

    const values = {
      aisles: Number(layout.aisles),
      racks: Number(layout.racks),
      shelves: Number(layout.shelves),
      bins: Number(layout.bins)
    };

    const valid = Object.values(values).every(
      value => Number.isInteger(value) && value >= 1 && value <= 50
    );

    if (!valid) {
      toast.error('Each level must have a whole number between 1 and 50.');
      return;
    }

    const totalBins = layoutTotal(values);

    if (totalBins > 5000) {
      toast.error('This layout exceeds the 5,000-location limit per setup.');
      return;
    }

    setLayoutSaving(true);

    let created = {
      aisles: 0,
      racks: 0,
      shelves: 0,
      locations: 0
    };

    try {
      const warehouseId = layoutWarehouse.id;
      const warehouseCode = layoutWarehouse.code || 'WH';

      const aisleStart = nextSequence(
        records.aisles,
        warehouseId,
        'warehouse_id',
        'code'
      );

      const aislePayload = Array.from(
        { length: values.aisles },
        (_, index) => {
          const number = aisleStart + index;
          const code = paddedCode('A', number);

          return {
            business_id: selectedBusinessId,
            warehouse_id: warehouseId,
            name: `Aisle ${code}`,
            code,
            description: `Generated aisle ${code} in ${layoutWarehouse.name}`,
            active: true,
            sort_order: number
          };
        }
      );

      const { data: newAisles, error: aisleError } = await supabase
        .from('warehouse_aisles')
        .insert(aislePayload)
        .select('*');

      if (aisleError) throw aisleError;

      created.aisles = newAisles.length;

      for (const aisle of newAisles) {
        const rackStart = nextSequence(
          records.racks,
          aisle.id,
          'aisle_id',
          'code'
        );

        const rackPayload = Array.from(
          { length: values.racks },
          (_, index) => {
            const number = rackStart + index;
            const code = paddedCode('R', number);

            return {
              business_id: selectedBusinessId,
              warehouse_id: warehouseId,
              aisle_id: aisle.id,
              name: `Rack ${code}`,
              code,
              description: `Generated rack ${code} in ${aisle.name}`,
              active: true,
              sort_order: number
            };
          }
        );

        const { data: newRacks, error: rackError } = await supabase
          .from('warehouse_racks')
          .insert(rackPayload)
          .select('*');

        if (rackError) throw rackError;

        created.racks += newRacks.length;

        for (const rack of newRacks) {
          const shelfStart = nextSequence(
            records.shelves,
            rack.id,
            'rack_id',
            'code'
          );

          const shelfPayload = Array.from(
            { length: values.shelves },
            (_, index) => {
              const number = shelfStart + index;
              const code = paddedCode('S', number);

              return {
                business_id: selectedBusinessId,
                warehouse_id: warehouseId,
                aisle_id: aisle.id,
                rack_id: rack.id,
                name: `Shelf ${code}`,
                code,
                description: `Generated shelf ${code} in ${rack.name}`,
                active: true,
                sort_order: number
              };
            }
          );

          const { data: newShelves, error: shelfError } = await supabase
            .from('warehouse_shelves')
            .insert(shelfPayload)
            .select('*');

          if (shelfError) throw shelfError;

          created.shelves += newShelves.length;

          for (const shelf of newShelves) {
            const binStart = nextSequence(
              records.locations,
              shelf.id,
              'shelf_id',
              'bin'
            );

            const aisleLabel = aisle.code || aisle.name;
            const rackLabel = rack.code || rack.name;
            const shelfLabel = shelf.code || shelf.name;

            const locationPayload = Array.from(
              { length: values.bins },
              (_, index) => {
                const number = binStart + index;
                const bin = paddedCode('B', number);

                return {
                  business_id: selectedBusinessId,
                  warehouse_id: warehouseId,
                  aisle_id: aisle.id,
                  rack_id: rack.id,
                  shelf_id: shelf.id,
                  aisle: aisleLabel,
                  rack: rackLabel,
                  shelf: shelfLabel,
                  bin,
                  description: `${warehouseCode} / ${aisleLabel} / ${rackLabel} / ${shelfLabel} / ${bin}`,
                  active: true
                };
              }
            );

            const { data: newLocations, error: locationError } =
              await supabase
                .from('locations')
                .insert(locationPayload)
                .select('id');

            if (locationError) throw locationError;

            created.locations += newLocations.length;
          }
        }
      }

      toast.success(
        `Warehouse layout created: ${formatNumber(created.locations)} storage positions.`
      );

      setLayoutModalOpen(false);
      setLayoutWarehouse(null);

      await loadData();
    } catch (err) {
      console.error('Warehouse layout generation failed:', err);

      if (
        created.aisles ||
        created.racks ||
        created.shelves ||
        created.locations
      ) {
        toast.error(
          `Layout was only partially created. ${created.aisles} aisles, ${created.racks} racks, ${created.shelves} shelves and ${created.locations} bins were saved. Refresh the page before continuing.`
        );

        await loadData();
      } else {
        toast.error(getErrorMessage(err));
      }
    } finally {
      setLayoutSaving(false);
    }
  }

  async function toggleActive(record) {
    if (!isAdmin) {
      toast.error('Only business administrators can change status.');
      return;
    }

    const table = SECTIONS.find(
      item => item.key === section
    ).table;

    try {
      const { error: updateError } = await supabase
        .from(table)
        .update({ active: !record.active })
        .eq('id', record.id)
        .eq('business_id', selectedBusinessId);

      if (updateError) throw updateError;

      toast.success(
        record.active ? 'Record deactivated.' : 'Record activated.'
      );

      await loadData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  function getParentName(record) {
    if (section === 'warehouses') {
      return records.branches.find(
        item => item.id === record.branch_id
      )?.name || '—';
    }

    if (section === 'aisles') {
      return records.warehouses.find(
        item => item.id === record.warehouse_id
      )?.name || '—';
    }

    if (section === 'racks') {
      return records.aisles.find(
        item => item.id === record.aisle_id
      )?.name || '—';
    }

    if (section === 'shelves') {
      return records.racks.find(
        item => item.id === record.rack_id
      )?.name || '—';
    }

    if (section === 'locations') {
      const shelf = records.shelves.find(
        item => item.id === record.shelf_id
      );

      const rack = records.racks.find(
        item => item.id === record.rack_id
      );

      const aisle = records.aisles.find(
        item => item.id === record.aisle_id
      );

      return [
        aisle?.code || aisle?.name,
        rack?.code || rack?.name,
        shelf?.code || shelf?.name
      ].filter(Boolean).join(' / ') || '—';
    }

    return '—';
  }

  const availableAisles = records.aisles.filter(
    item => item.active &&
      item.warehouse_id === form.warehouse_id
  );

  const availableRacks = records.racks.filter(
    item => item.active &&
      item.aisle_id === form.aisle_id
  );

  const availableShelves = records.shelves.filter(
    item => item.active &&
      item.rack_id === form.rack_id
  );

  const activeBranches = records.branches.filter(
    item => item.active
  );

  const activeWarehouses = records.warehouses.filter(
    item => item.active
  );

  const previewTotal = layoutTotal(layout);

  function renderFormFields() {
    return (
      <>
        {section === 'branches' && (
          <>
            <Field label="Branch name" required>
              <input
                className={inputClass}
                value={form.name}
                onChange={e => updateField('name', e.target.value)}
                required
              />
            </Field>

            <Field label="Branch code">
              <input
                className={inputClass}
                value={form.code}
                onChange={e => updateField('code', e.target.value)}
              />
            </Field>

            <Field label="Address">
              <input
                className={inputClass}
                value={form.address}
                onChange={e => updateField('address', e.target.value)}
              />
            </Field>

            <Field label="Phone">
              <input
                className={inputClass}
                value={form.phone}
                onChange={e => updateField('phone', e.target.value)}
              />
            </Field>

            <Field label="Email">
              <input
                className={inputClass}
                type="email"
                value={form.email}
                onChange={e => updateField('email', e.target.value)}
              />
            </Field>
          </>
        )}

        {section === 'warehouses' && (
          <>
            <Field label="Branch" required>
              <select
                className={inputClass}
                value={form.branch_id}
                onChange={e => updateField('branch_id', e.target.value)}
                required
              >
                <option value="">Select branch</option>
                {activeBranches.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Warehouse name" required>
              <input
                className={inputClass}
                value={form.name}
                onChange={e => updateField('name', e.target.value)}
                required
              />
            </Field>

            <Field label="Warehouse code">
              <input
                className={inputClass}
                value={form.code}
                onChange={e => updateField('code', e.target.value)}
              />
            </Field>

            <Field label="Description">
              <textarea
                className={inputClass}
                rows="2"
                value={form.description || ''}
                onChange={e => updateField('description', e.target.value)}
              />
            </Field>
          </>
        )}

        {section === 'aisles' && (
          <>
            <Field label="Warehouse" required>
              <select
                className={inputClass}
                value={form.warehouse_id}
                onChange={e => updateField('warehouse_id', e.target.value)}
                required
              >
                <option value="">Select warehouse</option>
                {activeWarehouses.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>

            <NameFields form={form} updateField={updateField} />
          </>
        )}

        {section === 'racks' && (
          <>
            <Field label="Warehouse" required>
              <select
                className={inputClass}
                value={form.warehouse_id}
                onChange={e => updateField('warehouse_id', e.target.value)}
                required
              >
                <option value="">Select warehouse</option>
                {activeWarehouses.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Aisle" required>
              <select
                className={inputClass}
                value={form.aisle_id}
                onChange={e => updateField('aisle_id', e.target.value)}
                required
              >
                <option value="">Select aisle</option>
                {availableAisles.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>

            <NameFields form={form} updateField={updateField} />
          </>
        )}

        {section === 'shelves' && (
          <>
            <Field label="Warehouse" required>
              <select
                className={inputClass}
                value={form.warehouse_id}
                onChange={e => updateField('warehouse_id', e.target.value)}
                required
              >
                <option value="">Select warehouse</option>
                {activeWarehouses.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Aisle" required>
              <select
                className={inputClass}
                value={form.aisle_id}
                onChange={e => updateField('aisle_id', e.target.value)}
                required
              >
                <option value="">Select aisle</option>
                {availableAisles.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Rack" required>
              <select
                className={inputClass}
                value={form.rack_id}
                onChange={e => updateField('rack_id', e.target.value)}
                required
              >
                <option value="">Select rack</option>
                {availableRacks.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>

            <NameFields form={form} updateField={updateField} />
          </>
        )}

        {section === 'locations' && (
          <>
            <Field label="Warehouse" required>
              <select
                className={inputClass}
                value={form.warehouse_id}
                onChange={e => updateField('warehouse_id', e.target.value)}
                required
              >
                <option value="">Select warehouse</option>
                {activeWarehouses.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Aisle" required>
              <select
                className={inputClass}
                value={form.aisle_id}
                onChange={e => updateField('aisle_id', e.target.value)}
                required
              >
                <option value="">Select aisle</option>
                {availableAisles.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Rack" required>
              <select
                className={inputClass}
                value={form.rack_id}
                onChange={e => updateField('rack_id', e.target.value)}
                required
              >
                <option value="">Select rack</option>
                {availableRacks.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Shelf" required>
              <select
                className={inputClass}
                value={form.shelf_id}
                onChange={e => updateField('shelf_id', e.target.value)}
                required
              >
                <option value="">Select shelf</option>
                {availableShelves.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Bin / storage position">
              <input
                className={inputClass}
                value={form.bin || ''}
                onChange={e => updateField('bin', e.target.value)}
                placeholder="e.g. B01"
              />
            </Field>

            <Field label="Description">
              <textarea
                className={inputClass}
                rows="2"
                value={form.description || ''}
                onChange={e => updateField('description', e.target.value)}
              />
            </Field>
          </>
        )}

        {['aisles', 'racks', 'shelves'].includes(section) && (
          <Field label="Sort order">
            <input
              className={inputClass}
              type="number"
              value={form.sort_order ?? 0}
              onChange={e => updateField('sort_order', e.target.value)}
            />
          </Field>
        )}

        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={form.active !== false}
            onChange={e => updateField('active', e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Active
        </label>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold tracking-widest text-blue-600">
            STORAGE STRUCTURE
          </p>

          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Warehouses & locations
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage branches, warehouses and the physical locations where parts are stored.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <PlusIcon className="h-4 w-4" />
              Add {SECTIONS.find(item => item.key === section)?.label.replace(/s$/, '')}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {SECTIONS.map(item => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              setSection(item.key);
              setSearch('');
            }}
            className={`rounded-xl border p-4 text-left transition ${
              section === item.key
                ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <p className="text-xs font-medium text-slate-500">
              {item.label}
            </p>

            <p className="mt-2 text-2xl font-bold text-slate-900">
              {activeCounts[item.key] ?? 0}
            </p>

            <p className="mt-1 text-xs text-slate-500">Active</p>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">
              {SECTIONS.find(item => item.key === section)?.label}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {currentRecords.length} records in this business
            </p>
          </div>

          <div className="relative w-full sm:max-w-xs">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search records..."
              className={`${inputClass} pl-10`}
            />
          </div>
        </div>

        {error && (
          <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && filteredRecords.length === 0 && (
          <div className="px-6 py-16 text-center">
            <BuildingOffice2Icon className="mx-auto h-12 w-12 text-slate-300" />

            <h3 className="mt-3 font-semibold text-slate-800">
              No {SECTIONS.find(item => item.key === section)?.label.toLowerCase()} found
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              {isAdmin
                ? 'Add your first record to start building the storage hierarchy.'
                : 'There are no records available for this business.'}
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <ArrowPathIcon className="h-5 w-5 animate-spin" />
            Loading warehouse structure...
          </div>
        ) : filteredRecords.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Name / Position
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Code / Bin
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Parent
                  </th>

                  {section === 'locations' && (
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                      Units stored
                    </th>
                  )}

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Status
                  </th>

                  {isAdmin && (
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map(record => {
                  const displayName = section === 'locations'
                    ? [
                        record.aisle,
                        record.rack,
                        record.shelf,
                        record.bin
                      ].filter(Boolean).join(' / ')
                    : record.name;

                  return (
                    <tr key={record.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-sm text-slate-900">
                          {displayName || record.description || '—'}
                        </div>

                        {record.description && section !== 'locations' && (
                          <div className="mt-1 text-xs text-slate-500">
                            {record.description}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {record.code || record.bin || '—'}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {getParentName(record)}
                      </td>

                      {section === 'locations' && (
                        <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                          {formatNumber(countsByLocation[record.id] || 0)}
                        </td>
                      )}

                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          record.active === false
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {record.active === false ? 'Inactive' : 'Active'}
                        </span>
                      </td>

                      {isAdmin && (
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            {section === 'warehouses' && (
                              <button
                                type="button"
                                onClick={() => openLayoutWizard(record)}
                                title="Build warehouse layout"
                                className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-blue-700 hover:bg-blue-100"
                              >
                                <Squares2X2Icon className="h-4 w-4" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => openEdit(record)}
                              title="Edit"
                              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"
                            >
                              <PencilSquareIcon className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => toggleActive(record)}
                              title={record.active === false ? 'Activate' : 'Deactivate'}
                              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"
                            >
                              {record.active === false
                                ? <CheckCircleIcon className="h-4 w-4" />
                                : <XCircleIcon className="h-4 w-4" />}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-500">
          Showing {filteredRecords.length} of {currentRecords.length} records
        </div>
      </div>

      {!isAdmin && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          You have read-only access to warehouse structures. Contact a business administrator to make changes.
        </div>
      )}

      {/* Manual create/edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
          <form
            onSubmit={handleSave}
            className="my-8 w-full max-w-xl rounded-2xl bg-white shadow-xl"
          >
            <div className="border-b border-slate-200 px-6 py-5">
              <p className="text-xs font-bold tracking-widest text-blue-600">
                WAREHOUSE CONFIGURATION
              </p>

              <h2 className="mt-1 text-xl font-bold text-slate-900">
                {editing ? 'Edit' : 'Add'} {SECTIONS.find(item => item.key === section)?.label.replace(/s$/, '')}
              </h2>
            </div>

            <div className="grid gap-4 p-6 sm:grid-cols-2">
              {renderFormFields()}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editing ? 'Save changes' : 'Create record'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Automated warehouse layout builder */}
      {layoutModalOpen && layoutWarehouse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4">
          <form
            onSubmit={createWarehouseLayout}
            className="my-8 w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-xs font-bold tracking-widest text-blue-600">
                  AUTOMATED STORAGE SETUP
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  Build warehouse layout
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {layoutWarehouse.name}
                  {layoutWarehouse.code ? ` · ${layoutWarehouse.code}` : ''}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setLayoutModalOpen(false)}
                disabled={layoutSaving}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 p-6">
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                <div className="flex items-start gap-3">
                  <BuildingOffice2Icon className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />

                  <div>
                    <p className="text-sm font-semibold text-blue-900">
                      Configure your physical warehouse
                    </p>

                    <p className="mt-1 text-xs leading-5 text-blue-800">
                      Enter how many new storage sections you want to create.
                      Existing aisles and their contents will not be deleted or replaced.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <LayoutNumberField
                  label="Number of aisles"
                  value={layout.aisles}
                  onChange={value => updateLayout('aisles', value)}
                  description="How many aisles to add to this warehouse."
                />

                <LayoutNumberField
                  label="Racks per aisle"
                  value={layout.racks}
                  onChange={value => updateLayout('racks', value)}
                  description="How many racks each new aisle will contain."
                />

                <LayoutNumberField
                  label="Shelves per rack"
                  value={layout.shelves}
                  onChange={value => updateLayout('shelves', value)}
                  description="How many shelves each rack will contain."
                />

                <LayoutNumberField
                  label="Bins per shelf"
                  value={layout.bins}
                  onChange={value => updateLayout('bins', value)}
                  description="How many individual storage positions each shelf will have."
                />
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">
                    Layout preview
                  </h3>

                  <span className="text-xs text-slate-500">
                    New records
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <PreviewCount label="Aisles" value={layout.aisles} />
                  <PreviewCount label="Racks" value={Number(layout.aisles || 0) * Number(layout.racks || 0)} />
                  <PreviewCount label="Shelves" value={Number(layout.aisles || 0) * Number(layout.racks || 0) * Number(layout.shelves || 0)} />
                  <PreviewCount label="Bins" value={previewTotal} />
                </div>

                <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 p-3">
                  <div className="flex items-center gap-2">
                    <CubeIcon className="h-5 w-5 text-blue-600" />
                    <span className="text-sm font-medium text-slate-700">
                      Total storage positions
                    </span>
                  </div>

                  <span className="text-xl font-bold text-slate-900">
                    {formatNumber(previewTotal)}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Example location codes
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  Each bin receives a code based on its aisle, rack and shelf.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {['A01 / R01 / S01 / B01', 'A01 / R01 / S01 / B02', 'A01 / R01 / S02 / B01'].map(code => (
                    <span
                      key={code}
                      className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs text-slate-700"
                    >
                      {code}
                    </span>
                  ))}
                </div>
              </div>

              <p className="text-xs leading-5 text-slate-500">
                Each bin is created as an individual storage location. The system
                saves the aisle, rack and shelf relationships so products can
                later be assigned to their exact positions.
              </p>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => setLayoutModalOpen(false)}
                disabled={layoutSaving}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  layoutSaving ||
                  !previewTotal ||
                  previewTotal > 5000
                }
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {layoutSaving ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    Building layout...
                  </>
                ) : (
                  <>
                    <Squares2X2Icon className="h-4 w-4" />
                    Generate warehouse layout
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function NameFields({ form, updateField }) {
  return (
    <>
      <Field label="Name" required>
        <input
          className={inputClass}
          value={form.name}
          onChange={e => updateField('name', e.target.value)}
          required
        />
      </Field>

      <Field label="Code">
        <input
          className={inputClass}
          value={form.code || ''}
          onChange={e => updateField('code', e.target.value)}
        />
      </Field>

      <Field label="Description">
        <textarea
          className={inputClass}
          rows="2"
          value={form.description || ''}
          onChange={e => updateField('description', e.target.value)}
        />
      </Field>
    </>
  );
}

function LayoutNumberField({ label, value, onChange, description }) {
  return (
    <Field label={label} required>
      <input
        className={inputClass}
        type="number"
        min="1"
        max="50"
        step="1"
        value={value}
        onChange={e => onChange(e.target.value)}
        required
      />

      <p className="text-xs text-slate-500">{description}</p>
    </Field>
  );
}

function PreviewCount({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">
        {formatNumber(value)}
      </p>
    </div>
  );
}
