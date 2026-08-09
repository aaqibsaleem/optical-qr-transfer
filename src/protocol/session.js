/**
 * Random session id generation.
 * Generates a 32-bit unsigned integer session ID.
 */

export function generateSessionId() {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return array[0] >>> 0;
  }
  // Math.random fallback for Node or environments without subtle crypto
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}
