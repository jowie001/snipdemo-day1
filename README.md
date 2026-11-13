# Snip Frontend

The Angular 20 client for Snip. It creates short links and lists them from the shared API.

## Run locally

Install dependencies with `npm install`. Start the backend on port 3000, then run `npx ng serve`. The development server proxies `/api` requests to `http://localhost:3000`; open `http://localhost:4200`.

## Build

Run `npx ng build`. The deployable static app is written to `dist/snip-frontend/browser` and can be served by the backend with `PUBLIC_DIR=./public`.

## API

- `POST /api/links` with `{ "url": "https://…" }` returns `{ code, url, shortUrl, hits, createdAt }`.
- `GET /api/links` returns the list of links with the same fields.
