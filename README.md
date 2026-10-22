# vietqr-svg2png

Cloudflare Worker that converts [VietQR](https://vietqr.io) SVG QR images to PNG.

## How it works

Any request path ending in `.png` is proxied to `img.vietqr.io` with the
extension swapped to `.svg`, the query string forwarded verbatim, then the SVG
is rasterized with [resvg](https://github.com/linebender/resvg) (WASM build) and
returned as PNG.

```
GET /image/HDBank-135704070047035-compact2.png?addInfo=...&amount=150000&accountName=...
   -> fetch  https://img.vietqr.io/image/HDBank-135704070047035-compact2.svg?addInfo=...&amount=150000&accountName=...
   -> render -> 200 image/png
```

Responses are cached at the edge (Cache API, 24h). Non-`.png` paths return
404; upstream errors (e.g. unknown bank) are passed through with their status.

## Fonts

`fonts/` contains Liberation Sans Regular/Bold subsetted to Latin + Vietnamese
glyphs, used to render the account name/amount text the SVG contains
(`font-family="Arial"` falls back to these).

## Commands

```sh
npm install
npm run dev       # wrangler dev
npm run typecheck # tsc --noEmit
npm run deploy    # wrangler deploy
```

## Notes

- Worker size is ~2.5MB (~1MB gzipped), dominated by resvg WASM.
- The SVG's embedded raster images (background artwork, bank logo) are inlined
  as `data:` URIs by VietQR, so no external image fetching is needed.
