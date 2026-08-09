import fs from 'fs';
import path from 'path';
import os from 'os';
import selfsigned from 'selfsigned';

export function getLanIp() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const name of Object.keys(interfaces)) {
    // Skip virtual or VPN interfaces if possible
    const lowerName = name.toLowerCase();
    if (lowerName.includes('tailscale') || lowerName.includes('docker') || lowerName.includes('vethernet') || lowerName.includes('vmnet')) {
      continue;
    }

    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const ip = iface.address;
        // Prioritize standard local LAN ranges: 192.168.x.x, 10.x.x.x, 172.16-31.x.x
        if (ip.startsWith('192.168.')) {
          return ip; // Top priority: typical home/office Wi-Fi LAN IP
        }
        if (ip.startsWith('10.') && !ip.startsWith('100.')) {
          candidates.unshift(ip);
        } else if (ip.startsWith('172.')) {
          candidates.push(ip);
        } else {
          candidates.push(ip);
        }
      }
    }
  }

  if (candidates.length > 0) {
    return candidates[0];
  }

  // Fallback scan without interface name filtering if no standard candidate found
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }

  return '127.0.0.1';
}

export function getOrGenerateCert(rootDir) {
  const certDir = path.join(rootDir, 'certs');
  const keyPath = path.join(certDir, 'server.key');
  const certPath = path.join(certDir, 'server.crt');

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    return {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
      lanIp: getLanIp(),
    };
  }

  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir, { recursive: true });
  }

  const lanIp = getLanIp();
  const attrs = [{ name: 'commonName', value: lanIp }];
  const altNames = [
    { type: 2, value: 'localhost' },
    { type: 7, ip: lanIp },
    { type: 7, ip: '127.0.0.1' },
  ];

  const pems = selfsigned.generate(attrs, {
    keySize: 2048,
    days: 365,
    algorithm: 'sha256',
    extensions: [{ name: 'subjectAltName', altNames }],
  });

  fs.writeFileSync(keyPath, pems.private);
  fs.writeFileSync(certPath, pems.cert);

  return {
    key: pems.private,
    cert: pems.cert,
    lanIp,
  };
}
