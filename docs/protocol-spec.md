# Protocol Specification — Optical QR Transfer Protocol (OQTP v1)

## 1. Frame Binary Format

All frames consist of a fixed **18-byte binary header** followed by variable payload bytes. The combined binary block is encoded into a Base45 string per RFC 9285 for alphanumeric QR embedding.

### 18-Byte Header Structure

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|          MAGIC (0x5152)       |  VER (0x01)   | TYPE (0x00..2)|
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                       SESSION_ID (32-bit)                     |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                 CHUNK_INDEX (24-bit uint)                     |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                 TOTAL_CHUNKS (24-bit uint)                    |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                   PAYLOAD_CRC32 (32-bit uint)                 |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                       PAYLOAD (Variable)                      |
|                               ...                             |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

| Offset (Bytes) | Field | Type | Description |
|:---|:---|:---|:---|
| `0..1` | `MAGIC` | Uint8[2] | Protocol signature ASCII `"QR"` (`0x51`, `0x52`) |
| `2` | `VERSION` | Uint8 | Protocol version integer (starts at `0x01`) |
| `3` | `FRAME_TYPE` | Uint8 | `0x00 SESSION_META`, `0x01 DATA_CHUNK`, `0x02 FILE_META` |
| `4..7` | `SESSION_ID` | Uint32 (BE) | Random 32-bit session identifier |
| `8..10` | `CHUNK_INDEX` | Uint24 (BE) | 0-based chunk index |
| `11..13` | `TOTAL_CHUNKS` | Uint24 (BE) | Total data chunks in session |
| `14..17` | `PAYLOAD_CRC32` | Uint32 (BE) | ISO 3309 CRC32 checksum of payload bytes |
| `18..` | `PAYLOAD` | Uint8Array | Frame payload bytes |

---

## 2. Frame Types

### Type `0x00` — `SESSION_META`
Broadcast cyclically alongside data chunks. Contains session parameters encoded as JSON:
```json
{
  "totalBytes": 1024,
  "sha256": "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069"
}
```

### Type `0x01` — `DATA_CHUNK`
Contains raw payload bytes for `CHUNK_INDEX`. Verified against `PAYLOAD_CRC32` on unpack.

### Type `0x02` — `FILE_META`
Broadcast cyclically for file transfers. Contains extended file metadata:
```json
{
  "fileName": "photo.jpg",
  "mimeType": "image/jpeg",
  "totalBytes": 45210,
  "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```

---

## 3. Base45 Encoding (RFC 9285)

Binary frames are encoded using Base45 before rendering to QR codes in **Alphanumeric Mode**.

- **Alphabet**: `0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:` (45 chars)
- **Efficiency**: 2 binary bytes $\rightarrow$ 3 Base45 characters (5.5 bits/char).
- **Advantage over Base64**: Fits into standard QR Alphanumeric mode, achieving ~20% higher data density per QR code.
