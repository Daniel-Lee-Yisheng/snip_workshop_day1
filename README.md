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
