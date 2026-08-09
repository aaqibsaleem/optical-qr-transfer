/**
 * Hand-rolled Base45 Encoder/Decoder (RFC 9285)
 * Isomorphic & dependency-free.
 *
 * Base45 uses a 45-character alphabet:
 * 0-9, A-Z, space, $, %, *, +, -, ., /, :
 */

const BASE45_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
const BASE45_DECODE_MAP = new Map();
for (let i = 0; i < BASE45_CHARSET.length; i++) {
  BASE45_DECODE_MAP.set(BASE45_CHARSET[i], i);
}

export function encodeBase45(uint8Array) {
  let result = '';
  const len = uint8Array.length;
  let i = 0;

  for (; i < len - 1; i += 2) {
    const val = (uint8Array[i] << 8) + uint8Array[i + 1];
    const c1 = val % 45;
    const c2 = Math.floor(val / 45) % 45;
    const c3 = Math.floor(val / (45 * 45)) % 45;
    result += BASE45_CHARSET[c1] + BASE45_CHARSET[c2] + BASE45_CHARSET[c3];
  }

  if (i < len) {
    const val = uint8Array[i];
    const c1 = val % 45;
    const c2 = Math.floor(val / 45) % 45;
    result += BASE45_CHARSET[c1] + BASE45_CHARSET[c2];
  }

  return result;
}

export function decodeBase45(str) {
  if (str.length % 3 === 1) {
    throw new Error("Invalid Base45 string length");
  }

  const out = [];
  let i = 0;
  const len = str.length;

  for (; i < len; i += 3) {
    if (i + 2 < len) {
      const v1 = BASE45_DECODE_MAP.get(str[i]);
      const v2 = BASE45_DECODE_MAP.get(str[i + 1]);
      const v3 = BASE45_DECODE_MAP.get(str[i + 2]);

      if (v1 === undefined || v2 === undefined || v3 === undefined) {
        throw new Error(`Invalid Base45 character at position ${i}`);
      }

      const val = v1 + v2 * 45 + v3 * 45 * 45;
      if (val > 0xffff) {
        throw new Error("Base45 value overflow");
      }
      out.push((val >> 8) & 0xff);
      out.push(val & 0xff);
    } else {
      // 2 remaining chars -> 1 byte
      const v1 = BASE45_DECODE_MAP.get(str[i]);
      const v2 = BASE45_DECODE_MAP.get(str[i + 1]);

      if (v1 === undefined || v2 === undefined) {
        throw new Error(`Invalid Base45 character at position ${i}`);
      }

      const val = v1 + v2 * 45;
      if (val > 0xff) {
        throw new Error("Base45 value overflow on tail");
      }
      out.push(val & 0xff);
    }
  }

  return new Uint8Array(out);
}
