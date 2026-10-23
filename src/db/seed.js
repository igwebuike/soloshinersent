export const initialProducts = [
  {
    seedKey: 'initial-01', name: '10.5 oz Premium Black Jar',
    description: 'Signature Scents · premium black vessel', category: 'Signature Scents',
    priceCents: 2400, imagePath: '/assets/photo-10.jpg', sortOrder: 1,
  },
  {
    seedKey: 'initial-02', name: '12 oz Signature Jar',
    description: 'Signature Scents · classic jar', category: 'Signature Scents',
    priceCents: 2200, imagePath: '/assets/photo-10.jpg', sortOrder: 2,
  },
  {
    seedKey: 'initial-03', name: '17.5 oz Statement Jar',
    description: 'Signature Scents · generous glow', category: 'Signature Scents',
    priceCents: 3000, imagePath: '/assets/photo-10.jpg', sortOrder: 3,
  },
  {
    seedKey: 'initial-04', name: 'Body Lovers Sculptural Candle',
    description: 'Body Lovers · starting price', category: 'Body Lovers',
    priceCents: 3800, imagePath: '/assets/photo-08.jpg', sortOrder: 4,
  },
  {
    seedKey: 'initial-05', name: 'Sip & Glow Creation',
    description: 'Sip & Glow · starting price', category: 'Sip & Glow',
    priceCents: 3800, imagePath: '/assets/photo-01.jpg', sortOrder: 5,
  },
  {
    seedKey: 'initial-06', name: 'Seasonal Gift Candle',
    description: 'Seasonal & Gifts · starting price', category: 'Seasonal & Gifts',
    priceCents: 3800, imagePath: '/assets/photo-11.jpg', sortOrder: 6,
  },
];

export async function seedInitialProducts(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query("SELECT value FROM app_metadata WHERE key = 'initial_catalog_seeded'");
    if (rows.length) {
      await client.query('COMMIT');
      return;
    }
    for (const product of initialProducts) {
      await client.query(
        `INSERT INTO products
          (seed_key, name, description, category, price_cents, image_path, is_available, is_published, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE, TRUE, $7)
         ON CONFLICT (seed_key) DO NOTHING`,
        [product.seedKey, product.name, product.description, product.category,
          product.priceCents, product.imagePath, product.sortOrder],
      );
    }
    await client.query("INSERT INTO app_metadata (key, value) VALUES ('initial_catalog_seeded', 'true')");
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
