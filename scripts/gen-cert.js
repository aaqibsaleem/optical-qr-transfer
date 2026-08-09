import path from 'path';
import { fileURLToPath } from 'url';
import { getOrGenerateCert } from '../server/https-cert.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const { lanIp } = getOrGenerateCert(rootDir);
console.log(`Self-signed certificate generated/cached successfully for LAN IP: ${lanIp}`);
