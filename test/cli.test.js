"use strict";

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");
const { once } = require("node:events");
const { after, before, test } = require("node:test");

const cliPath = path.resolve(__dirname, "..", "cli.js");
let server;
let api;
let links = [];

before(async () => {
  server = http.createServer(async (request, response) => {
    if (request.method === "POST" && request.url === "/api/links") {
      let raw = "";
      for await (const chunk of request) raw += chunk;
      const { url } = JSON.parse(raw);
      const link = {
        code: "Ab12Cd",
        url,
        shortUrl: `${api}/Ab12Cd`,
        hits: 0,
        createdAt: new Date(0).toISOString(),
      };
      links.push(link);
      response.writeHead(201, { "Content-Type": "application/json" });
      response.end(JSON.stringify(link));
      return;
    }
    if (request.method === "GET" && request.url === "/api/links") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(links));
      return;
    }
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "Not found" }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  api = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  await once(server, "close");
});

function runCli(args, baseUrl = api) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      env: { ...process.env, SNIP_API: baseUrl },
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, stdout, stderr }));
  });
}

test("help prints usage without contacting the API", async () => {
  const result = await runCli(["help"]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /snip add <url>/);
  assert.equal(result.stderr, "");
});

test("add creates a link and ls prints the aligned link table", async () => {
  links = [];
  const added = await runCli(["add", "https://example.com/path"]);
  assert.equal(added.code, 0);
  assert.equal(added.stdout.trim(), `${api}/Ab12Cd`);
  assert.equal(added.stderr, "");

  const listed = await runCli(["ls"]);
  assert.equal(listed.code, 0);
  assert.match(listed.stdout, /CODE\s+HITS\s+URL/);
  assert.match(listed.stdout, /Ab12Cd\s+0\s+https:\/\/example\.com\/path/);
  assert.equal(listed.stderr, "");
});

test("ls reports an empty list", async () => {
  links = [];
  const result = await runCli(["ls"]);
  assert.equal(result.code, 0);
  assert.equal(result.stdout, "No links yet.\n");
});

test("invalid URLs fail on stderr before an API request", async () => {
  const result = await runCli(["add", "javascript:alert(1)"]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /valid HTTP or HTTPS URL/);
  assert.equal(result.stdout, "");
});

test("unknown short codes fail cleanly", async () => {
  const result = await runCli(["open", "ABC123"]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /Unknown short code: ABC123/);
});

test("an unreachable API returns a nonzero exit code", async () => {
  const unused = http.createServer();
  unused.listen(0, "127.0.0.1");
  await once(unused, "listening");
  const deadApi = `http://127.0.0.1:${unused.address().port}`;
  await new Promise((resolve, reject) => unused.close((error) => error ? reject(error) : resolve()));

  const result = await runCli(["ls"], deadApi);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /Could not reach the Snip API/);
});
