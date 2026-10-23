import multer from 'multer';

export function errorHandler(error, _req, res, next) {
  if (res.headersSent) return next(error);
  if (error instanceof multer.MulterError) {
    const tooLarge = error.code === 'LIMIT_FILE_SIZE';
    return res.status(tooLarge ? 413 : 400).json({
      error: tooLarge ? 'Product photos must be 8 MiB or smaller.' : 'Choose one product photo and try again.',
    });
  }
  if (error.status && error.status < 500) {
    return res.status(error.status).json({ error: error.message });
  }
  if (error.message?.startsWith('Upload a JPEG')) {
    return res.status(400).json({ error: error.message });
  }
  console.error('Request failed:', error.message);
  return res.status(500).json({ error: 'Something went wrong. Please try again.' });
}
