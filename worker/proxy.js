/**
 * Cloudflare Workers - Gemini API Proxy (Hardened & Hidden Headers)
 */

const GEMINI_BASE = "https://generativelanguage.googleapis.com";

export default {
  async fetch(request, env, ctx) {
    const cors = corsHeaders();

    // CORSプリフライト対応
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    const pathMatch = url.pathname.match(/^\/v1\/(.*)/);
    if (!pathMatch) {
      return new Response(`Not Found.`, { status: 404, headers: cors });
    }

    const targetPath = pathMatch[1];
    const targetURL = `${GEMINI_BASE}/${targetPath}${url.search}`;

    // ブラウザからのリクエストヘッダー（APIキー含む）をそのまま転送
    const proxyRequest = new Request(targetURL, {
      method: request.method,
      headers: new Headers(request.headers),
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : null,
      redirect: "follow",
    });

    try {
      const response = await fetch(proxyRequest);
      const newHeaders = new Headers(response.headers);

      // 重複・漏洩防止のためCORSヘッダーを上書き
      newHeaders.delete("Access-Control-Allow-Origin");
      newHeaders.delete("Access-Control-Allow-Methods");
      newHeaders.delete("Access-Control-Allow-Headers");
      for (const [key, value] of Object.entries(cors)) {
        newHeaders.set(key, value);
      }

      const newResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
      return newResponse;
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }
  },
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-goog-api-key, Authorization",
  };
}
