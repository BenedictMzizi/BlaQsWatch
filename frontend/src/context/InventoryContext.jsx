
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { supabase } from '../lib/supabase';

const InventoryContext = createContext(null);

const IMAGE_BUCKET = 'product-images';
const MAX_PRODUCT_IMAGES = 4;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

const SUPPORTED_CURRENCIES = ['ZAR', 'USD', 'GBP', 'EUR'];

const emptyData = {
  products: [],
  categories: [],
  manufacturers: [],
  suppliers: [],
  vehicles: [],
  movements: [],
  locations: [],
  settings: {
    businessName: '',
    currency: 'ZAR',
    lowStockDefault: 5,
  },
};

const makeIdempotencyKey = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `stock-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const makeFileId = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const normalise = value =>
  String(value || '').trim().toLowerCase();

const locationLabel = location => {
  if (!location) return '';

  const parts = [
    location.aisle,
    location.rack,
    location.shelf,
    location.bin,
  ].filter(Boolean);

  return parts.join(' / ') || location.description || '';
};

function unwrap(result) {
  if (result.error) throw result.error;
  return result.data;
}

function safeData(result, label) {
  if (result.error) {
    console.warn(`${label} could not be loaded:`, result.error);
    return [];
  }

  return result.data || [];
}

function getImageExtension(file) {
  const extensions = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };

  return extensions[file.type] || null;
}

function getStoragePathFromUrl(url) {
  if (!url) return null;

  const marker = `/storage/v1/object/public/${IMAGE_BUCKET}/`;
  const markerIndex = url.indexOf(marker);

  if (markerIndex === -1) return null;

  return decodeURIComponent(
    url.slice(markerIndex + marker.length).split('?')[0]
  );
}

function getPublicImageUrl(path) {
  const { data } = supabase.storage
    .from(IMAGE_BUCKET)
    .getPublicUrl(path);

  return data?.publicUrl || '';
}

function mapProductImage(image) {
  return {
    id: image.id,
    partId: image.part_id,
    url: image.image_url,
    imageUrl: image.image_url,
    isPrimary: Boolean(image.is_primary),
    createdAt: image.created_at,
  };
}

function mapMovement(movement, products, locations) {
  const product = products.find(
    item => item.id === movement.part_id
  );

  const source = locations.find(
    location => location.id === movement.source_location_id
  );

  const destination = locations.find(
    location => location.id === movement.destination_location_id
  );

  const movementTypes = {
    received: 'RECEIVE',
    sold: 'ISSUE',
    returned: 'RECEIVE',
    adjustment: 'ADJUST',
    transfer: 'TRANSFER',
    damaged: 'ISSUE',
    customer_return: 'RECEIVE',
    supplier_return: 'ISSUE',
  };

  return {
    id: movement.id,
    productId: movement.part_id,
    sku: product?.sku || '',
    productName: product?.name || 'Unknown product',
    type:
      movementTypes[movement.movement_type] ||
      movement.movement_type,
    quantity: movement.quantity,
    reference: movement.reference || '',
    note: movement.reason || '',
    createdAt: movement.created_at,
    sourceLocation: source ? locationLabel(source) : '',
    destinationLocation: destination
      ? locationLabel(destination)
      : '',
    location: destination
      ? locationLabel(destination)
      : source
        ? locationLabel(source)
        : '',
  };
}

export function InventoryProvider({ children, businessId }) {
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ---------------------------------------------------------
  // LOAD INVENTORY AND BUSINESS SETTINGS
  // ---------------------------------------------------------

  const refresh = useCallback(async () => {
    if (!businessId) {
      setData(emptyData);
      setLoading(false);
      setError('');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const [
        partsResult,
        categoriesResult,
        manufacturersResult,
        suppliersResult,
        vehiclesResult,
        locationsResult,
        summaryResult,
        inventoryResult,
        movementsResult,
        oemResult,
        compatibilityResult,
        businessResult,
        settingsResult,
      ] = await Promise.all([
        supabase
          .from('parts')
          .select('*')
          .eq('business_id', businessId)
          .order('created_at', { ascending: false }),

        supabase
          .from('categories')
          .select('id,name,description')
          .order('name'),

        supabase
          .from('manufacturers')
          .select('id,name')
          .order('name'),

        supabase
          .from('suppliers')
          .select(
            'id,company_name,contact_person,phone,email,address,notes'
          )
          .eq('business_id', businessId)
          .order('company_name'),

        supabase
          .from('vehicles')
          .select(
            'id,make,model,variant,engine,engine_code,fuel_type,year_from,year_to'
          )
          .order('make'),

        supabase
          .from('locations')
          .select(
            'id,aisle,rack,shelf,bin,description,warehouse_id,aisle_id,rack_id,shelf_id,active'
          )
          .eq('business_id', businessId)
          .eq('active', true),

        supabase
          .from('stockwise_inventory_summary')
          .select('*')
          .eq('business_id', businessId),

        supabase
          .from('inventory')
          .select(
            'id,part_id,location_id,quantity,minimum_stock'
          )
          .eq('business_id', businessId),

        supabase
          .from('stock_movements')
          .select(
            'id,part_id,movement_type,quantity,reference,reason,created_at,source_location_id,destination_location_id'
          )
          .eq('business_id', businessId)
          .order('created_at', { ascending: false })
          .limit(100),

        supabase
          .from('part_oem_numbers')
          .select('id,part_id,manufacturer,oem_number'),

        supabase
          .from('part_vehicle_compatibility')
          .select('id,part_id,vehicle_id,notes'),

        supabase
          .from('businesses')
          .select('id,name')
          .eq('id', businessId)
          .maybeSingle(),

        supabase
          .from('business_settings')
          .select('business_id,currency,low_stock_default')
          .eq('business_id', businessId)
          .maybeSingle(),
      ]);

      const parts = unwrap(partsResult) || [];

      const categories = safeData(categoriesResult, 'Categories');
      const manufacturers = safeData(manufacturersResult, 'Manufacturers');
      const suppliers = safeData(suppliersResult, 'Suppliers');
      const vehicles = safeData(vehiclesResult, 'Vehicles');
      const locations = safeData(locationsResult, 'Locations');
      const summaries = safeData(summaryResult, 'Inventory summary');
      const inventory = safeData(inventoryResult, 'Inventory');
      const movements = safeData(movementsResult, 'Stock movements');
      const oemNumbers = safeData(oemResult, 'OEM numbers');

      const compatibility = safeData(
        compatibilityResult,
        'Vehicle compatibility'
      );

      // Business identity and settings are required for the
      // Settings page, so do not silently ignore their errors.
      if (businessResult.error) {
        throw businessResult.error;
      }

      if (settingsResult.error) {
        throw settingsResult.error;
      }

      const business = businessResult.data;
      const savedSettings = settingsResult.data;

      // Load product images separately.
      // Access is enforced by the existing Supabase RLS policies.
      let productImages = [];

      if (parts.length) {
        const imageResult = await supabase
          .from('part_images')
          .select('id,part_id,image_url,is_primary,created_at')
          .in('part_id', parts.map(part => part.id))
          .order('created_at', { ascending: true });

        productImages = safeData(imageResult, 'Product images');
      }

      const imagesByPart = new Map();

      productImages.forEach(image => {
        const current = imagesByPart.get(image.part_id) || [];

        current.push(mapProductImage(image));

        imagesByPart.set(image.part_id, current);
      });

      const categoryMap = new Map(
        categories.map(item => [item.id, item])
      );

      const manufacturerMap = new Map(
        manufacturers.map(item => [item.id, item])
      );

      const supplierMap = new Map(
        suppliers.map(item => [item.id, item])
      );

      const vehicleMap = new Map(
        vehicles.map(item => [item.id, item])
      );

      const summaryMap = new Map(
        summaries.map(item => [item.part_id, item])
      );

      const productInventory = new Map();

      inventory.forEach(row => {
        const current = productInventory.get(row.part_id) || [];

        current.push(row);

        productInventory.set(row.part_id, current);
      });

      const productOEM = new Map();

      oemNumbers.forEach(row => {
        const current = productOEM.get(row.part_id) || [];

        current.push(row);

        productOEM.set(row.part_id, current);
      });

      const productCompatibility = new Map();

      compatibility.forEach(row => {
        const current = productCompatibility.get(row.part_id) || [];

        current.push(row);

        productCompatibility.set(row.part_id, current);
      });

      const products = parts.map(part => {
        const summary = summaryMap.get(part.id);
        const stockRows = productInventory.get(part.id) || [];
        const firstStockRow = stockRows[0];

        const firstLocation = locations.find(
          location => location.id === firstStockRow?.location_id
        );

        const fitment = (productCompatibility.get(part.id) || [])
          .map(item => vehicleMap.get(item.vehicle_id))
          .filter(Boolean)[0];

        const extraOEM = (productOEM.get(part.id) || [])[0];

        const images = imagesByPart.get(part.id) || [];

        const primaryImage =
          images.find(image => image.isPrimary) ||
          images[0] ||
          null;

        return {
          id: part.id,
          sku: part.part_number,
          name: part.description,

          category: categoryMap.get(part.category_id)?.name || '',

          manufacturer:
            manufacturerMap.get(part.manufacturer_id)?.name || '',

          supplier:
            supplierMap.get(part.supplier_id)?.company_name || '',

          cost: Number(part.buy_price || 0),
          price: Number(part.sell_price || 0),

          quantity: Number(
            summary?.total_quantity ??
            stockRows.reduce(
              (total, row) => total + Number(row.quantity || 0),
              0
            )
          ),

          reorderLevel: Number(
            summary?.product_minimum_stock ??
            part.minimum_stock ??
            5
          ),

          location: firstLocation
            ? locationLabel(firstLocation)
            : part.shelf_location || '',

          locationId: firstStockRow?.location_id || null,

          stockByLocation: stockRows.map(row => ({
            inventoryId: row.id,
            locationId: row.location_id,
            quantity: Number(row.quantity || 0),
            minimumStock: Number(row.minimum_stock || 0),
          })),

          barcode: part.barcode || '',
          description: part.notes || '',

          automotive: Boolean(
            part.oem_number || extraOEM || fitment
          ),

          oem: part.oem_number || extraOEM?.oem_number || '',
          make: fitment?.make || '',
          model: fitment?.model || '',
          yearFrom: fitment?.year_from || '',
          yearTo: fitment?.year_to || '',
          coolingType: '',

          images,
          primaryImage,
          imageUrl: primaryImage?.url || '',
        };
      });

      const mappedMovements = movements.map(movement =>
        mapMovement(movement, products, locations)
      );

      setData({
        ...emptyData,

        // Persisted business settings.
        settings: {
          businessName: business?.name || '',
          currency: savedSettings?.currency || 'ZAR',
          lowStockDefault: Number(
            savedSettings?.low_stock_default ?? 5
          ),
        },

        products,

        categories: categories.map(item => item.name),

        manufacturers: manufacturers.map(item => item.name),

        suppliers: suppliers.map(item => item.company_name),

        vehicles: vehicles.map(vehicle => ({
          id: vehicle.id,
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year_from || '',
          yearFrom: vehicle.year_from || '',
          yearTo: vehicle.year_to || '',
          engine: vehicle.engine || vehicle.variant || '',
          notes: '',
        })),

        movements: mappedMovements,

        locations: locations.map(location => ({
          ...location,
          label: locationLabel(location),
        })),
      });

    } catch (err) {
      console.error('Inventory loading failed:', err);

      setError(err.message || 'Unable to load inventory data.');

      setData(emptyData);

    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ---------------------------------------------------------
  // PRODUCT HELPERS
  // ---------------------------------------------------------

  function getProductForBusiness(partId) {
    const product = data.products.find(
      item => item.id === partId
    );

    if (!product) {
      throw new Error(
        'This product is not available in the selected business.'
      );
    }

    return product;
  }

  async function getProductImageRows(partId) {
    getProductForBusiness(partId);

    return unwrap(
      await supabase
        .from('part_images')
        .select('id,part_id,image_url,is_primary,created_at')
        .eq('part_id', partId)
        .order('created_at', { ascending: true })
    ) || [];
  }

  function validateImageFile(file) {
    if (!file) {
      throw new Error('Choose an image first.');
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      throw new Error('Only JPG, PNG and WebP images are supported.');
    }

    if (file.size > MAX_IMAGE_SIZE) {
      throw new Error('Each image must be 5 MB or smaller.');
    }

    return getImageExtension(file);
  }

  // ---------------------------------------------------------
  // CATEGORY, MANUFACTURER AND SUPPLIER HELPERS
  // ---------------------------------------------------------

  async function resolveCategory(name) {
    const categoryName = String(name || '').trim();

    if (!categoryName) {
      throw new Error('A product category is required.');
    }

    const existingCategories = unwrap(
      await supabase
        .from('categories')
        .select('id,name')
    ) || [];

    const existing = existingCategories.find(
      item => normalise(item.name) === normalise(categoryName)
    );

    if (existing) return existing;

    const { data: created, error: insertError } = await supabase
      .from('categories')
      .insert({ name: categoryName })
      .select('id,name')
      .single();

    if (!insertError) return created;

    if (insertError.code === '23505') {
      const refreshedCategories = unwrap(
        await supabase
          .from('categories')
          .select('id,name')
      ) || [];

      const duplicate = refreshedCategories.find(
        item => normalise(item.name) === normalise(categoryName)
      );

      if (duplicate) return duplicate;
    }

    throw insertError;
  }

  async function resolveManufacturer(name) {
    if (!name?.trim()) return null;

    const manufacturers = unwrap(
      await supabase
        .from('manufacturers')
        .select('id,name')
    ) || [];

    const existing = manufacturers.find(
      item => normalise(item.name) === normalise(name)
    );

    if (existing) return existing;

    return unwrap(
      await supabase
        .from('manufacturers')
        .insert({ name: name.trim() })
        .select('id,name')
        .single()
    );
  }

  async function resolveSupplier(name) {
    if (!name?.trim()) return null;

    const suppliers = unwrap(
      await supabase
        .from('suppliers')
        .select('id,company_name')
        .eq('business_id', businessId)
    ) || [];

    const existing = suppliers.find(
      item => normalise(item.company_name) === normalise(name)
    );

    if (existing) return existing;

    return unwrap(
      await supabase
        .from('suppliers')
        .insert({
          business_id: businessId,
          company_name: name.trim(),
        })
        .select('id,company_name')
        .single()
    );
  }

  function resolveLocation(value) {
    const search = normalise(value);

    if (!search) return null;

    return data.locations.find(location =>
      [
        location.label,
        location.description,
        location.id,
      ].some(candidate => normalise(candidate) === search)
    );
  }

  function requireActiveLocation(locationId, label = 'location') {
    const location = data.locations.find(
      item => item.id === locationId
    );

    if (!location) {
      throw new Error(
        `Select a valid active ${label} for this business.`
      );
    }

    return location;
  }

  // ---------------------------------------------------------
  // SAVE PRODUCT
  // ---------------------------------------------------------

  async function saveProduct(product) {
    if (!businessId) {
      throw new Error('No business is selected.');
    }

    if (!product.sku?.trim() || !product.name?.trim()) {
      throw new Error('SKU and product name are required.');
    }

    if (!product.category?.trim()) {
      throw new Error('A product category is required.');
    }

    const category = await resolveCategory(product.category);

    const manufacturer = await resolveManufacturer(
      product.manufacturer
    );

    const supplier = await resolveSupplier(product.supplier);

    const existingProduct = product.id
      ? data.products.find(item => item.id === product.id)
      : null;

    if (product.id && !existingProduct) {
      throw new Error(
        'This product is not available in the selected business.'
      );
    }

    if (
      existingProduct &&
      Number(product.quantity || 0) !==
        Number(existingProduct.quantity || 0)
    ) {
      throw new Error(
        'Product details cannot change stock quantities. Use Stock Control to receive, issue or adjust stock.'
      );
    }

    const openingQuantity = Math.max(
      0,
      Number(product.quantity) || 0
    );

    const openingLocation =
      openingQuantity > 0
        ? resolveLocation(product.location)
        : null;

    if (openingQuantity > 0 && !openingLocation) {
      throw new Error(
        'Choose a valid active storage location before entering opening stock.'
      );
    }

    const {
      data: authData,
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw authError;

    const authenticatedUserId = authData.user?.id;

    if (!authenticatedUserId) {
      throw new Error(
        'Your session could not be verified. Please sign in again before saving the product.'
      );
    }

    const payload = {
      part_number: product.sku.trim(),
      description: product.name.trim(),
      category_id: category.id,
      manufacturer_id: manufacturer?.id || null,
      supplier_id: supplier?.id || null,
      oem_number: product.oem?.trim() || null,
      barcode: product.barcode?.trim() || null,
      buy_price: Number(product.cost) || 0,
      sell_price: Number(product.price) || 0,
      minimum_stock: Number(product.reorderLevel) || 0,
      shelf_location: product.location?.trim() || null,
      notes: product.description?.trim() || null,
      business_id: businessId,
    };

    console.log('PRODUCT INSERT DEBUG:', {
      authenticatedUser: authenticatedUserId,
      authenticatedEmail: authData.user?.email,
      selectedBusinessId: businessId,
      productBusinessId: payload.business_id,
      createdBy: authenticatedUserId,
      isBusinessIdValid: Boolean(businessId),
      isUserAuthenticated: Boolean(authenticatedUserId),
      isEditing: Boolean(product.id),
    });

    let savedPart;

    if (product.id) {
      const updateResult = await supabase
        .from('parts')
        .update(payload)
        .eq('id', product.id)
        .eq('business_id', businessId)
        .select('id')
        .single();

      if (updateResult.error) {
        console.error('PRODUCT UPDATE FAILED:', {
          code: updateResult.error.code,
          message: updateResult.error.message,
          details: updateResult.error.details,
          hint: updateResult.error.hint,
          payload,
        });

        throw updateResult.error;
      }

      savedPart = updateResult.data;

    } else {
      const insertPayload = {
        ...payload,
        created_by: authenticatedUserId,
      };

      console.log('PRODUCT INSERT PAYLOAD:', insertPayload);

      const insertResult = await supabase
        .from('parts')
        .insert(insertPayload)
        .select('id')
        .single();

      if (insertResult.error) {
        console.error('PRODUCT INSERT FAILED:', {
          code: insertResult.error.code,
          message: insertResult.error.message,
          details: insertResult.error.details,
          hint: insertResult.error.hint,
          payload: insertPayload,
        });

        throw insertResult.error;
      }

      savedPart = insertResult.data;
    }

    try {
      if (
        product.automotive &&
        product.make?.trim() &&
        product.model?.trim()
      ) {
        const year = Number(product.yearFrom) || null;
        const yearTo = Number(product.yearTo) || year;

        let vehicleQuery = supabase
          .from('vehicles')
          .select('id')
          .ilike('make', product.make.trim())
          .ilike('model', product.model.trim());

        vehicleQuery = year === null
          ? vehicleQuery.is('year_from', null)
          : vehicleQuery.eq('year_from', year);

        let vehicle = unwrap(
          await vehicleQuery.maybeSingle()
        );

        if (!vehicle) {
          vehicle = unwrap(
            await supabase
              .from('vehicles')
              .insert({
                make: product.make.trim(),
                model: product.model.trim(),
                year_from: year,
                year_to: yearTo,
              })
              .select('id')
              .single()
          );
        }

        unwrap(
          await supabase
            .from('part_vehicle_compatibility')
            .upsert(
              {
                part_id: savedPart.id,
                vehicle_id: vehicle.id,
              },
              {
                onConflict: 'part_id,vehicle_id',
                ignoreDuplicates: true,
              }
            )
        );

      } else if (!product.automotive) {
        unwrap(
          await supabase
            .from('part_vehicle_compatibility')
            .delete()
            .eq('part_id', savedPart.id)
        );
      }

      if (openingQuantity > 0 && !existingProduct) {
        unwrap(
          await supabase.rpc('stockwise_adjust_stock', {
            p_business_id: businessId,
            p_part_id: savedPart.id,
            p_location_id: openingLocation.id,
            p_quantity: openingQuantity,
            p_adjustment_type: 'opening_balance',
            p_unit_cost: Number(product.cost) || 0,
            p_reference: 'OPENING',
            p_reason: 'Opening stock',
            p_idempotency_key: makeIdempotencyKey(),
          })
        );
      }

    } catch (err) {
      await refresh();

      throw new Error(
        `The product was saved, but a related operation failed: ${err.message || 'Unknown error'}. The product has been kept in the catalogue.`
      );
    }

    await refresh();

    return savedPart;
  }

  // ---------------------------------------------------------
  // PRODUCT IMAGE MANAGEMENT
  // ---------------------------------------------------------

  async function uploadProductImages(partId, files) {
    if (!businessId) {
      throw new Error('No business is selected.');
    }

    getProductForBusiness(partId);

    const selectedFiles = Array.from(files || []).filter(Boolean);

    if (!selectedFiles.length) return [];

    const existingImages = await getProductImageRows(partId);

    if (
      existingImages.length + selectedFiles.length >
      MAX_PRODUCT_IMAGES
    ) {
      throw new Error(
        `A product can have a maximum of ${MAX_PRODUCT_IMAGES} images. You can add ${Math.max(
          0,
          MAX_PRODUCT_IMAGES - existingImages.length
        )} more.`
      );
    }

    selectedFiles.forEach(validateImageFile);

    let hasPrimary = existingImages.some(
      image => image.is_primary
    );

    if (existingImages.length && !hasPrimary) {
      const firstImage = existingImages[0];

      unwrap(
        await supabase
          .from('part_images')
          .update({ is_primary: true })
          .eq('id', firstImage.id)
          .eq('part_id', partId)
      );

      hasPrimary = true;
    }

    const uploadedImages = [];

    for (const file of selectedFiles) {
      const extension = validateImageFile(file);
      const fileName = `${makeFileId()}.${extension}`;

      const storagePath =
        `${businessId}/${partId}/${fileName}`;

      const uploadResult = await supabase.storage
        .from(IMAGE_BUCKET)
        .upload(storagePath, file, {
          cacheControl: '3600',
          contentType: file.type,
          upsert: false,
        });

      if (uploadResult.error) {
        throw uploadResult.error;
      }

      const imageUrl = getPublicImageUrl(storagePath);

      if (!imageUrl) {
        await supabase.storage
          .from(IMAGE_BUCKET)
          .remove([storagePath]);

        throw new Error(
          'Could not generate a public URL for the uploaded image.'
        );
      }

      const insertResult = await supabase
        .from('part_images')
        .insert({
          part_id: partId,
          image_url: imageUrl,
          is_primary: !hasPrimary,
        })
        .select('id,part_id,image_url,is_primary,created_at')
        .single();

      if (insertResult.error) {
        await supabase.storage
          .from(IMAGE_BUCKET)
          .remove([storagePath]);

        throw insertResult.error;
      }

      uploadedImages.push(
        mapProductImage(insertResult.data)
      );

      hasPrimary = true;
    }

    await refresh();

    return uploadedImages;
  }

  async function replaceProductImage(imageId, file) {
    if (!businessId) {
      throw new Error('No business is selected.');
    }

    const extension = validateImageFile(file);

    const image = unwrap(
      await supabase
        .from('part_images')
        .select('id,part_id,image_url,is_primary,created_at')
        .eq('id', imageId)
        .single()
    );

    getProductForBusiness(image.part_id);

    const oldStoragePath = getStoragePathFromUrl(
      image.image_url
    );

    const newStoragePath =
      `${businessId}/${image.part_id}/${makeFileId()}.${extension}`;

    const uploadResult = await supabase.storage
      .from(IMAGE_BUCKET)
      .upload(newStoragePath, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false,
      });

    if (uploadResult.error) {
      throw uploadResult.error;
    }

    const newImageUrl = getPublicImageUrl(newStoragePath);

    if (!newImageUrl) {
      await supabase.storage
        .from(IMAGE_BUCKET)
        .remove([newStoragePath]);

      throw new Error(
        'Could not generate a public URL for the replacement image.'
      );
    }

    const updateResult = await supabase
      .from('part_images')
      .update({ image_url: newImageUrl })
      .eq('id', imageId)
      .eq('part_id', image.part_id);

    if (updateResult.error) {
      await supabase.storage
        .from(IMAGE_BUCKET)
        .remove([newStoragePath]);

      throw updateResult.error;
    }

    if (oldStoragePath) {
      const removeOldResult = await supabase.storage
        .from(IMAGE_BUCKET)
        .remove([oldStoragePath]);

      if (removeOldResult.error) {
        console.warn(
          'Replacement image saved, but the old storage object could not be removed:',
          removeOldResult.error
        );
      }
    }

    await refresh();

    return {
      ...mapProductImage(image),
      url: newImageUrl,
      imageUrl: newImageUrl,
    };
  }

  async function setPrimaryProductImage(imageId) {
    const image = unwrap(
      await supabase
        .from('part_images')
        .select('id,part_id,image_url,is_primary,created_at')
        .eq('id', imageId)
        .single()
    );

    getProductForBusiness(image.part_id);

    // Clear the current primary first to respect the unique
    // partial index on (part_id) where is_primary = true.
    unwrap(
      await supabase
        .from('part_images')
        .update({ is_primary: false })
        .eq('part_id', image.part_id)
    );

    unwrap(
      await supabase
        .from('part_images')
        .update({ is_primary: true })
        .eq('id', imageId)
        .eq('part_id', image.part_id)
    );

    await refresh();
  }

  async function removeProductImage(imageId) {
    const image = unwrap(
      await supabase
        .from('part_images')
        .select('id,part_id,image_url,is_primary,created_at')
        .eq('id', imageId)
        .single()
    );

    getProductForBusiness(image.part_id);

    const storagePath = getStoragePathFromUrl(
      image.image_url
    );

    if (storagePath) {
      const storageResult = await supabase.storage
        .from(IMAGE_BUCKET)
        .remove([storagePath]);

      if (storageResult.error) {
        throw storageResult.error;
      }
    }

    unwrap(
      await supabase
        .from('part_images')
        .delete()
        .eq('id', imageId)
        .eq('part_id', image.part_id)
    );

    if (image.is_primary) {
      const remainingImages = unwrap(
        await supabase
          .from('part_images')
          .select('id,created_at')
          .eq('part_id', image.part_id)
          .order('created_at', { ascending: true })
          .limit(1)
      ) || [];

      if (remainingImages.length) {
        unwrap(
          await supabase
            .from('part_images')
            .update({ is_primary: true })
            .eq('id', remainingImages[0].id)
        );
      }
    }

    await refresh();
  }

  // ---------------------------------------------------------
  // DELETE PRODUCT
  // ---------------------------------------------------------

  async function deleteProduct(id) {
    if (!businessId) {
      throw new Error('No business is selected.');
    }

    getProductForBusiness(id);

    const stock = unwrap(
      await supabase
        .from('inventory')
        .select('id')
        .eq('business_id', businessId)
        .eq('part_id', id)
        .limit(1)
    );

    const movements = unwrap(
      await supabase
        .from('stock_movements')
        .select('id')
        .eq('business_id', businessId)
        .eq('part_id', id)
        .limit(1)
    );

    if (stock?.length || movements?.length) {
      throw new Error(
        'This product has stock or movement history and cannot be deleted. Keep it in the catalogue.'
      );
    }

    // Remove associated storage objects before deleting image records.
    const images = await getProductImageRows(id);

    const storagePaths = images
      .map(image => getStoragePathFromUrl(image.image_url))
      .filter(Boolean);

    if (storagePaths.length) {
      const storageResult = await supabase.storage
        .from(IMAGE_BUCKET)
        .remove(storagePaths);

      if (storageResult.error) {
        throw storageResult.error;
      }
    }

    if (images.length) {
      unwrap(
        await supabase
          .from('part_images')
          .delete()
          .eq('part_id', id)
      );
    }

    unwrap(
      await supabase
        .from('part_vehicle_compatibility')
        .delete()
        .eq('part_id', id)
    );

    unwrap(
      await supabase
        .from('part_oem_numbers')
        .delete()
        .eq('part_id', id)
    );

    unwrap(
      await supabase
        .from('parts')
        .delete()
        .eq('id', id)
        .eq('business_id', businessId)
    );

    await refresh();
  }

  // ---------------------------------------------------------
  // STOCK MOVEMENTS
  // ---------------------------------------------------------

  async function moveStock({
    productId,
    type,
    quantity,
    reference = '',
    note = '',
    locationId,
    sourceLocationId,
    destinationLocationId,
    movementType,
  }) {
    if (!businessId) {
      throw new Error('No business is selected.');
    }

    const qty = Number(quantity);

    if (!Number.isInteger(qty) || qty < 0) {
      throw new Error('Enter a valid whole-number quantity.');
    }

    if (type !== 'ADJUST' && qty <= 0) {
      throw new Error('Enter a quantity greater than zero.');
    }

    const product = data.products.find(
      item => item.id === productId
    );

    if (!product) {
      throw new Error('Product not found.');
    }

    let source = null;
    let destination = null;

    if (type === 'RECEIVE') {
      destination =
        destinationLocationId ||
        locationId ||
        product.locationId;

      requireActiveLocation(destination, 'destination location');

    } else if (type === 'ISSUE' || type === 'ADJUST') {
      source =
        sourceLocationId ||
        locationId ||
        product.locationId;

      requireActiveLocation(source, 'source location');

    } else if (type === 'TRANSFER') {
      source = sourceLocationId || locationId;
      destination = destinationLocationId;

      requireActiveLocation(source, 'source location');
      requireActiveLocation(destination, 'destination location');

      if (source === destination) {
        throw new Error(
          'The source and destination locations must be different.'
        );
      }

    } else {
      throw new Error(`Unsupported stock movement: ${type}`);
    }

    const common = {
      p_business_id: businessId,
      p_part_id: productId,
      p_quantity: qty,
      p_unit_cost: Number(product.cost) || 0,
      p_reference: reference || null,
      p_reason: note.trim() || 'Stock movement',
      p_idempotency_key: makeIdempotencyKey(),
    };

    let result;

    if (type === 'RECEIVE') {
      result = await supabase.rpc(
        'stockwise_receive_stock',
        {
          ...common,
          p_destination_location_id: destination,
        }
      );

    } else if (type === 'ISSUE') {
      result = await supabase.rpc(
        'stockwise_issue_stock',
        {
          ...common,
          p_source_location_id: source,
          p_movement_type: movementType || 'sold',
        }
      );

    } else if (type === 'TRANSFER') {
      result = await supabase.rpc(
        'stockwise_transfer_stock',
        {
          ...common,
          p_source_location_id: source,
          p_destination_location_id: destination,
        }
      );

    } else if (type === 'ADJUST') {
      const currentInventory = unwrap(
        await supabase
          .from('inventory')
          .select('quantity')
          .eq('business_id', businessId)
          .eq('part_id', productId)
          .eq('location_id', source)
          .maybeSingle()
      );

      const currentQuantity = Number(
        currentInventory?.quantity || 0
      );

      const targetQuantity = qty;
      const delta = targetQuantity - currentQuantity;

      if (delta === 0) {
        return {
          unchanged: true,
          currentQuantity,
          targetQuantity,
        };
      }

      result = await supabase.rpc(
        'stockwise_adjust_stock',
        {
          ...common,
          p_location_id: source,
          p_quantity: Math.abs(delta),
          p_adjustment_type:
            delta > 0 ? 'increase' : 'decrease',
          p_reason: note.trim() || 'Stock adjustment',
        }
      );
    }

    unwrap(result);

    await refresh();

    return result.data;
  }

  // ---------------------------------------------------------
  // CATEGORY MANAGEMENT
  // ---------------------------------------------------------

  async function addCategory(name) {
    const category = await resolveCategory(name);

    await refresh();

    return category;
  }

  async function removeCategory(name) {
    const categories = unwrap(
      await supabase
        .from('categories')
        .select('id,name')
    ) || [];

    const category = categories.find(
      item => normalise(item.name) === normalise(name)
    );

    if (!category) {
      throw new Error('Category not found.');
    }

    const linked = unwrap(
      await supabase
        .from('parts')
        .select('id')
        .eq('business_id', businessId)
        .eq('category_id', category.id)
        .limit(1)
    );

    if (linked?.length) {
      throw new Error(
        'Move products to another category before deleting.'
      );
    }

    unwrap(
      await supabase
        .from('categories')
        .delete()
        .eq('id', category.id)
    );

    await refresh();
  }

  // ---------------------------------------------------------
  // MANUFACTURER MANAGEMENT
  // ---------------------------------------------------------

  async function addManufacturer(name) {
    if (!name?.trim()) {
      throw new Error('Enter a manufacturer name.');
    }

    unwrap(
      await supabase
        .from('manufacturers')
        .insert({ name: name.trim() })
        .select('id')
        .single()
    );

    await refresh();
  }

  // ---------------------------------------------------------
  // SUPPLIER MANAGEMENT
  // ---------------------------------------------------------

  async function addSupplier(name) {
    if (!name?.trim()) {
      throw new Error('Enter a supplier name.');
    }

    if (!businessId) {
      throw new Error('No business is selected.');
    }

    unwrap(
      await supabase
        .from('suppliers')
        .insert({
          business_id: businessId,
          company_name: name.trim(),
        })
        .select('id')
        .single()
    );

    await refresh();
  }

  // ---------------------------------------------------------
  // VEHICLE MANAGEMENT
  // ---------------------------------------------------------

  async function saveVehicle(vehicle) {
    if (!vehicle.make?.trim() || !vehicle.model?.trim()) {
      throw new Error('Vehicle make and model are required.');
    }

    const yearFrom =
      Number(vehicle.yearFrom ?? vehicle.year) || null;

    const yearTo =
      Number(vehicle.yearTo) || yearFrom;

    const payload = {
      make: vehicle.make.trim(),
      model: vehicle.model.trim(),
      engine: vehicle.engine?.trim() || null,
      year_from: yearFrom,
      year_to: yearTo,
    };

    if (vehicle.id) {
      unwrap(
        await supabase
          .from('vehicles')
          .update(payload)
          .eq('id', vehicle.id)
      );
    } else {
      unwrap(
        await supabase
          .from('vehicles')
          .insert(payload)
      );
    }

    await refresh();
  }

  async function removeVehicle(id) {
    const linked = unwrap(
      await supabase
        .from('part_vehicle_compatibility')
        .select('id')
        .eq('vehicle_id', id)
        .limit(1)
    );

    if (linked?.length) {
      throw new Error(
        'This vehicle is linked to products and cannot be removed.'
      );
    }

    unwrap(
      await supabase
        .from('vehicles')
        .delete()
        .eq('id', id)
    );

    await refresh();
  }

  // ---------------------------------------------------------
  // BUSINESS SETTINGS
  // ---------------------------------------------------------

  async function updateSettings(settings) {
    if (!businessId) {
      throw new Error('No business is selected.');
    }

    const businessName = String(
      settings.businessName ??
      data.settings.businessName ??
      ''
    ).trim();

    const currency = String(
      settings.currency ??
      data.settings.currency ??
      'ZAR'
    ).trim().toUpperCase();

    const lowStockDefault = Number(
      settings.lowStockDefault ??
      data.settings.lowStockDefault ??
      5
    );

    if (!businessName) {
      throw new Error('Business name is required.');
    }

    if (!SUPPORTED_CURRENCIES.includes(currency)) {
      throw new Error('Select a supported currency.');
    }

    if (
      !Number.isInteger(lowStockDefault) ||
      lowStockDefault < 0
    ) {
      throw new Error(
        'The low-stock threshold must be a whole number of zero or greater.'
      );
    }

    // Update the business name.
    const businessResult = await supabase
      .from('businesses')
      .update({
        name: businessName,
      })
      .eq('id', businessId)
      .select('id,name')
      .single();

    if (businessResult.error) {
      throw businessResult.error;
    }

    // Save the inventory settings separately for this business.
    const settingsResult = await supabase
      .from('business_settings')
      .upsert(
        {
          business_id: businessId,
          currency,
          low_stock_default: lowStockDefault,
        },
        {
          onConflict: 'business_id',
        }
      )
      .select(
        'business_id,currency,low_stock_default'
      )
      .single();

    if (settingsResult.error) {
      throw settingsResult.error;
    }

    const savedSettings = {
      businessName: businessResult.data.name,
      currency: settingsResult.data.currency,
      lowStockDefault: Number(
        settingsResult.data.low_stock_default
      ),
    };

    setData(current => ({
      ...current,
      settings: savedSettings,
    }));

    return savedSettings;
  }

  // ---------------------------------------------------------
  // CONTEXT ACTIONS
  // ---------------------------------------------------------

  const actions = useMemo(
    () => ({
      saveProduct,
      deleteProduct,
      moveStock,

      uploadProductImages,
      replaceProductImage,
      setPrimaryProductImage,
      removeProductImage,

      addCategory,
      removeCategory,

      addManufacturer,
      addSupplier,

      saveVehicle,
      removeVehicle,

      updateSettings,
      refresh,
    }),
    [data, businessId, refresh]
  );

  return (
    <InventoryContext.Provider
      value={{
        ...data,
        ...actions,

        // Expose the selected business to Settings and other pages.
        businessId,

        loading,
        error,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
}

// -----------------------------------------------------------
// INVENTORY CONTEXT HOOK
// -----------------------------------------------------------

export function useInventoryData() {
  const value = useContext(InventoryContext);

  if (!value) {
    throw new Error(
      'useInventoryData must be used inside InventoryProvider'
    );
  }

  return value;
}
