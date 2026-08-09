import express from 'express';
import https from 'https';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { getOrGenerateCert } from './https-cert.js';
import { setupPairingRoute } from './routes/pairing.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const app = express();
const PORT = process.env.PORT || 3443;
const HTTP_PORT = process.env.HTTP_PORT || 3080;

app.use(express.static(path.join(rootDir, 'public')));
app.use('/src', express.static(path.join(rootDir, 'src')));
app.use('/lib', express.static(path.join(rootDir, 'lib')));

app.get('/favicon.ico', (req, res) => res.status(204).end());

let certs;
try {
  certs = getOrGenerateCert(rootDir);
} catch (e) {
  console.warn('Failed to load/generate HTTPS cert:', e.message);
}

setupPairingRoute(app, certs ? certs.lanIp : 'localhost', PORT);

// Default route redirects to sender
app.get('/', (req, res) => {
  res.redirect('/sender/');
});

if (certs) {
  const httpsServer = https.createServer({ key: certs.key, cert: certs.cert }, app);
  httpsServer.listen(PORT, '0.0.0.0', () => {
    console.log(`\n==================================================`);
    console.log(`🔒 HTTPS Server running at:`);
    console.log(`   - Localhost: https://localhost:${PORT}/sender/`);
    console.log(`   - LAN IP:    https://${certs.lanIp}:${PORT}/sender/`);
    console.log(`📱 Phone Receiver URL: https://${certs.lanIp}:${PORT}/receiver/`);
    console.log(`==================================================\n`);
  });
} else {
  const httpServer = http.createServer(app);
  httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`⚠️ HTTP Server running at http://localhost:${HTTP_PORT}/sender/`);
  });
}
