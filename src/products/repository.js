const RETURNING = `
  id, name, description, category, price_cents AS "priceCents",
  image_path AS "imagePath", is_available AS "isAvailable",
  is_published AS "isPublished", created_at AS "createdAt",
  updated_at AS "updatedAt", sort_order AS "sortOrder"`;

export async function listPublishedProducts(pool) {
  const { rows } = await pool.query(
    `SELECT ${RETURNING} FROM products WHERE is_published = TRUE ORDER BY sort_order, created_at DESC`,
  );
  return rows;
}

export async function listAdminProducts(pool) {
  const { rows } = await pool.query(
    `SELECT ${RETURNING} FROM products ORDER BY sort_order, updated_at DESC`,
  );
  return rows;
}

export async function getProduct(pool, id) {
  const { rows } = await pool.query(`SELECT ${RETURNING} FROM products WHERE id = $1`, [id]);
  return rows[0] || null;
}

export async function createProduct(pool, product) {
  const { rows } = await pool.query(
    `INSERT INTO products
      (name, description, category, price_cents, image_path, is_available, is_published, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${RETURNING}`,
    [product.name, product.description, product.category, product.priceCents,
      product.imagePath, product.isAvailable, product.isPublished, product.sortOrder],
  );
  return rows[0];
}

export async function updateProduct(pool, id, product, { preserveImage = false } = {}) {
  const { rows } = await pool.query(
    `UPDATE products SET
       name = $2, description = $3, category = $4, price_cents = $5,
       image_path = CASE WHEN $10 THEN image_path ELSE $6 END,
       is_available = $7, is_published = $8,
       sort_order = $9, updated_at = NOW()
     WHERE id = $1 RETURNING ${RETURNING}`,
    [id, product.name, product.description, product.category, product.priceCents,
      product.imagePath, product.isAvailable, product.isPublished, product.sortOrder, preserveImage],
  );
  return rows[0] || null;
}

export async function setProductPublished(pool, id, published) {
  const { rows } = await pool.query(
    `UPDATE products SET is_published = $2, updated_at = NOW() WHERE id = $1 RETURNING ${RETURNING}`,
    [id, published],
  );
  return rows[0] || null;
}

export async function deleteProduct(pool, id) {
  const { rows } = await pool.query(`DELETE FROM products WHERE id = $1 RETURNING ${RETURNING}`, [id]);
  return rows[0] || null;
}
