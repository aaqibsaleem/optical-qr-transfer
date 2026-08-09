/**
 * Splits a byte buffer into ordered chunks of fixed size.
 */

export function chunkBuffer(uint8Array, chunkSize) {
  if (chunkSize <= 0) {
    throw new Error("Chunk size must be greater than 0");
  }

  if (uint8Array.length === 0) {
    return [new Uint8Array(0)];
  }

  const chunks = [];
  for (let offset = 0; offset < uint8Array.length; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, uint8Array.length);
    chunks.push(uint8Array.subarray(offset, end));
  }

  return chunks;
}
