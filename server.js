import { realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

const links = new Map();
const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const port = Number(process.env.PORT ?? "3000");

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const configuredBaseUrl =
  process.env.BASE_URL ??
  (process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : `http://localhost:${port}`);
const baseUrl = new URL(configuredBaseUrl).origin;
const publicDir = process.env.PUBLIC_DIR
  ? await realpath(resolve(process.env.PUBLIC_DIR))
  : null;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function withCors(response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(corsHeaders)) {
    headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function json(body, status = 200) {
  return withCors(Response.json(body, { status }));
}

function createCode() {
  let code = "";
  while (code.length < 6) {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte < 248) {
        code += alphabet[byte % alphabet.length];
        if (code.length === 6) break;
      }
    }
  }
  return code;
}

async function serveStatic(pathname) {
  if (!publicDir) return null;

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return json({ error: "Invalid path." }, 400);
  }

  const relativePath =
    decodedPath === "/" ? "index.html" : decodedPath.replace(/^[/\\]+/, "");
  const candidate = resolve(publicDir, relativePath);
  const pathFromPublicDir = relative(publicDir, candidate);
  if (
    pathFromPublicDir === ".." ||
    pathFromPublicDir.startsWith(`..${sep}`) ||
    isAbsolute(pathFromPublicDir)
  ) {
    return null;
  }

  let filePath;
  try {
    filePath = await realpath(candidate);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return null;
    throw error;
  }

  const realRelativePath = relative(publicDir, filePath);
  if (
    realRelativePath === ".." ||
    realRelativePath.startsWith(`..${sep}`) ||
    isAbsolute(realRelativePath)
  ) {
    return null;
  }

  const fileInfo = await stat(filePath);
  if (!fileInfo.isFile()) return null;
  return withCors(new Response(Bun.file(filePath)));
}

Bun.serve({
  port,
  async fetch(request) {
    const { pathname } = new URL(request.url);

    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }));
    }

    if (request.method === "POST" && pathname === "/api/links") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Request body must be valid JSON." }, 400);
      }

      if (typeof body?.url !== "string") {
        return json({ error: "A valid HTTP or HTTPS URL is required." }, 400);
      }

      let target;
      try {
        target = new URL(body.url);
      } catch {
        return json({ error: "A valid HTTP or HTTPS URL is required." }, 400);
      }

      if (
        (target.protocol !== "http:" && target.protocol !== "https:") ||
        !target.hostname
      ) {
        return json({ error: "A valid HTTP or HTTPS URL is required." }, 400);
      }

      let code;
      do {
        code = createCode();
      } while (links.has(code));

      const link = {
        code,
        url: body.url,
        shortUrl: `${baseUrl}/${code}`,
        hits: 0,
        createdAt: new Date().toISOString(),
      };
      links.set(code, link);
      return json(link, 201);
    }

    if (request.method === "GET" && pathname === "/api/links") {
      return json(Array.from(links.values()));
    }

    if (request.method === "GET") {
      const staticResponse = await serveStatic(pathname);
      if (staticResponse) return staticResponse;

      const code = pathname.slice(1);
      if (code && !code.includes("/")) {
        const link = links.get(code);
        if (link) {
          link.hits += 1;
          return withCors(Response.redirect(link.url, 302));
        }
      }
    }

    return json({ error: "Not found." }, 404);
  },
});

console.log(`Snip backend listening on port ${port}`);
