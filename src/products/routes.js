import express from 'express';
import { requireAdmin } from '../auth/require-admin.js';
import { deleteProduct, getProduct, listAdminProducts, listPublishedProducts, createProduct, setProductPublished, updateProduct } from './repository.js';
import { validateProduct } from './validation.js';
import { createImageUpload, deleteUploadedImage, verifyUploadedImage } from '../uploads/storage.js';

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function validId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function asPublished(value) {
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return null;
}

export function createProductRouter({ pool, uploadDir }) {
  const router = express.Router();
  const upload = createImageUpload(uploadDir);
  const uploadPhoto = [upload, verifyUploadedImage];

  router.get('/products', asyncRoute(async (_req, res) => {
    res.json(await listPublishedProducts(pool));
  }));

  router.get('/admin/products', requireAdmin, asyncRoute(async (_req, res) => {
    res.json(await listAdminProducts(pool));
  }));

  router.post('/admin/products', requireAdmin, ...uploadPhoto, asyncRoute(async (req, res) => {
    const checked = validateProduct({ ...req.body, imagePath: req.file?.publicPath });
    if (Object.keys(checked.errors).length) {
      if (req.file) await deleteUploadedImage(req.file.publicPath, uploadDir);
      return res.status(400).json({ error: 'Check the highlighted product details.', fieldErrors: checked.errors });
    }
    let created;
    try {
      created = await createProduct(pool, checked.value);
    } catch (error) {
      if (req.file) await deleteUploadedImage(req.file.publicPath, uploadDir);
      throw error;
    }
    return res.status(201).json(created);
  }));

  router.patch('/admin/products/:id/publication', requireAdmin, asyncRoute(async (req, res) => {
    const id = validId(req.params.id);
    const isPublished = asPublished(req.body?.isPublished);
    if (!id || isPublished === null) return res.status(400).json({ error: 'Choose whether the product should be published.' });
    const product = await setProductPublished(pool, id, isPublished);
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    return res.json(product);
  }));

  router.patch('/admin/products/:id', requireAdmin, ...uploadPhoto, asyncRoute(async (req, res) => {
    const id = validId(req.params.id);
    if (!id) {
      if (req.file) await deleteUploadedImage(req.file.publicPath, uploadDir);
      return res.status(404).json({ error: 'Product not found.' });
    }
    let previous;
    let checked;
    let updated;
    try {
      previous = await getProduct(pool, id);
    } catch (error) {
      if (req.file) await deleteUploadedImage(req.file.publicPath, uploadDir);
      throw error;
    }
    if (!previous) {
      if (req.file) await deleteUploadedImage(req.file.publicPath, uploadDir);
      return res.status(404).json({ error: 'Product not found.' });
    }
    checked = validateProduct({ ...req.body, imagePath: req.file?.publicPath || previous.imagePath });
    if (Object.keys(checked.errors).length) {
      if (req.file) await deleteUploadedImage(req.file.publicPath, uploadDir);
      return res.status(400).json({ error: 'Check the highlighted product details.', fieldErrors: checked.errors });
    }
    try {
      updated = await updateProduct(pool, id, checked.value, { preserveImage: !req.file });
    } catch (error) {
      if (req.file) await deleteUploadedImage(req.file.publicPath, uploadDir);
      throw error;
    }
    if (!updated) {
      if (req.file) await deleteUploadedImage(req.file.publicPath, uploadDir);
      return res.status(404).json({ error: 'Product not found.' });
    }
    if (req.file && previous.imagePath !== updated.imagePath) {
      await deleteUploadedImage(previous.imagePath, uploadDir);
    }
    return res.json(updated);
  }));

  router.delete('/admin/products/:id', requireAdmin, asyncRoute(async (req, res) => {
    const id = validId(req.params.id);
    if (!id) return res.status(404).json({ error: 'Product not found.' });
    const deleted = await deleteProduct(pool, id);
    if (!deleted) return res.status(404).json({ error: 'Product not found.' });
    await deleteUploadedImage(deleted.imagePath, uploadDir);
    return res.sendStatus(204);
  }));

  return router;
}
