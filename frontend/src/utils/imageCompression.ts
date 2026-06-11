// imageCompression.ts
// Canvas-based image compression.  Runs 100% in the browser — no external libs.
//
// compressFile   — takes a File object (from <input type="file">)
// compressBase64 — takes an existing base64 string (comment image preview)

const DEFAULT_MAX_WIDTH = 1024;   // post images — nice and sharp
const COMMENT_MAX_WIDTH = 600;    // comment thumbnails — smaller
const QUALITY          = 0.78;    // 78% JPEG quality — great balance of size/clarity

/** Compress a File from an <input> and return a base64 JPEG string. */
export const compressFile = (
  file: File,
  maxWidth = DEFAULT_MAX_WIDTH,
  quality  = QUALITY,
): Promise<string> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale    = Math.min(1, maxWidth / img.width);
      const canvas   = document.createElement('canvas');
      canvas.width   = Math.round(img.width  * scale);
      canvas.height  = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };

    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image load failed')); };
    img.src = objectUrl;
  });

/** Compress a base64 string (e.g. from FileReader) and return a smaller base64 JPEG. */
export const compressBase64 = (
  base64: string,
  maxWidth = COMMENT_MAX_WIDTH,
  quality  = QUALITY,
): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale    = Math.min(1, maxWidth / img.width);
      const canvas   = document.createElement('canvas');
      canvas.width   = Math.round(img.width  * scale);
      canvas.height  = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = base64;
  });
