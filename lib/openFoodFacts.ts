export interface FoodProductMetadata {
  barcode: string;
  name: string;
  brand?: string;
  category?: string;
  imageUrl?: string;
  quantity?: string;
}

export async function getFoodProductByBarcode(
  barcode: string
): Promise<FoodProductMetadata | null> {
  try {
    const cleanBarcode = barcode.trim();

    if (!cleanBarcode) {
      return null;
    }

    const response = await fetch(
      `https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(
        cleanBarcode
      )}?fields=code,product_name,brands,categories,image_front_url,quantity`,
      {
        headers: {
          'User-Agent': 'StoreFlow/1.0',
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.status !== 1 || !data.product) {
      return null;
    }

    const product = data.product;

    return {
      barcode: product.code || cleanBarcode,
      name: product.product_name || '',
      brand: product.brands || undefined,
      category: product.categories
        ? product.categories.split(',')[0]?.trim()
        : undefined,
      imageUrl: product.image_front_url || undefined,
      quantity: product.quantity || undefined,
    };
  } catch (error) {
    console.warn('Open Food Facts lookup failed:', error);
    return null;
  }
}
