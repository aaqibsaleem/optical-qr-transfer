import { describe, it, expect } from 'vitest';
import { encodeBase45, decodeBase45 } from '../../src/protocol/base45.js';

describe('Base45 Encoder / Decoder', () => {
  it('encodes and decodes simple string "Hello World!"', () => {
    const original = new TextEncoder().encode('Hello World!');
    const encoded = encodeBase45(original);
    const decoded = decodeBase45(encoded);
    expect(new TextDecoder().decode(decoded)).toBe('Hello World!');
  });

  it('handles 0-byte, 1-byte, and 2-byte tail lengths', () => {
    const bytes1 = new Uint8Array([0x41]);
    const encoded1 = encodeBase45(bytes1);
    expect(decodeBase45(encoded1)).toEqual(bytes1);

    const bytes2 = new Uint8Array([0x41, 0x42]);
    const encoded2 = encodeBase45(bytes2);
    expect(decodeBase45(encoded2)).toEqual(bytes2);

    const bytes3 = new Uint8Array([0x41, 0x42, 0x43]);
    const encoded3 = encodeBase45(bytes3);
    expect(decodeBase45(encoded3)).toEqual(bytes3);
  });

  it('throws on invalid character during decode', () => {
    expect(() => decodeBase45('!!!')).toThrow();
  });
});
