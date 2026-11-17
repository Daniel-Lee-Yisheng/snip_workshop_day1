# Snip

Snip is a small URL shortener with one backend and two clients: an Angular web
app and a Node.js CLI. All clients use the same backend API.

## API contract

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| `POST` | `/api/links` | `{"url":"https://example.com"}` | `201` `{code, url, shortUrl, hits, createdAt}`; `400` for invalid JSON or a non-HTTP(S) URL |
| `GET` | `/api/links` | — | `200` array of link objects |
| `GET` | `/:code` | — | `302` redirect to the original URL and increment the hit count; `404` for an unknown code |

Links are held in an in-memory map and are cleared when the backend restarts.

## Repository layout

Each component is maintained at the root of its own branch and mounted here as
a submodule:

| Path | Branch | Contents |
| --- | --- | --- |
| `backend/` | `backend` | Bun API server |
| `frontend/` | `frontend` | Angular 19 web client |
| `cli/` | `cli` | Zero-dependency CommonJS Node.js CLI |
| `bundle/` | `bundle` | Generated release output |

Clone with submodules initialized:

```sh
git clone --recurse-submodules https://github.com/Daniel-Lee-Yisheng/snip_workshop_day1.git
```

A plain clone leaves the component directories empty. To populate them later,
run `git submodule update --init --recursive`.

## Run locally

Use separate terminals from the repository root.

```sh
cd backend
bun start
```

```sh
cd frontend
npm install
npm start
```

Open `http://localhost:4200`. The frontend calls the API at
`http://localhost:3000`.

To run the generated single-process app (web UI and API together), use:

```sh
cd bundle
bun start
```

If Bun is not installed globally, run `npx --yes bun run server.js` from
`bundle/` instead. Open `http://localhost:3000`.

```sh
cd cli
node cli.js ls
node cli.js add https://example.com
```

Set `SNIP_API` to point the CLI at a different backend URL.

## Updating components

Edit a component on its branch, then commit and push from that component
checkout. In the superproject, update its submodule to the branch tip, stage the
gitlink, commit, and push the pointer change:

```sh
git submodule update --remote backend
git add backend
git commit -m "Bump backend submodule"
git push
```

Repeat for `frontend` or `cli`. The superproject records the exact component
commit, so update and commit the pointer after each component change. Run
`node scripts/build-bundle.mjs` to regenerate the release bundle; use
`--push` to push generated commits.

## Release bundle

`bundle/` is generated output; do not edit it by hand. The build script updates
the component submodules, builds the Angular app, and assembles the backend,
CLI, static UI, and Docker/Railway configuration into the `bundle` submodule.
Run the script twice when validating a change: the second run should report no
new commits. Add `--push` to publish generated commits on `bundle` and update
`main`.

GitHub Actions regenerates the bundle hourly or on manual dispatch. The Docker
workflow runs when the `bundle` submodule pointer changes on `main` and publishes
`ghcr.io/daniel-lee-yisheng/snip_workshop_day1:latest` and a short-SHA tag.
Image publication is gated on frontend tests, dependency audit, and a high/
critical image scan. The current Angular 19 lockfile has four high-severity
production dependency advisories with no patched Angular 19 release available;
the Docker job correctly stops before publishing until that is addressed.
