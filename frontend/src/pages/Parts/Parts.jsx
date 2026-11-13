
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  TrashIcon,
  EyeIcon,
  XMarkIcon,
  PhotoIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import { useInventoryData } from '../../context/InventoryContext';

const blank = {
  sku: '',
  name: '',
  category: '',
  manufacturer: '',
  supplier: '',
  cost: '',
  price: '',
  quantity: 0,
  reorderLevel: 5,
  location: '',
  barcode: '',
  description: '',
  automotive: false,
  oem: '',
  make: '',
  model: '',
  yearFrom: '',
  yearTo: '',
  coolingType: '',
};

const MAX_IMAGES = 4;

const money = n =>
  new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 2,
  }).format(n || 0);

function imageUrl(image) {
  return image?.imageUrl || image?.image_url || '';
}

export default function Parts() {
  const data = useInventoryData();
  const [params, setParams] = useSearchParams();

  const [search, setSearch] = useState(params.get('q') || '');
  const [category, setCategory] = useState('All categories');
  const [status, setStatus] = useState('All stock');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [saving, setSaving] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);

  useEffect(() => {
    if (params.get('new') === '1') {
      openForm();
      setParams({});
    }
  }, [params]);

  useEffect(() => {
    return () => {
      imagePreviews.forEach(url => URL.revokeObjectURL(url));
    };
  }, [imagePreviews]);

  const products = useMemo(
    () =>
      data.products.filter(p => {
        const term = search.toLowerCase();

        const matches = [
          p.name,
          p.sku,
          p.oem,
          p.barcode,
          p.manufacturer,
          p.make,
          p.model,
        ].some(v => String(v || '').toLowerCase().includes(term));

        const cat =
          category === 'All categories' || p.category === category;

        const st =
          status === 'All stock' ||
          (status === 'In stock' && p.quantity > p.reorderLevel) ||
          (status === 'Low stock' &&
            p.quantity > 0 &&
            p.quantity <= p.reorderLevel) ||
          (status === 'Out of stock' && p.quantity === 0);

        return matches && cat && st;
      }),
    [data.products, search, category, status]
  );

  function clearSelectedFiles() {
    imagePreviews.forEach(url => URL.revokeObjectURL(url));
    setImageFiles([]);
    setImagePreviews([]);
  }

  function openForm(p) {
    clearSelectedFiles();

    setEditing(p || null);
    setForm(
      p
        ? { ...blank, ...p }
        : { ...blank, category: data.categories[0] || '' }
    );
    setModal(true);
  }

  function handleImageSelection(event) {
    const selected = Array.from(event.target.files || []);
    event.target.value = '';

    if (!selected.length) return;

    const existingCount = editing?.images?.length || 0;
    const remaining = MAX_IMAGES - existingCount - imageFiles.length;

    if (selected.length > remaining) {
      toast.error(`You can add only ${Math.max(0, remaining)} more image(s).`);
      return;
    }

    const validFiles = selected.filter(file => {
      const validType = [
        'image/jpeg',
        'image/png',
        'image/webp',
      ].includes(file.type);

      if (!validType) {
        toast.error(`${file.name}: use JPG, PNG or WebP.`);
        return false;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name}: image must be 5 MB or smaller.`);
        return false;
      }

      return true;
    });

    if (!validFiles.length) return;

    setImageFiles(current => [...current, ...validFiles]);
    setImagePreviews(current => [
      ...current,
      ...validFiles.map(file => URL.createObjectURL(file)),
    ]);
  }

  function removePendingImage(index) {
    const preview = imagePreviews[index];

    if (preview) URL.revokeObjectURL(preview);

    setImageFiles(current => current.filter((_, i) => i !== index));
    setImagePreviews(current => current.filter((_, i) => i !== index));
  }

  async function save(e) {
    e.preventDefault();

    if (saving || imageBusy) return;

    if (!form.sku.trim() || !form.name.trim()) {
      toast.error('SKU and product name are required.');
      return;
    }

    if (
      data.products.some(
        p =>
          p.sku.toLowerCase() === form.sku.trim().toLowerCase() &&
          p.id !== editing?.id
      )
    ) {
      toast.error('That SKU already exists.');
      return;
    }

    setSaving(true);

    try {
      const savedProduct = await data.saveProduct({
        ...form,
        id: editing?.id,
        cost: Number(form.cost) || 0,
        price: Number(form.price) || 0,
        quantity: Number(form.quantity) || 0,
        reorderLevel: Number(form.reorderLevel) || 0,
        yearFrom: form.yearFrom || '',
        yearTo: form.yearTo || '',
      });

      if (!savedProduct?.id) {
        throw new Error('The product could not be saved.');
      }

      if (imageFiles.length) {
        setImageBusy(true);
        await data.uploadProductImages(savedProduct.id, imageFiles);
      }

      toast.success(
        editing ? 'Product updated successfully.' : 'Product created successfully.'
      );

      clearSelectedFiles();
      setModal(false);
    } catch (err) {
      toast.error(err.message || 'Could not save the product.');
    } finally {
      setSaving(false);
      setImageBusy(false);
    }
  }

  async function remove(p) {
    if (!window.confirm(`Delete ${p.name}? This cannot be undone.`)) {
      return;
    }

    try {
      await data.deleteProduct(p.id);
      toast.success('Product deleted.');
    } catch (err) {
      toast.error(err.message || 'Could not delete the product.');
    }
  }

  async function makePrimary(image) {
    try {
      await data.setPrimaryProductImage(image.id);
      toast.success('Primary image updated.');
    } catch (err) {
      toast.error(err.message || 'Could not update the primary image.');
    }
  }

  async function replaceImage(image, file) {
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Use JPG, PNG or WebP images.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be 5 MB or smaller.');
      return;
    }

    try {
      setImageBusy(true);
      await data.replaceProductImage(image.id, file);
      toast.success('Image replaced successfully.');
    } catch (err) {
      toast.error(err.message || 'Could not replace image.');
    } finally {
      setImageBusy(false);
    }
  }

  async function removeImage(image) {
    if (!window.confirm('Remove this product image?')) return;

    try {
      setImageBusy(true);
      await data.removeProductImage(image.id);
      toast.success('Image removed.');
    } catch (err) {
      toast.error(err.message || 'Could not remove image.');
    } finally {
      setImageBusy(false);
    }
  }

  function updateForm(field, value) {
    setForm(current => ({ ...current, [field]: value }));
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">PRODUCT CATALOGUE</p>
          <h1>Products</h1>
          <p className="muted">
            Manage all products, stock keeping units and optional vehicle fitment details.
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => openForm()}>
          <PlusIcon /> Add product
        </button>
      </div>

      <div className="panel list-panel">
        <div className="filter-toolbar">
          <div className="search-field">
            <MagnifyingGlassIcon />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, SKU, OEM, barcode or vehicle..."
            />
          </div>

          <select value={category} onChange={e => setCategory(e.target.value)}>
            <option>All categories</option>
            {data.categories.map(c => (
              <option key={c}>{c}</option>
            ))}
          </select>

          <select value={status} onChange={e => setStatus(e.target.value)}>
            <option>All stock</option>
            <option>In stock</option>
            <option>Low stock</option>
            <option>Out of stock</option>
          </select>

          <span className="result-count">{products.length} products</span>
        </div>

        <div className="table-wrap">
          <table className="products-table">
            <thead>
              <tr>
                <th>PRODUCT</th>
                <th>CATEGORY</th>
                <th>SKU / OEM</th>
                <th>STOCK</th>
                <th>SELL PRICE</th>
                <th>LOCATION</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {products.map(p => (
                <tr key={p.id}>
                  <td>
                    <div className="product-cell">
                      <div className="product-thumb">
                        {p.primaryImage ? (
                          <img
                            src={imageUrl(p.primaryImage)}
                            alt={p.name}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              borderRadius: 'inherit',
                            }}
                          />
                        ) : (
                          p.name.slice(0, 1)
                        )}
                      </div>

                      <div>
                        <Link to={`/parts/${p.id}`} className="product-link">
                          {p.name}
                        </Link>
                        <small>
                          {p.manufacturer || 'No manufacturer'}
                          {p.automotive ? ' · Automotive' : ''}
                        </small>
                      </div>
                    </div>
                  </td>

                  <td>{p.category || '—'}</td>

                  <td>
                    <strong>{p.sku}</strong>
                    <small className="cell-sub">
                      {p.oem || 'No OEM number'}
                    </small>
                  </td>

                  <td>
                    <span
                      className={`stock-pill ${
                        p.quantity === 0
                          ? 'out'
                          : p.quantity <= p.reorderLevel
                            ? 'low'
                            : 'healthy'
                      }`}
                    >
                      {p.quantity === 0
                        ? 'Out of stock'
                        : p.quantity <= p.reorderLevel
                          ? `${p.quantity} · Low`
                          : `${p.quantity} units`}
                    </span>
                  </td>

                  <td className="price-cell">{money(p.price)}</td>
                  <td>{p.location || '—'}</td>

                  <td>
                    <div className="row-actions">
                      <Link to={`/parts/${p.id}`} title="View">
                        <EyeIcon />
                      </Link>
                      <button title="Edit" onClick={() => openForm(p)}>
                        <PencilSquareIcon />
                      </button>
                      <button title="Delete" onClick={() => remove(p)}>
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!products.length && (
                <tr>
                  <td colSpan="7" className="empty-cell">
                    No products match your filters. Try another search or add a product.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="panel-foot">
          Showing {products.length} of {data.products.length} catalogue items
          <span>Stock quantities update through Stock control.</span>
        </div>
      </div>

      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={e => {
            if (e.target === e.currentTarget && !saving && !imageBusy) {
              setModal(false);
              clearSelectedFiles();
            }
          }}
        >
          <form className="modal-card product-modal" onSubmit={save}>
            <div className="modal-heading">
              <div>
                <p className="eyebrow">PRODUCT DETAILS</p>
                <h2>{editing ? 'Edit product' : 'Add a product'}</h2>
              </div>

              <button
                type="button"
                className="icon-button"
                onClick={() => {
                  setModal(false);
                  clearSelectedFiles();
                }}
                disabled={saving || imageBusy}
              >
                <XMarkIcon />
              </button>
            </div>

            <div className="form-grid">
              <Field label="Product name" required>
                <input
                  value={form.name}
                  onChange={e => updateForm('name', e.target.value)}
                  required
                  placeholder="e.g. Oil filter"
                />
              </Field>

              <Field label="SKU / Part number" required>
                <input
                  value={form.sku}
                  onChange={e => updateForm('sku', e.target.value)}
                  required
                  placeholder="e.g. FLT-001"
                />
              </Field>

              <Field label="Category">
                <select
                  value={form.category}
                  onChange={e => updateForm('category', e.target.value)}
                >
                  <option value="">Select category</option>
                  {data.categories.map(c => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>

              <Field label="Manufacturer / Brand">
                <input
                  list="manufacturers"
                  value={form.manufacturer}
                  onChange={e => updateForm('manufacturer', e.target.value)}
                  placeholder="Brand name"
                />
                <datalist id="manufacturers">
                  {data.manufacturers.map(m => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </Field>

              <Field label="Supplier">
                <input
                  list="suppliers"
                  value={form.supplier}
                  onChange={e => updateForm('supplier', e.target.value)}
                  placeholder="Supplier name"
                />
                <datalist id="suppliers">
                  {data.suppliers.map(m => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </Field>

              <Field label="Barcode">
                <input
                  value={form.barcode}
                  onChange={e => updateForm('barcode', e.target.value)}
                  placeholder="Barcode / EAN"
                />
              </Field>

              <Field label="Cost price (R)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.cost}
                  onChange={e => updateForm('cost', e.target.value)}
                />
              </Field>

              <Field label="Selling price (R)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={e => updateForm('price', e.target.value)}
                />
              </Field>

              <Field label="Opening quantity">
                <input
                  type="number"
                  min="0"
                  value={form.quantity}
                  onChange={e => updateForm('quantity', e.target.value)}
                />
              </Field>

              <Field label="Reorder level">
                <input
                  type="number"
                  min="0"
                  value={form.reorderLevel}
                  onChange={e => updateForm('reorderLevel', e.target.value)}
                />
              </Field>

              <Field label="Storage location">
                <input
                  value={form.location}
                  onChange={e => updateForm('location', e.target.value)}
                  placeholder="Aisle / rack / bin"
                />
              </Field>

              <Field label="Description" wide>
                <textarea
                  rows="2"
                  value={form.description}
                  onChange={e => updateForm('description', e.target.value)}
                />
              </Field>
            </div>

            <div className="form-section-title">PRODUCT IMAGES</div>

            <p className="muted">
              Add up to four images. JPG, PNG and WebP are supported, up to 5 MB each.
              The primary image is used in product listings.
            </p>

            {editing?.images?.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                  gap: '12px',
                  margin: '12px 0',
                }}
              >
                {editing.images.map(image => (
                  <div
                    key={image.id}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '8px',
                    }}
                  >
                    <img
                      src={imageUrl(image)}
                      alt="Product"
                      style={{
                        width: '100%',
                        height: '95px',
                        objectFit: 'cover',
                        borderRadius: '7px',
                      }}
                    />

                    {image.isPrimary && (
                      <small style={{ display: 'block', marginTop: '6px' }}>
                        <StarIcon
                          style={{
                            width: 13,
                            height: 13,
                            display: 'inline',
                            verticalAlign: 'middle',
                          }}
                        />{' '}
                        Primary
                      </small>
                    )}

                    <div style={{ display: 'grid', gap: '5px', marginTop: '8px' }}>
                      {!image.isPrimary && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={imageBusy}
                          onClick={() => makePrimary(image)}
                        >
                          Set primary
                        </button>
                      )}

                      <label className="btn btn-secondary" style={{ textAlign: 'center' }}>
                        Replace
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          hidden
                          disabled={imageBusy}
                          onChange={e => {
                            replaceImage(image, e.target.files?.[0]);
                            e.target.value = '';
                          }}
                        />
                      </label>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={imageBusy}
                        onClick={() => removeImage(image)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {imagePreviews.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                  gap: '12px',
                  margin: '12px 0',
                }}
              >
                {imagePreviews.map((preview, index) => (
                  <div key={preview} style={{ position: 'relative' }}>
                    <img
                      src={preview}
                      alt={`New product image ${index + 1}`}
                      style={{
                        width: '100%',
                        height: '110px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                      }}
                    />
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => removePendingImage(index)}
                      style={{
                        position: 'absolute',
                        top: '5px',
                        right: '5px',
                        background: '#fff',
                      }}
                      aria-label="Remove selected image"
                    >
                      <XMarkIcon />
                    </button>
                    <small className="muted">
                      {editing?.images?.length === 0 && index === 0
                        ? 'First image'
                        : `New image ${index + 1}`}
                    </small>
                  </div>
                ))}
              </div>
            )}

            {(editing?.images?.length || 0) + imageFiles.length < MAX_IMAGES && (
              <label
                className="btn btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  margin: '8px 0 16px',
                }}
              >
                <PhotoIcon style={{ width: 18, height: 18 }} />
                Add product images
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  hidden
                  onChange={handleImageSelection}
                  disabled={saving || imageBusy}
                />
              </label>
            )}

            <label className="check-line">
              <input
                type="checkbox"
                checked={form.automotive}
                onChange={e => updateForm('automotive', e.target.checked)}
              />
              Enable automotive fitment details
              <span>
                OEM numbers, vehicle compatibility and cooling system data
              </span>
            </label>

            {form.automotive && (
              <>
                <div className="form-section-title">AUTOMOTIVE FITMENT</div>

                <div className="form-grid">
                  <Field label="OEM / OE number">
                    <input
                      value={form.oem}
                      onChange={e => updateForm('oem', e.target.value)}
                    />
                  </Field>

                  <Field label="Vehicle make">
                    <input
                      value={form.make}
                      onChange={e => updateForm('make', e.target.value)}
                      placeholder="e.g. Volkswagen"
                    />
                  </Field>

                  <Field label="Vehicle model">
                    <input
                      value={form.model}
                      onChange={e => updateForm('model', e.target.value)}
                      placeholder="e.g. Polo Vivo"
                    />
                  </Field>

                  <Field label="Year from">
                    <input
                      type="number"
                      value={form.yearFrom}
                      onChange={e => updateForm('yearFrom', e.target.value)}
                    />
                  </Field>

                  <Field label="Year to">
                    <input
                      type="number"
                      value={form.yearTo}
                      onChange={e => updateForm('yearTo', e.target.value)}
                    />
                  </Field>

                  <Field label="Cooling type">
                    <select
                      value={form.coolingType}
                      onChange={e => updateForm('coolingType', e.target.value)}
                    >
                      <option value="">Not applicable</option>
                      <option>Air-cooled</option>
                      <option>Water-cooled</option>
                      <option>Oil-cooled</option>
                      <option>Hybrid cooling</option>
                    </select>
                  </Field>
                </div>
              </>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setModal(false);
                  clearSelectedFiles();
                }}
                disabled={saving || imageBusy}
              >
                Cancel
              </button>

              <button
                className="btn btn-primary"
                type="submit"
                disabled={saving || imageBusy}
              >
                {saving || imageBusy
                  ? 'Saving product...'
                  : editing
                    ? 'Save changes'
                    : 'Create product'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function Field({ label, required, wide, children }) {
  return (
    <label className={`field ${wide ? 'field-wide' : ''}`}>
      {label}
      {required && <em> *</em>}
      {children}
    </label>
  );
}
