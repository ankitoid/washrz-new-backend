import sharp from 'sharp';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

/**
 * Compress an image buffer if it exceeds the maximum size.
 * @param {Object} file - Multer file object { buffer, mimetype, size, ... }
 * @returns {Promise<{ buffer: Buffer, mimetype: string }>}
 */
export const compressImageIfNeeded = async (file) => {
  const { buffer, mimetype, size } = file;

  // If already under the limit, return the original
  if (size <= MAX_FILE_SIZE) {
    return { buffer, mimetype };
  }

  const image = sharp(buffer);
  const metadata = await image.metadata();

  // Determine output format – we keep the original if JPEG, else convert to JPEG for better compression
  let outputFormat = 'jpeg';
  if (mimetype === 'image/jpeg') outputFormat = 'jpeg';
  else if (mimetype === 'image/png') outputFormat = 'png';   // keep PNG but compress
  else if (mimetype === 'image/webp') outputFormat = 'webp';
  // (fallback: JPEG)

  let quality = 80;
  let maxWidth = 1920;
  let maxHeight = 1920;
  let compressedBuffer = buffer;
  let compressedMimeType = mimetype;
  let success = false;

  // Try up to 5 attempts, lowering quality and/or dimensions each time
  for (let attempt = 0; attempt < 5; attempt++) {
    let processed = image.clone();

    // Resize if the image is larger than the current max dimension
    if (metadata.width > maxWidth || metadata.height > maxHeight) {
      processed = processed.resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Apply format‑specific compression
    if (outputFormat === 'jpeg') {
      processed = processed.jpeg({ quality, mozjpeg: true });
    } else if (outputFormat === 'webp') {
      processed = processed.webp({ quality });
    } else if (outputFormat === 'png') {
      // PNG uses compression level (0‑9)
      processed = processed.png({ compressionLevel: 9 });
    }

    compressedBuffer = await processed.toBuffer();

    if (compressedBuffer.length <= MAX_FILE_SIZE) {
      success = true;
      compressedMimeType =
        outputFormat === 'jpeg' ? 'image/jpeg' :
        outputFormat === 'webp' ? 'image/webp' : 'image/png';
      break;
    }

    // If still too large, reduce quality or dimensions for the next attempt
    if (outputFormat === 'jpeg' || outputFormat === 'webp') {
      quality -= 20;
      if (quality < 10) {
        quality = 60;              // reset quality
        maxWidth = Math.floor(maxWidth * 0.8);
        maxHeight = Math.floor(maxHeight * 0.8);
      }
    } else { // PNG: reduce dimensions instead
      maxWidth = Math.floor(maxWidth * 0.8);
      maxHeight = Math.floor(maxHeight * 0.8);
      if (maxWidth < 200) break;
    }
  }

  if (!success) {
    console.warn('Could not compress image below 2 MB – using best effort.');
  }

  return { buffer: compressedBuffer, mimetype: compressedMimeType };
};