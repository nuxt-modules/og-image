---
name: napi-rs-image-skilld
description: "ALWAYS use when writing code importing \"@napi-rs/image\". Consult for debugging, best practices, or modifying @napi-rs/image, napi-rs/image, napi-rs image, napi rs image."
metadata:
  version: 1.12.0
  generated_by: Claude Code · Haiku 4.5
  generated_at: 2026-03-12
---

# @napi-rs/image

**Version:** 1.12.0 (Dec 2025)
**Tags:** latest: 1.12.0 (Dec 2025)

**References:** [package.json](./.skilld/pkg/package.json) — exports, entry points • [README](./.skilld/pkg/README.md) — setup, basic usage

## Search

Use `skilld search` instead of grepping `.skilld/` directories — hybrid semantic + keyword search across all indexed docs, issues, and releases. If `skilld` is unavailable, use `npx -y skilld search`.

```bash
skilld search "query" -p @napi-rs/image
```

Filters: `docs:`, `issues:`, `releases:` prefix narrows by source type.

<!-- skilld:api-changes -->
## API Changes

This section documents version-specific API changes for @napi-rs/image. The package is currently at v1.12.0.

- BREAKING: `resize(widthOrOptions, height?, filter?, fit?)` — v1.12 added overload accepting `ResizeOptions` object as first parameter and added `fit` parameter. Old positional parameter `filterType` renamed to `filter`. Code using old positional args still works but `fit` parameter was added (see `ResizeOptions` interface) [source](./.skilld/pkg/index.d.ts:L29)

- BREAKING: `overlay(onTop: Uint8Array, ...)` — v1.12+ changed parameter type from `Buffer` to `Uint8Array`. Affects callers passing Buffer objects [source](./.skilld/pkg/index.d.ts:L76)

- REMOVED: `CompressionType.Huffman` — no longer available in v1.12.0. README documents it but type definitions do not expose it [source](./.skilld/pkg/index.d.ts:L173:180)

- REMOVED: `CompressionType.Rle` — no longer available in v1.12.0. README documents it but type definitions do not expose it [source](./.skilld/pkg/index.d.ts:L173:180)

- REMOVED: `PNGLosslessOptions.useHeuristics` — not present in v1.12.0. README documents this boolean option but it does not appear in the actual interface [source](./.skilld/pkg/index.d.ts:L319:360)

- NEW: `FastResizeOptions` interface — v1.12 introduced dedicated `FastResizeOptions` object type for the `fastResize()` method, supporting `width`, `height`, `filter`, and `fit` parameters [source](./.skilld/pkg/index.d.ts:L226:231)

- NEW: `fastResize(options: FastResizeOptions)` — v1.12 added faster SIMD-based resize method as alternative to `resize()`. Uses different filter algorithms via `FastResizeFilter` enum [source](./.skilld/pkg/index.d.ts:L38)

- NEW: `FastResizeFilter` enum — v1.12 introduced alternative filter types for fast resizing: `Box`, `Bilinear`, `Hamming`, `CatmulRom`, `Mitchell`, `Lanczos3` [source](./.skilld/pkg/index.d.ts:L186:224)

**Also changed:** `Transformer.fromSvg()` accepts optional `background` color parameter · `PngEncodeOptions` type available for PNG encoding · `ResizeOptions` interface available for flexible resize parameters
<!-- /skilld:api-changes -->

<!-- skilld:best-practices -->
## Best Practices

- Chain Transformer methods for efficient image processing — all manipulation methods return `this` enabling fluent composition and single-pass encoding without intermediate allocations [source](./.skilld/pkg/README.md#manipulate-image)

- Always call `metadata(withExif: true)` before processing JPEG/TIFF files — extracts EXIF orientation to prevent rotated images when the source has embedded orientation data [source](./.skilld/pkg/README.md#metadata)

- Call `rotate()` before resize/encoding to respect EXIF orientation — transforms pixel data in-place rather than relying on browser CSS transforms which don't affect the actual image bytes [source](./.skilld/pkg/README.md#rotate)

- Use `fastResize()` over `resize()` for real-time operations — SIMD-accelerated implementation with different filter algorithms, significantly faster at the cost of slightly different quality characteristics [source](./.skilld/pkg/index.d.ts:L37:L38)

- Choose resize filters based on tradeoff requirements — Nearest for upscaling (31ms), Triangle/Hamming for balanced quality (414ms), CatmullRom/Lanczos3 for maximum quality but slowest (817-1170ms on test image) [source](./.skilld/pkg/README.md#resizefiltertype)

- Set `chromaSubsampling: ChromaSubsampling.Yuv420` for AVIF encoding when file size matters — reduces bandwidth by subsampling chroma while maintaining perceived quality [source](./.skilld/pkg/README.md#avif)

- Enable MozJPEG scan optimization via `optimizeScans: true` (default) when compressing existing JPEG — makes progressive files significantly smaller without quality loss [source](./.skilld/pkg/README.md#optimize-jpeg)

- Use `useHeuristics: true` with PNG lossless compression to auto-select optimal filters per scanline — more effective than manually choosing filters, especially for photos [source](./.skilld/pkg/README.md#lossless-compression)

- Pass `AbortSignal` to async methods for cancellation control in server environments — prevents hanging requests when client disconnects, useful for timeout-critical image generation pipelines [source](./.skilld/pkg/index.d.ts:L8)

- Use `Transformer.fromRgbaPixels()` when working with decoded pixel buffers from Canvas/ImageData — avoids re-encoding to an intermediate format, directly transforms raw pixel arrays into image objects [source](./.skilld/pkg/README.md#new-from-rgba-rawpixels)
<!-- /skilld:best-practices -->
