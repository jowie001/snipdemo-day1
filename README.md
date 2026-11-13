# Snip CLI

A zero-dependency Node.js command-line client for the Snip URL shortener. Node.js 20 or newer is required.

## Run

```sh
node cli.js help
node cli.js add https://example.com
node cli.js ls
node cli.js open Ab12Cd
```

Set `SNIP_API` to change the backend origin; it defaults to `http://localhost:3000`.

The `snip`, `snip.cmd`, and `snip.ps1` wrappers forward their arguments to `cli.js`. Install the package globally to use its `snip` bin command.

## Test

```sh
npm test
```
