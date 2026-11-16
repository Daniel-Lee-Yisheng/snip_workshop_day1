# Snip backend

A zero-dependency Bun URL shortener. Links are kept in memory and are cleared
when the server restarts.

Run with `bun start`. The server listens on port `3000` by default; set `PORT`
to change it. `BASE_URL` sets the origin used in generated short links. If it
is unset, the server uses `https://$RAILWAY_PUBLIC_DOMAIN` when available, or
`http://localhost:$PORT`.

Set `PUBLIC_DIR` to serve static files alongside the API. `/` serves
`index.html`; an existing static file takes precedence over a short code.

## API

- `POST /api/links` with `{"url":"https://example.com"}` creates a link and
  returns `201` with `{code, url, shortUrl, hits, createdAt}`. Invalid JSON or
  non-HTTP(S) URLs return `400`.
- `GET /api/links` returns all links.
- `GET /:code` redirects to the original URL with `302` and increments its hit
  count; unknown codes return `404`.
