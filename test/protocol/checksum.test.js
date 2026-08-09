import { describe, it, expect } from 'vitest';
import { crc32, sha256Hex } from '../../src/protocol/checksum.js';

describe('Checksum (CRC32 & SHA-256)', () => {
  it('calculates expected CRC32 for known input "123456789"', () => {
    const input = new TextEncoder().encode('123456789');
    const checksum = crc32(input);
    expect(checksum).toBe(0xcbf43926 >>> 0);
  });

  it('calculates correct SHA-256 hex string', async () => {
    const input = new TextEncoder().encode('Hello World!');
    const sha = await sha256Hex(input);
    expect(sha).toBe('7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069');
  });
});
