
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  AdjustmentsHorizontalIcon,
  MagnifyingGlassIcon,
  ArrowsRightLeftIcon,
  PlusIcon,
  PhotoIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

import { useInventoryData } from '../../context/InventoryContext';
import { MovementTable } from '../Dashboard/Dashboard';

const emptyNewProduct = {
  sku: '',
  name: '',
  category: '',
  manufacturer: '',
  supplier: '',
  cost: '',
  price: '',
  reorderLevel: 5,
  description: '',
  barcode: '',
};

const MAX_PRODUCT_IMAGES = 4;

function productImageUrl(image) {
  return image?.imageUrl || image?.image_url || '';
}

const imagePlaceholderStyle = {
  width: '42px',
  height: '42px',
  minWidth: '42px',
  borderRadius: '8px',
  overflow: 'hidden',
  display: 'grid',
  placeItems: 'center',
  background: 'var(--bw-panel-hover)',
  color: 'var(--bw-gold-light)',
  border: '1px solid var(--bw-gold-dark)',
  fontWeight: 700,
};

const productImageStyle = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
};

const dropdownStyle = {
  position: 'absolute',
  zIndex: 30,
  top: '100%',
  left: 0,
  right: 0,
  maxHeight: '220px',
  overflowY: 'auto',
  background: 'var(--bw-panel)',
  border: '1px solid var(--bw-gold-dark)',
  borderRadius: '8px',
  boxShadow: '0 12px 28px rgba(0,0,0,0.45)',
};

const dropdownButtonStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  width: '100%',
  padding: '10px 12px',
  textAlign: 'left',
  border: 0,
  borderBottom: '1px solid rgba(212,175,55,0.15)',
  background: 'transparent',
  color: 'var(--bw-white)',
  cursor: 'pointer',
};

const dropdownImageStyle = {
  width: '36px',
  height: '36px',
  minWidth: '36px',
  borderRadius: '6px',
  overflow: 'hidden',
  display: 'grid',
  placeItems: 'center',
  background: 'var(--bw-panel-hover)',
  color: 'var(--bw-gold-light)',
  border: '1px solid rgba(212,175,55,0.3)',
  fontWeight: 700,
};

export default function Inventory() {
  const data = useInventoryData();
  const [params, setParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [type, setType] = useState('RECEIVE');
  const [productId, setProductId] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [showProductResults, setShowProductResults] = useState(false);
  const [createNewProduct, setCreateNewProduct] = useState(false);
  const [newProduct, setNewProduct] = useState(emptyNewProduct);

  const [newProductImages, setNewProductImages] = useState([]);
  const [newProductImagePreviews, setNewProductImagePreviews] = useState([]);

  const [quantity, setQuantity] = useState(1);
  const [sourceLocationId, setSourceLocationId] = useState('');
  const [destinationLocationId, setDestinationLocationId] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [tab, setTab] = useState('stock');
  const [filter, setFilter] = useState('All');

  const action = params.get('action');

  const activeLocations = (data.locations || []).filter(
    location => location.active !== false
  );

  const matchingProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();

    if (!term) return data.products.slice(0, 10);

    return data.products
      .filter(product =>
        [product.name, product.sku, product.barcode].some(value =>
          String(value || '').toLowerCase().includes(term)
        )
      )
      .slice(0, 10);
  }, [data.products, productSearch]);

  const selectedProduct = data.products.find(
    product => product.id === productId
  );

  function locationLabel(location) {
    if (!location) return 'Unknown location';

    if (location.description) return location.description;

    return [
      location.aisle,
      location.rack,
      location.shelf,
      location.bin,
    ]
      .filter(Boolean)
      .join(' / ') || 'Unnamed location';
  }

  function stockAtLocation(product, locationId) {
    return (
      product?.stockByLocation?.find(
        stock => stock.locationId === locationId
      )?.quantity || 0
    );
  }

  const sourceLocations = activeLocations.filter(location =>
    stockAtLocation(selectedProduct, location.id) > 0
  );

  const destinationLocations = activeLocations.filter(
    location => location.id !== sourceLocationId
  );

  function clearNewProductImages() {
    newProductImagePreviews.forEach(url => URL.revokeObjectURL(url));
    setNewProductImages([]);
    setNewProductImagePreviews([]);
  }

  function handleNewProductImages(event) {
    const selected = Array.from(event.target.files || []);
    event.target.value = '';

    if (!selected.length) return;

    const remaining = MAX_PRODUCT_IMAGES - newProductImages.length;

    if (selected.length > remaining) {
      toast.error(
        `You can add only ${Math.max(0, remaining)} more image(s).`
      );
      return;
    }

    const validFiles = selected.filter(file => {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
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

    setNewProductImages(current => [...current, ...validFiles]);
    setNewProductImagePreviews(current => [
      ...current,
      ...validFiles.map(file => URL.createObjectURL(file)),
    ]);
  }

  function removeNewProductImage(index) {
    const preview = newProductImagePreviews[index];

    if (preview) URL.revokeObjectURL(preview);

    setNewProductImages(current =>
      current.filter((_, i) => i !== index)
    );

    setNewProductImagePreviews(current =>
      current.filter((_, i) => i !== index)
    );
  }

  function selectProduct(product) {
    setProductId(product.id);
    setProductSearch(`${product.sku || ''} — ${product.name}`);
    setShowProductResults(false);
    setCreateNewProduct(false);
    setNewProduct(emptyNewProduct);
    clearNewProductImages();
  }

  function clearProductSelection() {
    setProductId('');
    setProductSearch('');
    setShowProductResults(true);
    setCreateNewProduct(false);
    setNewProduct(emptyNewProduct);
    clearNewProductImages();
  }

  function open(transactionType) {
    const firstProduct = data.products[0];
    const firstStockLocation = firstProduct?.stockByLocation?.find(
      stock => stock.quantity > 0
    );

    clearNewProductImages();

    setType(transactionType);
    setProductId(firstProduct?.id || '');
    setProductSearch(
      firstProduct
        ? `${firstProduct.sku || ''} — ${firstProduct.name}`
        : ''
    );
    setShowProductResults(false);
    setCreateNewProduct(false);
    setNewProduct(emptyNewProduct);
    setQuantity(1);
    setSourceLocationId(firstStockLocation?.locationId || '');
    setDestinationLocationId(
      activeLocations.find(
        location => location.id !== firstStockLocation?.locationId
      )?.id || ''
    );
    setReference('');
    setNote('');
    setModal(true);
  }

  useEffect(() => {
    if (action && !modal) {
      open(action === 'issue' ? 'ISSUE' : 'RECEIVE');
      setParams({});
    }
  }, [action]);

  useEffect(() => {
    if (!selectedProduct) return;

    const firstStockLocation = selectedProduct.stockByLocation?.find(
      stock => stock.quantity > 0
    );

    if (
      !selectedProduct.stockByLocation?.some(
        stock =>
          stock.locationId === sourceLocationId &&
          stock.quantity > 0
      )
    ) {
      setSourceLocationId(firstStockLocation?.locationId || '');
    }

    if (
      !activeLocations.some(
        location => location.id === destinationLocationId
      )
    ) {
      setDestinationLocationId(
        activeLocations.find(
          location => location.id !== sourceLocationId
        )?.id || ''
      );
    }
  }, [productId, data.locations]);

  useEffect(() => {
    return () => {
      newProductImagePreviews.forEach(url => URL.revokeObjectURL(url));
    };
  }, [newProductImagePreviews]);

  const items = data.products
    .filter(product =>
      [
        product.name,
        product.sku,
        product.location,
      ].some(value =>
        String(value || '').toLowerCase().includes(search.toLowerCase())
      )
    )
    .filter(product =>
      filter === 'All' ||
      (filter === 'Low stock' &&
        product.quantity > 0 &&
        product.quantity <= product.reorderLevel) ||
      (filter === 'Out of stock' && product.quantity === 0)
    );

  function updateNewProduct(field, value) {
    setNewProduct(current => ({
      ...current,
      [field]: value,
    }));
  }

  async function createProduct() {
    if (creatingProduct || saving) return;

    if (!newProduct.name.trim()) {
      toast.error('Enter the product name.');
      return;
    }

    if (!newProduct.sku.trim()) {
      toast.error('Enter a SKU or part number.');
      return;
    }

    if (!newProduct.category.trim()) {
      toast.error('Enter or select a product category.');
      return;
    }

    setCreatingProduct(true);

    try {
      const savedProduct = await data.saveProduct({
        sku: newProduct.sku.trim(),
        name: newProduct.name.trim(),
        category: newProduct.category.trim(),
        manufacturer: newProduct.manufacturer,
        supplier: newProduct.supplier,
        cost: Number(newProduct.cost) || 0,
        price: Number(newProduct.price) || 0,
        reorderLevel: Number(newProduct.reorderLevel) || 0,
        description: newProduct.description,
        barcode: newProduct.barcode,
        quantity: 0,
        location: '',
        automotive: false,
      });

      if (!savedProduct?.id) {
        throw new Error('The product was saved but its ID was not returned.');
      }

      if (newProductImages.length) {
        await data.uploadProductImages(
          savedProduct.id,
          newProductImages
        );
      }

      setProductId(savedProduct.id);
      setProductSearch(
        `${newProduct.sku.trim()} — ${newProduct.name.trim()}`
      );
      setCreateNewProduct(false);
      setShowProductResults(false);
      setNewProduct(emptyNewProduct);
      clearNewProductImages();

      toast.success(
        'Product created. You can now complete the stock receipt.'
      );
    } catch (err) {
      toast.error(err.message || 'Could not create the product.');
    } finally {
      setCreatingProduct(false);
    }
  }

  async function submit(e) {
    e.preventDefault();

    if (saving) return;

    if (createNewProduct) {
      toast.error('Save the new product before recording the receipt.');
      return;
    }

    if (!productId) {
      toast.error('Search for and select a product first.');
      return;
    }

    if (
      !quantity ||
      Number(quantity) < 0 ||
      (type !== 'ADJUST' && Number(quantity) < 1)
    ) {
      toast.error(
        type === 'ADJUST'
          ? 'Enter a valid target quantity.'
          : 'Quantity must be at least 1.'
      );
      return;
    }

    if (!sourceLocationId && type !== 'RECEIVE') {
      toast.error('Select a source storage location.');
      return;
    }

    if (!destinationLocationId && type !== 'ISSUE') {
      toast.error('Select a destination storage location.');
      return;
    }

    if (
      type === 'TRANSFER' &&
      sourceLocationId === destinationLocationId
    ) {
      toast.error('Source and destination must be different locations.');
      return;
    }

    if (
      (type === 'ISSUE' || type === 'TRANSFER') &&
      Number(quantity) > stockAtLocation(selectedProduct, sourceLocationId)
    ) {
      toast.error('The selected location does not have enough stock.');
      return;
    }

    setSaving(true);

    try {
      const result = await data.moveStock({
        productId,
        type,
        quantity: Number(quantity),
        reference,
        note,
        locationId:
          type === 'RECEIVE'
            ? destinationLocationId
            : sourceLocationId,
        sourceLocationId,
        destinationLocationId,
      });

      if (result?.unchanged) {
        toast.success('Stock is already at the requested quantity.');
      } else {
        toast.success(
          type === 'TRANSFER'
            ? 'Stock transferred successfully.'
            : type === 'RECEIVE'
              ? 'Stock received successfully.'
              : type === 'ISSUE'
                ? 'Stock issued successfully.'
                : 'Stock quantity adjusted successfully.'
        );
      }

      setModal(false);
    } catch (err) {
      toast.error(err.message || 'Could not record stock movement.');
    } finally {
      setSaving(false);
    }
  }

  const totalUnits = data.products.reduce(
    (sum, product) => sum + product.quantity,
    0
  );

  const totalValue = data.products.reduce(
    (sum, product) => sum + product.quantity * product.cost,
    0
  );

  const money = value =>
    new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      maximumFractionDigits: 0,
    }).format(value);

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">STOCK OPERATIONS</p>
          <h1>Stock control</h1>
          <p className="muted">
            Receive, issue, transfer and adjust stock across your storage locations.
          </p>
        </div>

        <div className="heading-actions">
          <button
            className="btn btn-secondary"
            onClick={() => open('ADJUST')}
          >
            <AdjustmentsHorizontalIcon />
            Adjust
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => open('TRANSFER')}
          >
            <ArrowsRightLeftIcon />
            Transfer
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => open('ISSUE')}
          >
            <ArrowUpTrayIcon />
            Issue stock
          </button>

          <button
            className="btn btn-primary"
            onClick={() => open('RECEIVE')}
          >
            <ArrowDownTrayIcon />
            Receive stock
          </button>
        </div>
      </div>

      <div className="stats-grid compact-stats">
        <Mini title="Units on hand" value={totalUnits} />
        <Mini title="Stock value" value={money(totalValue)} />
        <Mini
          title="Low stock items"
          value={data.products.filter(
            product =>
              product.quantity > 0 &&
              product.quantity <= product.reorderLevel
          ).length}
        />
        <Mini
          title="Out of stock"
          value={data.products.filter(
            product => product.quantity === 0
          ).length}
        />
      </div>

      <div className="panel list-panel">
        <div className="tabbar">
          <button
            className={tab === 'stock' ? 'selected' : ''}
            onClick={() => setTab('stock')}
          >
            Current stock
          </button>

          <button
            className={tab === 'movements' ? 'selected' : ''}
            onClick={() => setTab('movements')}
          >
            Movement history <span>{data.movements.length}</span>
          </button>
        </div>

        {tab === 'stock' ? (
          <>
            <div className="filter-toolbar">
              <div className="search-field">
                <MagnifyingGlassIcon />
                <input
                  placeholder="Search product, SKU or location..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>

              <select
                value={filter}
                onChange={e => setFilter(e.target.value)}
              >
                <option>All</option>
                <option>Low stock</option>
                <option>Out of stock</option>
              </select>

              <span className="result-count">
                {items.length} products
              </span>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>PRODUCT</th>
                    <th>SKU</th>
                    <th>LOCATION</th>
                    <th>ON HAND</th>
                    <th>REORDER AT</th>
                    <th>STATUS</th>
                    <th>STOCK VALUE</th>
                  </tr>
                </thead>

                <tbody>
                  {items.map(product => (
                    <tr key={product.id}>
                      <td>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                          }}
                        >
                          <div style={imagePlaceholderStyle}>
                            {product.primaryImage ? (
                              <img
                                src={productImageUrl(product.primaryImage)}
                                alt={product.name}
                                style={productImageStyle}
                              />
                            ) : (
                              product.name.slice(0, 1)
                            )}
                          </div>

                          <div>
                            <strong>{product.name}</strong>
                            <small className="cell-sub">
                              {product.category}
                            </small>
                          </div>
                        </div>
                      </td>

                      <td>{product.sku}</td>

                      <td>
                        {product.stockByLocation?.length
                          ? product.stockByLocation
                              .filter(stock => stock.quantity > 0)
                              .map(stock => {
                                const location = activeLocations.find(
                                  item => item.id === stock.locationId
                                );

                                return location
                                  ? locationLabel(location)
                                  : null;
                              })
                              .filter(Boolean)
                              .join(', ') || product.location || '—'
                          : product.location || '—'}
                      </td>

                      <td className="qty-cell">
                        {product.quantity}
                      </td>

                      <td>{product.reorderLevel}</td>

                      <td>
                        <span
                          className={`stock-pill ${
                            product.quantity === 0
                              ? 'out'
                              : product.quantity <= product.reorderLevel
                                ? 'low'
                                : 'healthy'
                          }`}
                        >
                          {product.quantity === 0
                            ? 'Out of stock'
                            : product.quantity <= product.reorderLevel
                              ? 'Low stock'
                              : 'Healthy'}
                        </span>
                      </td>

                      <td className="price-cell">
                        {money(product.quantity * product.cost)}
                      </td>
                    </tr>
                  ))}

                  {!items.length && (
                    <tr>
                      <td colSpan="7" className="empty-cell">
                        No matching stock records.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <MovementTable movements={data.movements} />
        )}

        <div className="panel-foot">
          Stock operations are saved to your business inventory.
          <span>{data.movements.length} recorded movements</span>
        </div>
      </div>

      {modal && (
        <div className="modal-backdrop">
          <form
            className="modal-card movement-modal"
            onSubmit={submit}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">INVENTORY TRANSACTION</p>
                <h2>
                  {type === 'RECEIVE'
                    ? 'Receive stock'
                    : type === 'ISSUE'
                      ? 'Issue stock'
                      : type === 'TRANSFER'
                        ? 'Transfer stock'
                        : 'Set stock quantity'}
                </h2>
              </div>

              <button
                type="button"
                className="icon-button"
                onClick={() => {
                  setModal(false);
                  clearNewProductImages();
                }}
                disabled={saving || creatingProduct}
              >
                ×
              </button>
            </div>

            <div className="movement-switch">
              <button
                type="button"
                className={type === 'RECEIVE' ? 'active receive' : ''}
                onClick={() => {
                  setType('RECEIVE');
                  setCreateNewProduct(false);
                  clearNewProductImages();
                }}
              >
                Receive
              </button>

              <button
                type="button"
                className={type === 'ISSUE' ? 'active issue' : ''}
                onClick={() => {
                  setType('ISSUE');
                  setCreateNewProduct(false);
                  clearNewProductImages();
                }}
              >
                Issue
              </button>

              <button
                type="button"
                className={type === 'TRANSFER' ? 'active transfer' : ''}
                onClick={() => {
                  setType('TRANSFER');
                  setCreateNewProduct(false);
                  clearNewProductImages();
                }}
              >
                Transfer
              </button>

              <button
                type="button"
                className={type === 'ADJUST' ? 'active adjust' : ''}
                onClick={() => {
                  setType('ADJUST');
                  setCreateNewProduct(false);
                  clearNewProductImages();
                }}
              >
                Adjust
              </button>
            </div>

            <div className="field">
              <label htmlFor="stock-product-search">Product</label>

              <div style={{ position: 'relative' }}>
                <input
                  id="stock-product-search"
                  type="text"
                  value={productSearch}
                  placeholder="Type product name, SKU or barcode..."
                  autoComplete="off"
                  onFocus={() => {
                    if (!productId) setShowProductResults(true);
                  }}
                  onChange={e => {
                    setProductSearch(e.target.value);
                    setProductId('');
                    setCreateNewProduct(false);
                    clearNewProductImages();
                    setShowProductResults(true);
                  }}
                  disabled={saving || creatingProduct}
                  required={!createNewProduct}
                />

                {productId && (
                  <button
                    type="button"
                    onClick={clearProductSelection}
                    disabled={saving || creatingProduct}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      border: '1px solid var(--bw-gold-dark)',
                      borderRadius: '5px',
                      padding: '5px 9px',
                      background: 'var(--bw-panel-hover)',
                      color: 'var(--bw-gold-light)',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    Change
                  </button>
                )}

                {showProductResults && !productId && !createNewProduct && (
                  <div style={dropdownStyle}>
                    {matchingProducts.map(product => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => selectProduct(product)}
                        style={dropdownButtonStyle}
                        onMouseEnter={e => {
                          e.currentTarget.style.background =
                            'var(--bw-panel-hover)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <span style={dropdownImageStyle}>
                          {product.primaryImage ? (
                            <img
                              src={productImageUrl(product.primaryImage)}
                              alt=""
                              style={productImageStyle}
                            />
                          ) : (
                            product.name.slice(0, 1)
                          )}
                        </span>

                        <span>
                          <strong>{product.name}</strong>
                          <small
                            style={{
                              display: 'block',
                              color: 'var(--bw-muted)',
                              marginTop: '3px',
                            }}
                          >
                            {product.sku || 'No SKU'} · {product.quantity} units on hand
                          </small>
                        </span>
                      </button>
                    ))}

                    {matchingProducts.length === 0 && (
                      <p
                        style={{
                          padding: '12px',
                          margin: 0,
                          color: 'var(--bw-muted)',
                        }}
                      >
                        No matching products found.
                      </p>
                    )}

                    {type === 'RECEIVE' && productSearch.trim() && (
                      <button
                        type="button"
                        onClick={() => {
                          clearNewProductImages();
                          setCreateNewProduct(true);
                          setShowProductResults(false);
                          setProductId('');
                          setNewProduct(current => ({
                            ...current,
                            name: productSearch.trim(),
                          }));
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          width: '100%',
                          padding: '12px',
                          textAlign: 'left',
                          border: 0,
                          borderTop: '1px solid var(--bw-gold-dark)',
                          background: 'var(--bw-panel-hover)',
                          color: 'var(--bw-gold-light)',
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        <PlusIcon style={{ width: 18, height: 18 }} />
                        Create new product: “{productSearch.trim()}”
                      </button>
                    )}
                  </div>
                )}
              </div>

              {type === 'RECEIVE' && !productId && !createNewProduct && (
                <p className="muted" style={{ marginTop: '6px' }}>
                  Search for an existing product, or type a new name and select Create new product.
                </p>
              )}
            </div>

            {createNewProduct && (
              <div
                style={{
                  padding: '16px',
                  margin: '12px 0',
                  border: '1px solid var(--bw-gold-dark)',
                  borderRadius: '10px',
                  background: 'var(--bw-panel)',
                  boxShadow: 'inset 0 0 0 1px rgba(212,175,55,0.06)',
                }}
              >
                <div style={{ marginBottom: '14px' }}>
                  <p className="eyebrow">NEW CATALOGUE ITEM</p>
                  <h3
                    style={{
                      margin: '4px 0',
                      color: 'var(--bw-gold-light)',
                    }}
                  >
                    Create product
                  </h3>
                  <p className="muted">
                    Add the product details and images first. You will then complete the stock receipt.
                  </p>
                </div>

                <label className="field">
                  Product name
                  <input
                    value={newProduct.name}
                    onChange={e => updateNewProduct('name', e.target.value)}
                    required
                    autoFocus
                  />
                </label>

                <label className="field">
                  SKU / Part number
                  <input
                    value={newProduct.sku}
                    onChange={e => updateNewProduct('sku', e.target.value)}
                    placeholder="Enter a unique part number"
                    required
                  />
                </label>

                <label className="field">
                  Category
                  <input
                    type="text"
                    list="stock-product-categories"
                    value={newProduct.category}
                    onChange={e => updateNewProduct('category', e.target.value)}
                    placeholder="Type or select a category, e.g. Electrical"
                    autoComplete="off"
                    required
                  />

                  <datalist id="stock-product-categories">
                    {data.categories.map(category => (
                      <option key={category} value={category} />
                    ))}
                  </datalist>

                  <small
                    className="muted"
                    style={{ display: 'block', marginTop: '5px' }}
                  >
                    Select an existing category or type a new one. New categories are saved when you create the product.
                  </small>
                </label>

                <label className="field">
                  Manufacturer
                  <input
                    value={newProduct.manufacturer}
                    onChange={e => updateNewProduct('manufacturer', e.target.value)}
                    placeholder="Optional"
                  />
                </label>

                <label className="field">
                  Supplier
                  <input
                    value={newProduct.supplier}
                    onChange={e => updateNewProduct('supplier', e.target.value)}
                    placeholder="Optional"
                  />
                </label>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: '12px',
                  }}
                >
                  <label className="field">
                    Buying price (R)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newProduct.cost}
                      onChange={e => updateNewProduct('cost', e.target.value)}
                    />
                  </label>

                  <label className="field">
                    Selling price (R)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newProduct.price}
                      onChange={e => updateNewProduct('price', e.target.value)}
                    />
                  </label>
                </div>

                <label className="field">
                  Reorder level
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={newProduct.reorderLevel}
                    onChange={e => updateNewProduct('reorderLevel', e.target.value)}
                  />
                </label>

                <label className="field">
                  Barcode
                  <input
                    value={newProduct.barcode}
                    onChange={e => updateNewProduct('barcode', e.target.value)}
                    placeholder="Optional"
                  />
                </label>

                <label className="field">
                  Description / notes
                  <textarea
                    rows="2"
                    value={newProduct.description}
                    onChange={e => updateNewProduct('description', e.target.value)}
                    placeholder="Optional product details"
                  />
                </label>

                <div
                  className="form-section-title"
                  style={{
                    color: 'var(--bw-gold-light)',
                    borderBottom: '1px solid rgba(212,175,55,0.25)',
                    paddingBottom: '8px',
                  }}
                >
                  PRODUCT IMAGES
                </div>

                <p className="muted">
                  Add up to four images. JPG, PNG or WebP, maximum 5 MB each.
                </p>

                {newProductImagePreviews.length > 0 && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(85px, 1fr))',
                      gap: '10px',
                      margin: '12px 0',
                    }}
                  >
                    {newProductImagePreviews.map((preview, index) => (
                      <div key={preview} style={{ position: 'relative' }}>
                        <img
                          src={preview}
                          alt={`New product image ${index + 1}`}
                          style={{
                            width: '100%',
                            height: '85px',
                            objectFit: 'cover',
                            borderRadius: '8px',
                            border: '1px solid var(--bw-gold-dark)',
                          }}
                        />

                        <button
                          type="button"
                          onClick={() => removeNewProductImage(index)}
                          aria-label="Remove selected image"
                          style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            border: '1px solid var(--bw-gold-dark)',
                            borderRadius: '50%',
                            width: '26px',
                            height: '26px',
                            display: 'grid',
                            placeItems: 'center',
                            padding: 0,
                            background: 'var(--bw-charcoal)',
                            color: 'var(--bw-gold-light)',
                            cursor: 'pointer',
                          }}
                        >
                          <XMarkIcon style={{ width: 15, height: 15 }} />
                        </button>

                        {index === 0 && (
                          <small className="muted">First image</small>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {newProductImages.length < MAX_PRODUCT_IMAGES && (
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
                      onChange={handleNewProductImages}
                      disabled={creatingProduct}
                    />
                  </label>
                )}

                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setCreateNewProduct(false);
                      setNewProduct(emptyNewProduct);
                      clearNewProductImages();
                      setProductSearch('');
                      setShowProductResults(true);
                    }}
                    disabled={creatingProduct}
                  >
                    Back to search
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={createProduct}
                    disabled={
                      creatingProduct ||
                      !newProduct.name.trim() ||
                      !newProduct.sku.trim() ||
                      !newProduct.category.trim()
                    }
                  >
                    {creatingProduct ? 'Creating product...' : 'Save product'}
                  </button>
                </div>
              </div>
            )}

            {selectedProduct && !createNewProduct && (
              <div className="current-stock">
                Total quantity across locations
                <strong>
                  {selectedProduct.quantity} units
                </strong>
              </div>
            )}

            {(type === 'ISSUE' ||
              type === 'ADJUST' ||
              type === 'TRANSFER') && (
              <>
                <label className="field">
                  {type === 'TRANSFER'
                    ? 'Source location'
                    : 'Storage location'}

                  <select
                    value={sourceLocationId}
                    onChange={e => setSourceLocationId(e.target.value)}
                    required
                  >
                    <option value="">Select source location</option>

                    {sourceLocations.map(location => (
                      <option key={location.id} value={location.id}>
                        {locationLabel(location)} —{' '}
                        {stockAtLocation(selectedProduct, location.id)} units
                      </option>
                    ))}

                    {type === 'ADJUST' &&
                      activeLocations
                        .filter(
                          location =>
                            !sourceLocations.some(
                              item => item.id === location.id
                            )
                        )
                        .map(location => (
                          <option key={location.id} value={location.id}>
                            {locationLabel(location)} — 0 units
                          </option>
                        ))}
                  </select>
                </label>

                {sourceLocationId && (
                  <div className="current-stock">
                    Quantity at source
                    <strong>
                      {stockAtLocation(selectedProduct, sourceLocationId)} units
                    </strong>
                  </div>
                )}
              </>
            )}

            {(type === 'RECEIVE' || type === 'TRANSFER') && (
              <label className="field">
                {type === 'TRANSFER'
                  ? 'Destination location'
                  : 'Receive into location'}

                <select
                  value={destinationLocationId}
                  onChange={e => setDestinationLocationId(e.target.value)}
                  required
                >
                  <option value="">Select destination location</option>

                  {destinationLocations.map(location => (
                    <option key={location.id} value={location.id}>
                      {locationLabel(location)}
                      {type === 'TRANSFER'
                        ? ` — ${stockAtLocation(selectedProduct, location.id)} units`
                        : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {!createNewProduct && (
              <>
                <label className="field">
                  {type === 'ADJUST'
                    ? 'New quantity at this location'
                    : 'Quantity'}

                  <input
                    type="number"
                    min={type === 'ADJUST' ? '0' : '1'}
                    step="1"
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                    required
                  />
                </label>

                <label className="field">
                  Reference number

                  <input
                    value={reference}
                    onChange={e => setReference(e.target.value)}
                    placeholder="e.g. PO-1048 or invoice number"
                  />
                </label>

                <label className="field">
                  Notes

                  <textarea
                    rows="2"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Optional reason or details"
                  />
                </label>
              </>
            )}

            {activeLocations.length === 0 && (
              <p className="muted">
                No active storage locations are available. Create warehouse
                locations before recording stock movements.
              </p>
            )}

            {!createNewProduct && (
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setModal(false);
                    clearNewProductImages();
                  }}
                  disabled={saving || creatingProduct}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={
                    saving ||
                    creatingProduct ||
                    !productId ||
                    !activeLocations.length
                  }
                >
                  {saving ? 'Saving...' : 'Save movement'}
                </button>
              </div>
            )}
          </form>
        </div>
      )}
    </>
  );
}

function Mini({ title, value }) {
  return (
    <div className="stat-card mini-stat">
      <div className="stat-label">{title}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
