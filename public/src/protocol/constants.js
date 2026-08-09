/**
 * Protocol Constants for Air-Gapped Optical QR Transfer
 * Isomorphic module - runs in Node.js and modern browsers.
 *
 * GUARANTEE: This protocol module performs NO network operations.
 */

export const MAGIC_BYTES = new Uint8Array([0x51, 0x52]); // "QR"
export const PROTOCOL_VERSION = 1;

export const FRAME_TYPES = {
  SESSION_META: 0x00,
  DATA_CHUNK: 0x01,
  FILE_META: 0x02,
};

// Fixed header size:
// Magic (2) + Version (1) + FrameType (1) + SessionId (4) + ChunkIndex (3) + TotalChunks (3) + Checksum (4) = 18 bytes
export const HEADER_SIZE = 18;

export const DEFAULT_CHUNK_SIZE = 120; // Default payload bytes per chunk
