import AsyncStorage from '@react-native-async-storage/async-storage';

export interface BarcodeMetadata {
  barcode: string;
  name?: string;
  brand?: string;
  category?: string;
  description?: string;
  imageUrl?: string;
  quantity?: string;
  unit?: string;
  mrp?: number;
  source: 'upcitemdb' | 'brocade' | 'cache';
}

interface UPCItem {
  ean?: string;
  upc?: string;
  gtin?: string;
  title?: string;
  brand?: string;
  category?: string;
  description?: string;
  images?: string[];
  lowest_recorded_price?: number;
  highest_recorded_price?: number;
}

interface UPCResponse {
  code?: string;
  total?: number;
  items?: UPCItem[];
}

const CACHE_PREFIX = '@storeflow_barcode_metadata:';

const BROCADE_URL =
  process.env.EXPO_PUBLIC_BROCADE_BARCODE_URL?.trim() || '';

const BROCADE_KEY =
  process.env.EXPO_PUBLIC_BROCADE_API_KEY?.trim() || '';

function cleanBarcode(value: string): string {
  return value.replace(/\D/g, '');
}

function validBarcode(value: string): boolean {
  return value.length >= 8 && value.length <= 14;
}

function numberOrUndefined(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : undefined;
}

function normalizeUPCItem(
  barcode: string,
  item: UPCItem
): BarcodeMetadata {
  const price =
    numberOrUndefined(item.lowest_recorded_price) ??
    numberOrUndefined(item.highest_recorded_price);

  return {
    barcode,
    name: item.title?.trim() || undefined,
    brand: item.brand?.trim() || undefined,
    category: item.category?.trim() || undefined,
    description: item.description?.trim() || undefined,
    imageUrl:
      Array.isArray(item.images) && item.images.length > 0
        ? item.images[0]
        : undefined,
    mrp: price,
    source: 'upcitemdb',
  };
}

async function readCache(
  barcode: string
): Promise<BarcodeMetadata | null> {
  try {
    const raw = await AsyncStorage.getItem(
      `${CACHE_PREFIX}${barcode}`
    );

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as BarcodeMetadata;

    if (!parsed || parsed.barcode !== barcode) {
      return null;
    }

    return {
      ...parsed,
      source: 'cache',
    };
  } catch {
    return null;
  }
}

async function writeCache(
  metadata: BarcodeMetadata
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      `${CACHE_PREFIX}${metadata.barcode}`,
      JSON.stringify(metadata)
    );
  } catch {
    // Cache failure must never break barcode scanning.
  }
}

/**
 * UPCitemdb free Explorer API.
 *
 * No API key is required.
 *
 * Current endpoint:
 * https://api.upcitemdb.com/prod/trial/lookup
 */
async function lookupUPCitemdb(
  barcode: string
): Promise<BarcodeMetadata | null> {
  try {
    const url =
      `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(
        barcode
      )}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (response.status === 429) {
      console.warn(
        'UPCitemdb rate limit reached. Trying fallback provider.'
      );

      return null;
    }

    if (!response.ok) {
      console.warn(
        `UPCitemdb request failed with HTTP ${response.status}`
      );

      return null;
    }

    const json = (await response.json()) as UPCResponse;

    if (
      !json.items ||
      !Array.isArray(json.items) ||
      json.items.length === 0
    ) {
      return null;
    }

    const item = json.items[0];

    if (!item) {
      return null;
    }

    const metadata = normalizeUPCItem(barcode, item);

    if (!metadata.name && !metadata.brand) {
      return null;
    }

    return metadata;
  } catch (error) {
    console.warn('UPCitemdb lookup failed:', error);
    return null;
  }
}

/**
 * Brocade provider.
 *
 * The endpoint is intentionally configured through environment
 * variables because the current Brocade API contract must not
 * be guessed or hard-coded.
 *
 * Expected normalized response examples supported:
 *
 * {
 *   name: "...",
 *   brand: "...",
 *   category: "...",
 *   description: "...",
 *   imageUrl: "...",
 *   mrp: 100
 * }
 *
 * OR:
 *
 * {
 *   product: {
 *     name: "...",
 *     brand: "..."
 *   }
 * }
 */
async function lookupBrocade(
  barcode: string
): Promise<BarcodeMetadata | null> {
  if (!BROCADE_URL) {
    return null;
  }

  try {
    const separator = BROCADE_URL.includes('?') ? '&' : '?';

    const url =
      `${BROCADE_URL}${separator}barcode=${encodeURIComponent(barcode)}`;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };

    if (BROCADE_KEY) {
      headers.Authorization = `Bearer ${BROCADE_KEY}`;
      headers['x-api-key'] = BROCADE_KEY;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (response.status === 404) {
      return null;
    }

    if (response.status === 429) {
      console.warn('Brocade rate limit reached.');
      return null;
    }

    if (!response.ok) {
      console.warn(
        `Brocade request failed with HTTP ${response.status}`
      );

      return null;
    }

    const json = await response.json();

    const product =
      json?.product ??
      json?.item ??
      json?.data ??
      json;

    if (!product || typeof product !== 'object') {
      return null;
    }

    const name =
      product.name ??
      product.title ??
      product.product_name;

    const brand =
      product.brand ??
      product.brand_name;

    const category =
      product.category ??
      product.category_name;

    const description =
      product.description ??
      product.desc;

    const imageUrl =
      product.imageUrl ??
      product.image_url ??
      product.image ??
      (Array.isArray(product.images)
        ? product.images[0]
        : undefined);

    const mrp =
      numberOrUndefined(product.mrp) ??
      numberOrUndefined(product.price) ??
      numberOrUndefined(product.selling_price);

    if (!name && !brand) {
      return null;
    }

    return {
      barcode,
      name:
        typeof name === 'string'
          ? name.trim()
          : undefined,
      brand:
        typeof brand === 'string'
          ? brand.trim()
          : undefined,
      category:
        typeof category === 'string'
          ? category.trim()
          : undefined,
      description:
        typeof description === 'string'
          ? description.trim()
          : undefined,
      imageUrl:
        typeof imageUrl === 'string'
          ? imageUrl
          : undefined,
      mrp,
      source: 'brocade',
    };
  } catch (error) {
    console.warn('Brocade lookup failed:', error);
    return null;
  }
}

/**
 * Main StoreFlow barcode metadata lookup.
 *
 * Order:
 * 1. Cache
 * 2. UPCitemdb
 * 3. Brocade
 */
export async function lookupBarcodeMetadata(
  rawBarcode: string
): Promise<BarcodeMetadata | null> {
  const barcode = cleanBarcode(rawBarcode);

  if (!validBarcode(barcode)) {
    return null;
  }

  // 1. Local cache
  const cached = await readCache(barcode);

  if (cached) {
    return cached;
  }

  // 2. UPCitemdb
  const upcResult = await lookupUPCitemdb(barcode);

  if (upcResult) {
    await writeCache(upcResult);
    return upcResult;
  }

  // 3. Brocade
  const brocadeResult = await lookupBrocade(barcode);

  if (brocadeResult) {
    await writeCache(brocadeResult);
    return brocadeResult;
  }

  return null;
}

/**
 * Allows StoreFlow to manually clear one barcode's cache.
 */
export async function clearBarcodeMetadataCache(
  rawBarcode: string
): Promise<void> {
  const barcode = cleanBarcode(rawBarcode);

  if (!barcode) {
    return;
  }

  try {
    await AsyncStorage.removeItem(
      `${CACHE_PREFIX}${barcode}`
    );
  } catch {
    // Ignore cache errors.
  }
}

/**
 * Clear every StoreFlow barcode metadata cache entry.
 */
export async function clearAllBarcodeMetadataCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();

    const barcodeKeys = keys.filter(key =>
      key.startsWith(CACHE_PREFIX)
    );

    if (barcodeKeys.length > 0) {
      await AsyncStorage.multiRemove(barcodeKeys);
    }
  } catch {
    // Ignore cache errors.
  }
}
