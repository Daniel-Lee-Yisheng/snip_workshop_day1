# Snip CLI

A zero-dependency Node.js command-line client for the Snip URL shortener. Requires Node.js 20 or newer.

```sh
node cli.js help
node cli.js add https://example.com
node cli.js ls
node cli.js open abc123
```

Set `SNIP_API` to use a different backend URL; it defaults to `http://localhost:3000`.

On Windows, use `snip.cmd` or `snip.ps1`. On macOS and Linux, run `./snip` (make it executable if needed). Installing the package globally with `npm link` also registers the `snip` command.
