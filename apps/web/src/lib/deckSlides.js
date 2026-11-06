export const TEXT_DECK_SCHEMA = 'phioffice369.phideck_lite.v0.1';
export const VISUAL_DECK_SCHEMA = 'phioffice369.phideck_lite.v0.2';
export const DECK_LAYOUTS = Object.freeze({
  content: 'Title and bullets', cover: 'Centered cover', 'image-left': 'Image left', 'image-right': 'Image right',
});
export const DECK_SHAPES = Object.freeze({ none: 'None', circle: 'Circle', square: 'Square', line: 'Accent bar' });
export const DECK_LIMITS = Object.freeze({ slides: 100, fileBytes: 4 * 1024 * 1024, imageBytes: 384 * 1024, mediaChars: 2 * 1024 * 1024 });

function rasterInfo(bytes) {
  const byte = (offset) => bytes.charCodeAt(offset);
  const be16 = (offset) => byte(offset) * 256 + byte(offset + 1);
  const le24 = (offset) => byte(offset) + byte(offset + 1) * 256 + byte(offset + 2) * 65536;
  const be32 = (offset) => be16(offset) * 65536 + be16(offset + 2);
  if (bytes.startsWith('\x89PNG\r\n\x1a\n') && bytes.slice(12, 16) === 'IHDR') {
    return { type: 'png', width: be32(16), height: be32(20) };
  }
  if (bytes.startsWith('\xff\xd8')) {
    let offset = 2;
    while (offset + 3 < bytes.length && byte(offset++) === 255) {
      while (byte(offset) === 255) offset += 1;
      const marker = byte(offset++);
      if (marker === 218 || marker === 217) break;
      const size = be16(offset);
      if (size < 2 || offset + size > bytes.length) break;
      const isFrame = marker >= 192 && marker <= 207 && ![196, 200, 204].includes(marker);
      if (isFrame && size >= 8) return { type: 'jpeg', width: be16(offset + 5), height: be16(offset + 3) };
      offset += size;
    }
  }
  if (bytes.startsWith('RIFF') && bytes.slice(8, 12) === 'WEBP') {
    const chunk = bytes.slice(12, 16);
    if (chunk === 'VP8X') return { type: 'webp', width: le24(24) + 1, height: le24(27) + 1 };
    if (chunk === 'VP8L' && byte(20) === 47 && bytes.length >= 25) {
      return { type: 'webp', width: 1 + byte(21) + (byte(22) & 63) * 256,
        height: 1 + (byte(22) >> 6) + byte(23) * 4 + (byte(24) & 15) * 1024 };
    }
    if (chunk === 'VP8 ' && bytes.slice(23, 26) === '\x9d\x01\x2a' && bytes.length >= 30) {
      return { type: 'webp', width: byte(26) + (byte(27) & 63) * 256, height: byte(28) + (byte(29) & 63) * 256 };
    }
  }
  return null;
}

function boundedRaster(info) {
  return info && info.width > 0 && info.height > 0 && info.width <= 4096 && info.height <= 4096;
}

export function isSlideImage(image) {
  if (!image || typeof image.src !== 'string' || typeof image.alt !== 'string' || image.alt.length > 240) return false;
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image.src);
  if (!match || match[2].length > Math.ceil(DECK_LIMITS.imageBytes / 3) * 4) return false;
  try {
    const info = rasterInfo(atob(match[2]));
    return Boolean(boundedRaster(info) && info.type === match[1]);
  } catch {
    return false;
  }
}

export async function readSlideImage(file) {
  if (file.size > DECK_LIMITS.imageBytes) throw new Error('Choose a PNG, JPEG or WebP image smaller than 384 KiB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const parts = [];
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    parts.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)));
  }
  const binary = parts.join('');
  const info = rasterInfo(binary);
  if (!info) throw new Error('The image must be a PNG, JPEG or WebP file.');
  if (!boundedRaster(info)) throw new Error('Choose an image up to 4096 by 4096 pixels.');
  const mime = `image/${info.type}`;
  const bitmap = await createImageBitmap(new Blob([bytes], { type: mime }));
  bitmap.close();
  return { src: `data:${mime};base64,${btoa(binary)}`, alt: '' };
}

export function isSupportedSlide(slide) {
  return Boolean(slide && typeof slide.id === 'string' && slide.id &&
    typeof slide.title === 'string' && Array.isArray(slide.bullets) && slide.bullets.every((line) => typeof line === 'string') &&
    (slide.layout == null || typeof slide.layout === 'string' && Object.hasOwn(DECK_LAYOUTS, slide.layout)) &&
    (slide.shape == null || typeof slide.shape === 'string' && Object.hasOwn(DECK_SHAPES, slide.shape)) &&
    (slide.image == null || isSlideImage(slide.image)));
}

export function deckMediaSize(slides) {
  return slides.reduce((sum, slide) => sum + (typeof slide.image?.src === 'string' ? slide.image.src.length : 0), 0);
}

export function deckSchemaForSlides(slides) {
  return slides.some((slide) => slide.image || slide.layout && slide.layout !== 'content' || slide.shape && slide.shape !== 'none')
    ? VISUAL_DECK_SCHEMA : TEXT_DECK_SCHEMA;
}
