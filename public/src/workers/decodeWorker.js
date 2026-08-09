importScripts('../../lib/jsqr.js');

let barcodeDetector = null;
if (typeof self.BarcodeDetector !== 'undefined') {
  try {
    barcodeDetector = new self.BarcodeDetector({ formats: ['qr_code'] });
  } catch (e) {
    barcodeDetector = null;
  }
}

self.addEventListener('message', async (event) => {
  const { data, width, height } = event.data;
  const results = [];

  try {
    // 1. Try Native BarcodeDetector (Detects MULTIPLE QRs simultaneously in one camera frame!)
    if (barcodeDetector && event.data.imageBitmap) {
      try {
        const barcodes = await barcodeDetector.detect(event.data.imageBitmap);
        if (barcodes && barcodes.length > 0) {
          for (const barcode of barcodes) {
            const cornerPoints = barcode.cornerPoints || [];
            results.push({
              data: barcode.rawValue,
              location: {
                topLeftCorner: cornerPoints[0] || { x: 0, y: 0 },
                topRightCorner: cornerPoints[1] || { x: width, y: 0 },
                bottomRightCorner: cornerPoints[2] || { x: width, y: height },
                bottomLeftCorner: cornerPoints[3] || { x: 0, y: height },
              },
            });
          }

          self.postMessage({
            success: true,
            results: results,
          });
          return;
        }
      } catch (e) {
        // Fall back to jsQR
      }
    }

    // 2. jsQR Fallback (Full frame + 4 sub-quadrants for Multi-QR)
    if (data && self.jsQR) {
      // Full Frame scan
      const mainCode = self.jsQR(data, width, height, { inversionAttempts: 'dontInvert' });
      if (mainCode && mainCode.data) {
        results.push({ data: mainCode.data, location: mainCode.location });
      }

      // Sub-quadrant scan if multi-QR tile grid
      const halfW = Math.floor(width / 2);
      const halfH = Math.floor(height / 2);

      // Helper to scan a sub-rectangle of Uint8ClampedArray
      function scanSubRect(x0, y0, w, h) {
        const subData = new Uint8ClampedArray(w * h * 4);
        for (let row = 0; row < h; row++) {
          const srcStart = ((y0 + row) * width + x0) * 4;
          const srcEnd = srcStart + w * 4;
          subData.set(data.subarray(srcStart, srcEnd), row * w * 4);
        }
        const subCode = self.jsQR(subData, w, h, { inversionAttempts: 'dontInvert' });
        if (subCode && subCode.data) {
          // Remap location back to full frame space
          const loc = subCode.location;
          results.push({
            data: subCode.data,
            location: {
              topLeftCorner: { x: loc.topLeftCorner.x + x0, y: loc.topLeftCorner.y + y0 },
              topRightCorner: { x: loc.topRightCorner.x + x0, y: loc.topRightCorner.y + y0 },
              bottomRightCorner: { x: loc.bottomRightCorner.x + x0, y: loc.bottomRightCorner.y + y0 },
              bottomLeftCorner: { x: loc.bottomLeftCorner.x + x0, y: loc.bottomLeftCorner.y + y0 },
            },
          });
        }
      }

      if (results.length === 0 || results.length < 4) {
        scanSubRect(0, 0, halfW, halfH); // Top-left
        scanSubRect(halfW, 0, halfW, halfH); // Top-right
        scanSubRect(0, halfH, halfW, halfH); // Bottom-left
        scanSubRect(halfW, halfH, halfW, halfH); // Bottom-right
      }

      if (results.length > 0) {
        self.postMessage({
          success: true,
          results: results,
        });
        return;
      }
    }

    self.postMessage({ success: false, results: [] });
  } catch (err) {
    self.postMessage({ success: false, error: err.message, results: [] });
  }
});
