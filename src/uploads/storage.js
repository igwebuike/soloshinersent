import { randomUUID } from 'node:crypto';
import { mkdir, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { fileTypeFromFile } from 'file-type';

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function createImageUpload(uploadDir) {
  const storage = multer.diskStorage({
    destination: async (_req, _file, callback) => {
      try {
        await mkdir(uploadDir, { recursive: true });
        callback(null, uploadDir);
      } catch (error) {
        callback(error);
      }
    },
    filename: (_req, _file, callback) => callback(null, `${randomUUID()}.upload`),
  });

  return multer({
    storage,
    limits: { fileSize: MAX_IMAGE_SIZE, files: 1 },
    fileFilter: (_req, file, callback) => {
      if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
        return callback(new Error('Upload a JPEG, PNG, or WebP product photo.'));
      }
      return callback(null, true);
    },
  }).single('image');
}

export async function verifyUploadedImage(req, res, next) {
  if (!req.file) return next();
  try {
    const detected = await fileTypeFromFile(req.file.path);
    if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime) || detected.mime !== req.file.mimetype) {
      await unlink(req.file.path).catch(() => {});
      return res.status(400).json({ error: 'That file is not a supported image. Choose a JPEG, PNG, or WebP photo.' });
    }
    const generatedName = `${path.parse(req.file.filename).name}.${detected.ext === 'jpeg' ? 'jpg' : detected.ext}`;
    const finalPath = path.join(path.dirname(req.file.path), generatedName);
    await rename(req.file.path, finalPath);
    req.file.filename = generatedName;
    req.file.path = finalPath;
    req.file.publicPath = `/uploads/${generatedName}`;
    return next();
  } catch (error) {
    await unlink(req.file.path).catch(() => {});
    return next(error);
  }
}

export async function deleteUploadedImage(imagePath, uploadDir) {
  if (typeof imagePath !== 'string' || !imagePath.startsWith('/uploads/')) return;
  const filename = imagePath.slice('/uploads/'.length);
  if (!/^[a-f0-9-]+\.(?:jpg|png|webp)$/.test(filename)) return;
  const root = path.resolve(uploadDir);
  const target = path.resolve(root, filename);
  if (!target.startsWith(`${root}${path.sep}`)) return;
  await unlink(target).catch(error => {
    if (error.code !== 'ENOENT') throw error;
  });
}
