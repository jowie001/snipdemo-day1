const path = require("node:path");

const links = new Map();
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer from 1 to 65535");
}

const baseUrl = (
  process.env.BASE_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : `http://localhost:${port}`)
).replace(/\/+$/, "");
const publicDir = process.env.PUBLIC_DIR
  ? path.resolve(process.env.PUBLIC_DIR)
  : null;
const codeAlphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function makeCode() {
  let code = "";
  while (code.length < 6) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte < 248) {
        code += codeAlphabet[byte % codeAlphabet.length];
        if (code.length === 6) break;
      }
    }
  }
  return code;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function withCors(response) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function serveStatic(pathname, method) {
  if (!publicDir) return null;

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decodedPath.includes("\0")) return null;

  const relativePath = decodedPath === "/"
    ? "index.html"
    : decodedPath.replace(/^\/+/, "");
  const filePath = path.resolve(publicDir, relativePath);
  const relativeToRoot = path.relative(publicDir, filePath);
  if (
    relativeToRoot === ".." ||
    relativeToRoot.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeToRoot)
  ) {
    return null;
  }

  const file = Bun.file(filePath);
  if (!(await file.exists())) return null;

  return new Response(method === "HEAD" ? null : file, {
    headers: { "Content-Type": file.type || "application/octet-stream" },
  });
}

Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }));
    }

    if (request.method === "POST" && pathname === "/api/links") {
      let body;
      try {
        body = await request.json();
      } catch {
        return withCors(jsonResponse({ error: "Request body must be valid JSON" }, 400));
      }

      const originalUrl = typeof body?.url === "string" ? body.url.trim() : "";
      let parsedUrl;
      try {
        parsedUrl = new URL(originalUrl);
      } catch {
        return withCors(jsonResponse({ error: "URL must be a valid HTTP or HTTPS URL" }, 400));
      }
      if (
        (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") ||
        !parsedUrl.hostname
      ) {
        return withCors(jsonResponse({ error: "URL must be a valid HTTP or HTTPS URL" }, 400));
      }

      let code;
      do {
        code = makeCode();
      } while (links.has(code));

      const link = {
        code,
        url: originalUrl,
        shortUrl: `${baseUrl}/${code}`,
        hits: 0,
        createdAt: new Date().toISOString(),
      };
      links.set(code, link);
      return withCors(jsonResponse(link, 201));
    }

    if (request.method === "GET" && pathname === "/api/links") {
      return withCors(jsonResponse(Array.from(links.values())));
    }

    if (request.method === "GET" || request.method === "HEAD") {
      const staticResponse = await serveStatic(pathname, request.method);
      if (staticResponse) return withCors(staticResponse);
    }

    if (request.method === "GET" && pathname.startsWith("/") && !pathname.slice(1).includes("/")) {
      const code = pathname.slice(1);
      const link = links.get(code);
      if (link) {
        link.hits += 1;
        return withCors(new Response(null, {
          status: 302,
          headers: { Location: link.url },
        }));
      }
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return withCors(jsonResponse({ error: "Method not allowed" }, 405));
    }
    return withCors(jsonResponse({ error: "Not found" }, 404));
  },
});

console.log(`Snip backend listening on http://localhost:${port}`);
