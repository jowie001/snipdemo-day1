# Snip

Snip is a small URL shortener with one backend and two clients: a web UI and a terminal CLI.

## Repository layout

| Branch | Path | Contents |
| --- | --- | --- |
| `backend` | `backend/` | Bun API server; in-memory link storage |
| `frontend` | `frontend/` | Angular 20 web app |
| `cli` | `cli/` | Zero-dependency CommonJS CLI |
| `bundle` | `bundle/` | Generated release: API server, built UI, and CLI |
| `main` | repository root | Superproject, build script, and CI |

Each component branch has an independent history and keeps its files at its root. `main` pins exact component commits as Git submodules.

## API contract

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| `POST` | `/api/links` | `{"url":"https://…"}` | `201` with `{code,url,shortUrl,hits,createdAt}`; `400` for invalid input |
| `GET` | `/api/links` | — | `200` with an array of link objects |
| `GET` | `/:code` | — | `302` to the original URL and increments hits; `404` for an unknown code |

Link storage is an in-memory `Map`; restarting the server clears it by design.

## Clone

Use `--recurse-submodules`; a plain clone leaves the component directories empty:

```sh
git clone --recurse-submodules https://github.com/jowie001/snipdemo-day1.git
cd snipdemo-day1
```

## Run from the `main` checkout

Start the backend on port 3000:

```sh
cd backend
bun start
```

In another terminal, run the web UI:

```sh
cd frontend
npm install
npx ng serve
```

The UI is served at `http://localhost:4200`. To use the CLI:

```sh
cd cli
node cli.js ls
node cli.js add https://example.com
```

Set `SNIP_API` to use a backend origin other than `http://localhost:3000`.

## Updating components

Commit and push changes from inside a component checkout first. Then update the pinned commit in `main`:

```sh
git submodule update --remote backend
git add backend
git commit -m "Bump backend submodule"
git push
```

Use the corresponding submodule path for `frontend` or `cli`. Generate and publish a new release with:

```sh
node scripts/build-bundle.mjs --push
```

`bundle/` is generated output; do not edit it by hand. The bundle workflow rebuilds it hourly and on manual dispatch. A change to the pinned `bundle/` commit on `main` triggers the Docker image workflow. The image is published to GHCR only after the frontend build and tests, API/CLI smoke tests, and high/critical vulnerability scans pass.
