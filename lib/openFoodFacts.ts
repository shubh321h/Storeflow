export interface FoodProductMetadata {
  barcode: string;
  name: string;
  brand?: string;
  category?: string;
  imageUrl?: string;
  quantity?: string;
  source?: 'openfoodfacts' | 'openbeautyfacts' | 'openproductsfacts';
}

interface FactsProductResponse {
  status?: number;
  product?: {
    code?: string;
    product_name?: string;
    product_name_en?: string;
    generic_name?: string;
    brands?: string;
    categories?: string;
    categories_tags?: string[];
    image_front_url?: string;
    image_url?: string;
    quantity?: string;
  };
}

function normalizeProduct(
  data: FactsProductResponse,
  barcode: string,
  source: FoodProductMetadata['source']
): FoodProductMetadata | null {
  if (data.status !== 1 || !data.product) {
    return null;
  }

  const product = data.product;

  const name =
    product.product_name?.trim() ||
    product.product_name_en?.trim() ||
    product.generic_name?.trim() ||
    '';

  if (!name) {
    return null;
  }

  let category: string | undefined;

  if (product.categories) {
    category = product.categories
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)[0];
  }

  if (!category && product.categories_tags?.length) {
    const tag = product.categories_tags[0];

    category = tag
      ?.replace(/^en:/, '')
      .replace(/-/g, ' ')
      .trim();
  }

  return {
    barcode: product.code || barcode,
    name,
    brand: product.brands?.trim() || undefined,
    category,
    imageUrl:
      product.image_front_url ||
      product.image_url ||
      undefined,
    quantity: product.quantity?.trim() || undefined,
    source,
  };
}

async function lookupFactsDatabase(
  url: string,
  barcode: string,
  source: FoodProductMetadata['source']
): Promise<FoodProductMetadata | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'StoreFlow/1.0',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data: FactsProductResponse = await response.json();

    return normalizeProduct(data, barcode, source);
  } catch (error) {
    console.warn(`StoreFlow ${source} lookup failed:`, error);
    return null;
  }
}

export async function getFoodProductByBarcode(
  barcode: string
): Promise<FoodProductMetadata | null> {
  const cleanBarcode = barcode.trim();

  if (!cleanBarcode) {
    return null;
  }

  const encodedBarcode = encodeURIComponent(cleanBarcode);

  // 1. Open Food Facts
  // Food, grocery and packaged FMCG products.
  const foodProduct = await lookupFactsDatabase(
    `https://world.openfoodfacts.org/api/v3/product/${encodedBarcode}?fields=code,product_name,product_name_en,generic_name,brands,categories,categories_tags,image_front_url,image_url,quantity`,
    cleanBarcode,
    'openfoodfacts'
  );

  if (foodProduct) {
    return foodProduct;
  }

  // 2. Open Beauty Facts
  // Personal care, hygiene and cosmetic products.
  const beautyProduct = await lookupFactsDatabase(
    `https://world.openbeautyfacts.org/api/v3/product/${encodedBarcode}?fields=code,product_name,product_name_en,generic_name,brands,categories,categories_tags,image_front_url,image_url,quantity`,
    cleanBarcode,
    'openbeautyfacts'
  );

  if (beautyProduct) {
    return beautyProduct;
  }

  // 3. Open Products Facts
  // Household and other non-food products.
  const productsProduct = await lookupFactsDatabase(
    `https://world.openproductsfacts.org/api/v3/product/${encodedBarcode}?fields=code,product_name,product_name_en,generic_name,brands,categories,categories_tags,image_front_url,image_url,quantity`,
    cleanBarcode,
    'openproductsfacts'
  );

  if (productsProduct) {
    return productsProduct;
  }

  // Product not found in any external database.
  // StoreFlow can continue with manual product entry.
  return null;
}
