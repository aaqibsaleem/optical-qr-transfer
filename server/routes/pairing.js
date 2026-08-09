import QRCode from 'qrcode';

export function setupPairingRoute(app, lanIp, port) {
  const receiverUrl = `https://${lanIp}:${port}/receiver/`;

  app.get('/api/pairing-info', (req, res) => {
    res.json({ url: receiverUrl });
  });

  app.get('/api/pairing-qr', async (req, res) => {
    try {
      const qrDataUrl = await QRCode.toDataURL(receiverUrl, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 300,
      });
      const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, '');
      const imgBuffer = Buffer.from(base64Data, 'base64');
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': imgBuffer.length,
      });
      res.end(imgBuffer);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
