/**
 * Cloudflare Workers - Gemini API Proxy
 *
 * デプロイ方法:
 * 1. https://workers.cloudflare.com/ にアクセス（無料アカウントでOK）
 * 2. 新しいWorkerを作成し、このコードを貼り付ける
 * 3. デプロイして発行されたURLをメモする（例: https://gemini-proxy.youraccount.workers.dev）
 * 4. index.html の PROXY_BASE_URL にそのURLを設定する
 */

const GEMINI_BASE = "https://generativelanguage.googleapis.com";

export default {
  async fetch(request, env, ctx) {
    const cors = corsHeaders();

    // CORSプリフライト対応
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: cors,
      });
    }

    const url = new URL(request.url);

    // /v1/* のパスを Gemini API にフォワード
    // 例: /v1/v1beta/models/gemini-2.5-flash:generateContent
    //  → https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent
    const pathMatch = url.pathname.match(/^\/v1\/(.*)/);
    if (!pathMatch) {
      // パスが違う場合もCORSヘッダーを付けて404を返す（デバッグしやすくするため）
      return new Response(`Not Found. Current path is ${url.pathname}, but expected starting with /v1/`, {
        status: 404,
        headers: cors
      });
    }

    const targetPath = pathMatch[1];
    const targetURL = `${GEMINI_BASE}/${targetPath}${url.search}`;

    // リクエストをそのまま転送
    const proxyRequest = new Request(targetURL, {
      method: request.method,
      headers: request.headers,
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : null,
      redirect: "follow",
    });

    try {
      const response = await fetch(proxyRequest);

      // レスポンスにCORSヘッダーを付与して返す
      const newResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...Object.fromEntries(response.headers),
          ...cors,
        },
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
