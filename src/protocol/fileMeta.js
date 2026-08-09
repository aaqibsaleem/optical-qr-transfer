/**
 * SESSION_META and FILE_META frame payload serialization.
 * Isomorphic & dependency-free.
 */

export function packSessionMeta(totalBytes, sha256Hex, extra = {}) {
  const jsonStr = JSON.stringify({
    totalBytes,
    sha256: sha256Hex,
    ...extra,
  });
  return new TextEncoder().encode(jsonStr);
}

export function unpackSessionMeta(metaPayloadBytes) {
  const jsonStr = new TextDecoder().decode(metaPayloadBytes);
  return JSON.parse(jsonStr);
}

export function packFileMeta(fileName, mimeType, totalBytes, sha256Hex, extra = {}) {
  const jsonStr = JSON.stringify({
    fileName,
    mimeType,
    totalBytes,
    sha256: sha256Hex,
    ...extra,
  });
  return new TextEncoder().encode(jsonStr);
}

export function unpackFileMeta(metaPayloadBytes) {
  const jsonStr = new TextDecoder().decode(metaPayloadBytes);
  return JSON.parse(jsonStr);
}
