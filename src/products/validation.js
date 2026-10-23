export const PRODUCT_CATEGORIES = [
  'Signature Scents',
  'Body Lovers',
  'Sip & Glow',
  'Sculpted Silhouettes',
  'Seasonal & Gifts',
  'Other',
];

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 'on' || value === '1') return true;
  if (value === 'false' || value === 'off' || value === '0') return false;
  return null;
}

function toPriceCents(value, { alreadyCents = false } = {}) {
  if (alreadyCents) {
    return Number.isSafeInteger(value) && value > 0 && value <= 9_999_999 ? value : null;
  }
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value).trim();
  if (!/^\d{1,5}(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  const cents = Number.parseInt(whole, 10) * 100 + Number.parseInt(fraction.padEnd(2, '0'), 10);
  return cents > 0 && cents <= 9_999_999 ? cents : null;
}

export function validateProduct(input = {}, { defaultImagePath = '/assets/product-placeholder.svg' } = {}) {
  const errors = {};
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  const category = typeof input.category === 'string' ? input.category.trim() : '';
  const priceCents = input.price !== undefined
    ? toPriceCents(input.price)
    : toPriceCents(input.priceCents, { alreadyCents: true });

  if (typeof input.name !== 'string') errors.name = 'Enter a product name as text.';
  else if (!name) errors.name = 'Enter a product name.';
  else if (name.length > 120) errors.name = 'Product names must be 120 characters or fewer.';
  if (input.description !== undefined && typeof input.description !== 'string') errors.description = 'Enter the description as text.';
  if (description.length > 2000) errors.description = 'Descriptions must be 2,000 characters or fewer.';
  if (typeof input.category !== 'string') errors.category = 'Choose a category from the list.';
  if (!PRODUCT_CATEGORIES.includes(category)) errors.category = 'Choose a category from the list.';
  if (priceCents === null) errors.price = 'Enter a price greater than $0.00 and no more than $99,999.99.';

  let imagePath = typeof input.imagePath === 'string' ? input.imagePath.trim() : defaultImagePath;
  if (input.imagePath !== undefined && typeof input.imagePath !== 'string') errors.imagePath = 'Choose a product photo from your device.';
  if (!imagePath) imagePath = defaultImagePath;
  if (!(imagePath.startsWith('/assets/') || /^\/uploads\/[a-f0-9-]+\.(?:jpg|png|webp)$/.test(imagePath))) {
    errors.imagePath = 'Choose a product photo from your device.';
  }

  const sortOrderInput = input.sortOrder === undefined ? 0 : Number(input.sortOrder);
  const validSortOrder = Number.isSafeInteger(sortOrderInput) && sortOrderInput >= 0 && sortOrderInput <= 2_147_483_647;
  const sortOrder = validSortOrder ? sortOrderInput : 0;
  if (!validSortOrder) errors.sortOrder = 'Sort order must be a whole number from 0 to 2,147,483,647.';

  const isAvailableInput = input.isAvailable ?? input.is_available;
  const isPublishedInput = input.isPublished ?? input.is_published;
  const isAvailable = isAvailableInput === undefined ? true : parseBoolean(isAvailableInput);
  const isPublished = isPublishedInput === undefined ? false : parseBoolean(isPublishedInput);
  if (isAvailable === null) errors.isAvailable = 'Choose whether this product is available.';
  if (isPublished === null) errors.isPublished = 'Choose whether this product is published.';

  return {
    value: {
      name,
      description,
      category,
      priceCents,
      imagePath,
      isAvailable: isAvailable ?? true,
      isPublished: isPublished ?? false,
      sortOrder,
    },
    errors,
  };
}
