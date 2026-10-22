import { initWasm, Resvg } from "@resvg/resvg-wasm";
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";
import fontRegular from "../fonts/LiberationSans-Regular.ttf";
import fontBold from "../fonts/LiberationSans-Bold.ttf";

const UPSTREAM_ORIGIN = "https://img.vietqr.io";

let wasmReady: Promise<void> | undefined;

function ensureWasm(): Promise<void> {
  wasmReady ??= initWasm(resvgWasm).catch((err) => {
    wasmReady = undefined;
    throw err;
  });
  return wasmReady;
}

function svgToPng(svg: string): Uint8Array {
  const resvg = new Resvg(svg, {
    font: {
      fontBuffers: [new Uint8Array(fontRegular), new Uint8Array(fontBold)],
      defaultFontFamily: "Liberation Sans",
      sansSerifFamily: "Liberation Sans",
      monospaceFamily: "Liberation Sans",
    },
  });
  const image = resvg.render();
  const png = image.asPng();
  image.free();
  resvg.free();
  return png;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405 });
    }
    if (!url.pathname.toLowerCase().endsWith(".png")) {
      return new Response("Not Found", { status: 404 });
    }

    const cached = await caches.default.match(request);
    if (cached) return cached;

    const svgUrl =
      UPSTREAM_ORIGIN + url.pathname.slice(0, -".png".length) + ".svg" + url.search;

    const upstream = await fetch(svgUrl, {
      headers: { Accept: "image/svg+xml,*/*" },
      cf: { cacheEverything: true, cacheTtl: 3600 },
    });
    if (!upstream.ok) {
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          "Content-Type":
            upstream.headers.get("Content-Type") ?? "text/plain; charset=utf-8",
        },
      });
    }

    const svg = await upstream.text();

    let png: Uint8Array;
    try {
      await ensureWasm();
      png = svgToPng(svg);
    } catch (err) {
      return new Response("Failed to render SVG to PNG", { status: 502 });
    }

    const response = new Response(png as unknown as BodyInit, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
    ctx.waitUntil(caches.default.put(request, response.clone()));
    return response;
  },
} satisfies ExportedHandler;
