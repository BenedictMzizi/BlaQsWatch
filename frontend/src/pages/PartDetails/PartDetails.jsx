
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  PhotoIcon,
  StarIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { useInventoryData } from '../../context/InventoryContext';
import { useEffect, useState } from 'react';

const MAX_IMAGES = 4;

function imageUrl(image) {
  return image?.imageUrl || image?.image_url || '';
}

export default function PartDetails() {
  const { id } = useParams();
  const nav = useNavigate();
  const data = useInventoryData();

  const p = data.products.find(x => x.id === id);

  const [qty, setQty] = useState(1);
  const [mode, setMode] = useState('RECEIVE');
  const [selectedImageId, setSelectedImageId] = useState(null);
  const [imageBusy, setImageBusy] = useState(false);

  const images = p?.images || [];

  const selectedImage =
    images.find(image => image.id === selectedImageId) ||
    p?.primaryImage ||
    images[0] ||
    null;

  useEffect(() => {
    if (p && !images.some(image => image.id === selectedImageId)) {
      setSelectedImageId(p.primaryImage?.id || images[0]?.id || null);
    }
  }, [p, images, selectedImageId]);

  if (!p) {
    return (
      <div className="panel">
        <h2>Product not found</h2>
        <Link to="/parts" className="text-link">
          Back to products
        </Link>
      </div>
    );
  }

  const movements = data.movements.filter(m => m.productId === id);

  async function move() {
    if (!qty || Number(qty) < 1) {
      toast.error('Enter a quantity of at least 1.');
      return;
    }

    try {
      await data.moveStock({
        productId: id,
        type: mode,
        quantity: Number(qty),
        note: 'Recorded from product details',
      });

      toast.success('Stock updated.');
      setQty(1);
    } catch (e) {
      toast.error(e.message || 'Could not update stock.');
    }
  }

  async function uploadImages(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';

    if (!files.length) return;

    const remaining = MAX_IMAGES - images.length;

    if (files.length > remaining) {
      toast.error(`You can add only ${Math.max(0, remaining)} more image(s).`);
      return;
    }

    try {
      setImageBusy(true);
      await data.uploadProductImages(id, files);
      toast.success('Product images uploaded.');
    } catch (err) {
      toast.error(err.message || 'Could not upload product images.');
    } finally {
      setImageBusy(false);
    }
  }

  async function setPrimary(image) {
    try {
      setImageBusy(true);
      await data.setPrimaryProductImage(image.id);
      setSelectedImageId(image.id);
      toast.success('Primary image updated.');
    } catch (err) {
      toast.error(err.message || 'Could not update primary image.');
    } finally {
      setImageBusy(false);
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
      setSelectedImageId(image.id);
      toast.success('Image replaced.');
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

      if (selectedImageId === image.id) {
        setSelectedImageId(null);
      }

      toast.success('Image removed.');
    } catch (err) {
      toast.error(err.message || 'Could not remove image.');
    } finally {
      setImageBusy(false);
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <Link to="/parts" className="back-link">
            <ArrowLeftIcon /> Back to products
          </Link>

          <p className="eyebrow">PRODUCT RECORD</p>
          <h1>{p.name}</h1>
          <p className="muted">
            {p.sku} · {p.category}
          </p>
        </div>

        <div className="heading-actions">
          <Link to="/parts" className="btn btn-secondary">
            Catalogue
          </Link>
        </div>
      </div>

      <div className="detail-grid">
        <section className="panel detail-main">
          <div className="detail-title">
            <div
              className="large-product-icon"
              style={{
                overflow: 'hidden',
                padding: 0,
                background: '#f1f5f9',
              }}
            >
              {selectedImage ? (
                <img
                  src={imageUrl(selectedImage)}
                  alt={p.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                p.name.slice(0, 1)
              )}
            </div>

            <div>
              <h2>{p.name}</h2>
              <p>{p.description || 'No description provided.'}</p>
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
                    ? 'Low stock'
                    : 'In stock'}
              </span>
            </div>
          </div>

          <h3 className="section-heading">Product images</h3>

          <div style={{ marginBottom: '20px' }}>
            {selectedImage ? (
              <img
                src={imageUrl(selectedImage)}
                alt={p.name}
                style={{
                  display: 'block',
                  width: '100%',
                  maxHeight: '420px',
                  objectFit: 'contain',
                  background: '#f8fafc',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                }}
              />
            ) : (
              <div
                style={{
                  minHeight: '180px',
                  display: 'grid',
                  placeItems: 'center',
                  background: '#f8fafc',
                  border: '1px dashed #cbd5e1',
                  borderRadius: '10px',
                  color: '#64748b',
                  gap: '8px',
                }}
              >
                <PhotoIcon style={{ width: 38, height: 38 }} />
                <span>No product images have been added.</span>
              </div>
            )}

            {images.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(95px, 1fr))',
                  gap: '10px',
                  marginTop: '12px',
                }}
              >
                {images.map(image => (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => setSelectedImageId(image.id)}
                    style={{
                      padding: '4px',
                      border:
                        selectedImage?.id === image.id
                          ? '2px solid #2563eb'
                          : '1px solid #e2e8f0',
                      borderRadius: '9px',
                      background: '#fff',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <img
                      src={imageUrl(image)}
                      alt={`${p.name} thumbnail`}
                      style={{
                        width: '100%',
                        height: '75px',
                        objectFit: 'cover',
                        borderRadius: '6px',
                      }}
                    />

                    <small
                      style={{
                        display: 'block',
                        padding: '4px 2px',
                        color: image.isPrimary ? '#b45309' : '#64748b',
                      }}
                    >
                      {image.isPrimary ? '★ Primary' : 'View image'}
                    </small>
                  </button>
                ))}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                marginTop: '12px',
              }}
            >
              {images.length < MAX_IMAGES && (
                <label
                  className="btn btn-secondary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    cursor: 'pointer',
                  }}
                >
                  <PhotoIcon style={{ width: 18, height: 18 }} />
                  Add images
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    hidden
                    disabled={imageBusy}
                    onChange={uploadImages}
                  />
                </label>
              )}

              {selectedImage && (
                <>
                  {!selectedImage.isPrimary && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={imageBusy}
                      onClick={() => setPrimary(selectedImage)}
                    >
                      <StarIcon style={{ width: 17, height: 17 }} />
                      Set as primary
                    </button>
                  )}

                  <label
                    className="btn btn-secondary"
                    style={{ cursor: 'pointer' }}
                  >
                    Replace selected
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      hidden
                      disabled={imageBusy}
                      onChange={e => {
                        replaceImage(selectedImage, e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                  </label>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={imageBusy}
                    onClick={() => removeImage(selectedImage)}
                  >
                    <TrashIcon style={{ width: 17, height: 17 }} />
                    Remove selected
                  </button>
                </>
              )}
            </div>

            <small className="muted" style={{ display: 'block', marginTop: '8px' }}>
              {images.length} of {MAX_IMAGES} images · JPG, PNG or WebP · Maximum 5 MB each
            </small>

            {imageBusy && (
              <p className="muted">Updating product images...</p>
            )}
          </div>

          <div className="detail-stats">
            <div>
              <small>Quantity on hand</small>
              <strong>{p.quantity}</strong>
            </div>
            <div>
              <small>Cost price</small>
              <strong>R {Number(p.cost).toFixed(2)}</strong>
            </div>
            <div>
              <small>Selling price</small>
              <strong>R {Number(p.price).toFixed(2)}</strong>
            </div>
            <div>
              <small>Stock value</small>
              <strong>R {(p.quantity * p.cost).toFixed(2)}</strong>
            </div>
          </div>

          <h3 className="section-heading">Product information</h3>

          <div className="detail-fields">
            <Detail label="SKU / Part number" value={p.sku} />
            <Detail label="Category" value={p.category} />
            <Detail label="Manufacturer" value={p.manufacturer} />
            <Detail label="Supplier" value={p.supplier} />
            <Detail label="Barcode" value={p.barcode} />
            <Detail label="Storage location" value={p.location} />
            <Detail label="Reorder level" value={`${p.reorderLevel} units`} />
          </div>

          {p.automotive && (
            <>
              <h3 className="section-heading">Automotive fitment</h3>

              <div className="detail-fields">
                <Detail label="OEM / OE number" value={p.oem} />
                <Detail label="Vehicle make" value={p.make} />
                <Detail label="Vehicle model" value={p.model} />
                <Detail
                  label="Year range"
                  value={
                    p.yearFrom && p.yearTo
                      ? `${p.yearFrom} – ${p.yearTo}`
                      : 'Not specified'
                  }
                />
                <Detail label="Cooling type" value={p.coolingType} />
              </div>
            </>
          )}
        </section>

        <aside className="panel stock-action-panel">
          <h2>Stock action</h2>
          <p className="muted">Record a movement for this product.</p>

          <div className="movement-switch">
            <button
              type="button"
              className={mode === 'RECEIVE' ? 'active receive' : ''}
              onClick={() => setMode('RECEIVE')}
            >
              Receive
            </button>

            <button
              type="button"
              className={mode === 'ISSUE' ? 'active issue' : ''}
              onClick={() => setMode('ISSUE')}
            >
              Issue
            </button>
          </div>

          <label className="field">
            Quantity
            <input
              type="number"
              min="1"
              value={qty}
              onChange={e => setQty(Number(e.target.value))}
            />
          </label>

          <button className="btn btn-primary full" onClick={move}>
            {mode === 'RECEIVE' ? (
              <ArrowDownTrayIcon />
            ) : (
              <ArrowUpTrayIcon />
            )}
            Confirm {mode.toLowerCase()}
          </button>

          <div className="action-divider" />

          <Link to="/stock-control" className="text-link">
            Open stock control →
          </Link>
        </aside>
      </div>

      <section className="panel detail-history">
        <div className="panel-heading">
          <div>
            <h2>Product movement history</h2>
            <p>All recorded activity for this product</p>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>TYPE</th>
                <th>QUANTITY</th>
                <th>REFERENCE</th>
                <th>NOTES</th>
                <th>DATE</th>
              </tr>
            </thead>

            <tbody>
              {movements.map(m => (
                <tr key={m.id}>
                  <td>
                    <span className={`movement-type ${m.type.toLowerCase()}`}>
                      {m.type}
                    </span>
                  </td>
                  <td>{m.quantity}</td>
                  <td>{m.reference || '—'}</td>
                  <td>{m.note || '—'}</td>
                  <td>{new Date(m.createdAt).toLocaleString('en-ZA')}</td>
                </tr>
              ))}

              {!movements.length && (
                <tr>
                  <td colSpan="5" className="empty-cell">
                    No movements for this product yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <small>{label}</small>
      <strong>{value || '—'}</strong>
    </div>
  );
}
