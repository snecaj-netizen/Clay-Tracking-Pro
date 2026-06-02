/**
 * Utility to compress images in client-side using HTML5 Canvas.
 * This helps significantly reduce database storage and network egress costs (by up to 95%+).
 */

export function compressImage(
  source: File | string,
  maxWidth: number = 1024,
  maxHeight: number = 1024,
  quality: number = 0.7
): Promise<string> {
  return new Promise((resolve, reject) => {
    const processImage = (dataUrl: string) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Don't resize if it's already small
        if (width <= maxWidth && height <= maxHeight) {
          // But still re-render via canvas if needed to compress size
          if (dataUrl.length < 150 * 1024) { // Already below ~150kb, keep original
            resolve(dataUrl);
            return;
          }
        }

        // Calculate dynamic dimensions to preserve aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          resolve(dataUrl); // Fallback to uncompressed if canvas context not supported
          return;
        }

        // Handle transparency by painting a white background for JPEGs
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        
        ctx.drawImage(img, 0, 0, width, height);

        // Export as JPEG with chosen quality (JPEG has vastly superior compression for photos)
        const compressedBase65 = canvas.toDataURL('image/jpeg', quality);
        
        // If the compressed size is somehow larger than original, return original
        if (compressedBase65.length > dataUrl.length) {
          resolve(dataUrl);
        } else {
          resolve(compressedBase65);
        }
      };

      img.onerror = (err) => {
        console.error('Image compression load failed, falling back to original');
        resolve(dataUrl); // Fail-safe fallback to original image
      };

      img.src = dataUrl;
    };

    if (source instanceof File) {
      const reader = new FileReader();
      reader.onload = () => {
        processImage(reader.result as string);
      };
      reader.onerror = (err) => {
        console.error('File reader error, compiling fallback');
        reject(err);
      };
      reader.readAsDataURL(source);
    } else {
      processImage(source);
    }
  });
}
