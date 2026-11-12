# Snip backend

A zero-dependency Bun API for the Snip URL shortener. Links are held in memory and are cleared when the server restarts.

## Run

```sh
bun start
```

The server listens on port `3000` by default. Set `PORT` to change it, `BASE_URL` to set the origin used in generated short links, or `RAILWAY_PUBLIC_DOMAIN` to use `https://<domain>` when `BASE_URL` is unset. `PUBLIC_DIR` optionally enables static-file hosting (with `/` mapped to `index.html`).

## API

- `POST /api/links` with `{ "url": "https://example.com" }` returns `201` and `{ code, url, shortUrl, hits, createdAt }`. Invalid JSON or non-HTTP(S) URLs return `400` with `{ "error": "..." }`.
- `GET /api/links` returns all links in creation order.
- `GET /:code` redirects with `302` and increments the link's hit count; unknown codes return `404`.

CORS is enabled for browser clients.
