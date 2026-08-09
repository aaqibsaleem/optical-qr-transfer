# System Architecture & Technical Specifications

## 1. Guiding Design Invariant

```
               ┌─────────────────────────────────────────┐
               │         PC / Sender Display             │
               └────────────────────┬────────────────────┘
                                    │
                         OPTICAL CHANNEL ONLY
                        (Cycling QR Code Stream)
                                    │
                                    ▼
               ┌─────────────────────────────────────────┐
               │      Mobile Browser / Camera Scan       │
               └────────────────────┬────────────────────┘
                                    │
                          ZERO NETWORK CALLS
                (Local Reassembly & SHA-256 Check)
```

> **Zero-Network Invariant**: The network delivers static application assets (`HTML`/`JS`/`CSS`) during page load. The data payload travels **100% physically through the optical QR stream**. The receiver page invokes zero `fetch`, `XMLHttpRequest`, or `WebSocket` calls for payload state or acknowledgements.

---

## 2. System Component Topology

```mermaid
graph TD
    subgraph PC Sender Platform
        A[User Input / File Buffer] --> B[Uint8Array Chunker]
        B --> C[Isomorphic Frame Encoder]
        C --> D[Base45 Packager]
        D --> E[Multi-QR Layout Engine 1x1/2x1/2x2]
        E --> F[HTML5 Canvas Stream Loop]
    end

    subgraph Optical Air-Gap
        F -. "Rapid Animated QR Stream (2-20 FPS)" .-> G[Camera Lens]
    end

    subgraph Mobile Receiver Platform
        G --> H[getUserMedia Video Feed]
        H --> I[Web Worker Off-Thread Decoder]
        I --> J[BarcodeDetector / jsQR Engine]
        J --> K[Isomorphic Frame Unpacker & CRC32 Filter]
        K --> L[Bitmap Bitset Chunk Tracker]
        L --> M[Out-of-Order Reassembler]
        M --> N[SHA-256 End-to-End Digest Verification]
        N --> O[Blob Preview & Download Manager]
    end
```

---

## 3. Optical Multi-QR Grid Throughput Analysis

To overcome single-QR density limitations, the system supports Multi-QR Grid Tiling (`1x1`, `2x1`, `2x2`):

| Layout | QRs per Frame | Target FPS | Bytes/Chunk | Raw Throughput | Relative Speedup |
|:---|:---|:---|:---|:---|:---|
| **1x1 Standard** | 1 | 8 FPS | 120 B | 960 B/s (~0.96 KB/s) | 1.0x Baseline |
| **2x1 Dual Grid** | 2 | 10 FPS | 120 B | 2,400 B/s (~2.4 KB/s) | 2.5x |
| **2x2 Quad Grid** | 4 | 12 FPS | 120 B | 5,760 B/s (~5.76 KB/s) | **6.0x Multiplier** |
| **2x2 Aggressive** | 4 | 15 FPS | 250 B | 15,000 B/s (~15 KB/s) | **15.6x Multiplier** |

---

## 4. Multi-Threaded Scanning Pipeline

```mermaid
sequenceDiagram
    autonumber
    participant UI as Receiver UI Thread
    participant Worker as Web Worker Thread
    participant Decoder as BarcodeDetector / jsQR

    UI->>UI: Capture canvas frame from getUserMedia
    UI->>UI: createImageBitmap(imageData)
    UI->>Worker: postMessage({ data, width, height, imageBitmap }, [imageBitmap])
    Worker->>Decoder: Native BarcodeDetector.detect(imageBitmap)
    alt BarcodeDetector Success
        Decoder-->>Worker: Return array of detected QR codes
    else Fallback to jsQR
        Worker->>Decoder: jsQR(data, width, height) + quadrant crops
        Decoder-->>Worker: Return decoded QR strings
    end
    Worker-->>UI: postMessage({ success: true, results: [...] })
    UI->>UI: Draw cyan bounding boxes over camera feed
    UI->>UI: Feed QR strings into Reassembler
    UI->>UI: Update bitmap & progress grid
```

---

## 5. Security & Verification Guarantees

1. **Air-Gapped Isolation**: Data payload cannot be intercepted over Wi-Fi or LAN because no packets are sent.
2. **Per-Frame Integrity**: Any frame corrupted by lens reflection or motion blur is instantly dropped via binary CRC32 checksum validation.
3. **End-to-End Payload Authenticity**: Complete payload is validated against a 256-bit SHA-256 digest before rendering or enabling file downloads.
