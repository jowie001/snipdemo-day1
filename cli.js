#!/usr/bin/env node
"use strict";

const { spawn } = require("node:child_process");

const DEFAULT_API = "http://localhost:3000";
const REQUEST_TIMEOUT_MS = 10_000;

function usage() {
  return [
    "Usage:",
    "  snip add <url>    Create a short link",
    "  snip ls           List links and hit counts",
    "  snip open <code>  Open a short link in the browser",
    "  snip help         Show this help",
    "",
    "Set SNIP_API to use a different API base URL (default: http://localhost:3000).",
  ].join("\n");
}

function getApiBase() {
  const value = (process.env.SNIP_API || DEFAULT_API).replace(/\/+$/, "");
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("SNIP_API must be a valid HTTP or HTTPS URL");
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.host) {
    throw new Error("SNIP_API must be a valid HTTP or HTTPS URL");
  }
  return value;
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${getApiBase()}${path}`, {
      ...options,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error.name === "TimeoutError") {
      throw new Error(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds`);
    }
    throw new Error(`Could not reach the Snip API: ${error.message}`);
  }
  return response;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    throw new Error(`API returned invalid JSON (HTTP ${response.status})`);
  }
}

function validateUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("URL must be a valid HTTP or HTTPS URL");
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname) {
    throw new Error("URL must be a valid HTTP or HTTPS URL");
  }
  return value;
}

function getErrorMessage(body, status) {
  return body && typeof body.error === "string" && body.error
    ? body.error
    : `API request failed (HTTP ${status})`;
}

function formatLinks(links) {
  if (links.length === 0) return "No links yet.";

  const rows = links.map((link) => [
    String(link.code),
    String(link.hits),
    String(link.url),
  ]);
  const widths = [
    Math.max(4, ...rows.map(([code]) => code.length)),
    Math.max(4, ...rows.map(([, hits]) => hits.length)),
  ];
  const line = (code, hits, url) =>
    `${code.padEnd(widths[0])}  ${hits.padStart(widths[1])}  ${url}`;
  return [
    line("CODE", "HITS", "URL"),
    line("-".repeat(widths[0]), "-".repeat(widths[1]), "-".repeat(3)),
    ...rows.map(([code, hits, url]) => line(code, hits, url)),
  ].join("\n");
}

function openInBrowser(target) {
  const command = process.platform === "win32"
    ? "rundll32.exe"
    : process.platform === "darwin"
      ? "open"
      : "xdg-open";
  const args = process.platform === "win32"
    ? ["url.dll,FileProtocolHandler", target]
    : [target];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

async function run(argv) {
  const [command, ...args] = argv;
  if (!command || command === "help" || command === "--help" || command === "-h") {
    if (args.length > 0) throw new Error("Help does not accept additional arguments");
    process.stdout.write(`${usage()}\n`);
    return;
  }

  if (command === "add") {
    if (args.length !== 1) throw new Error("Usage: snip add <url>");
    const url = validateUrl(args[0].trim());
    const response = await request("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const body = await readJson(response);
    if (response.status !== 201) {
      throw new Error(getErrorMessage(body, response.status));
    }
    if (!body || typeof body.shortUrl !== "string") {
      throw new Error("API returned an invalid short link");
    }
    process.stdout.write(`${body.shortUrl}\n`);
    return;
  }

  if (command === "ls") {
    if (args.length !== 0) throw new Error("Usage: snip ls");
    const response = await request("/api/links");
    const body = await readJson(response);
    if (!response.ok) {
      throw new Error(getErrorMessage(body, response.status));
    }
    if (!Array.isArray(body)) throw new Error("API returned an invalid links list");
    process.stdout.write(`${formatLinks(body)}\n`);
    return;
  }

  if (command === "open") {
    if (args.length !== 1 || !/^[A-Za-z0-9]{6}$/.test(args[0])) {
      throw new Error("Usage: snip open <6-character code>");
    }
    const response = await request(`/${encodeURIComponent(args[0])}`, {
      redirect: "manual",
    });
    if (response.status === 404) throw new Error(`Unknown short code: ${args[0]}`);
    if (response.status !== 302) {
      throw new Error(`API request failed (HTTP ${response.status})`);
    }
    const target = response.headers.get("location");
    if (!target) throw new Error("API redirect did not include a Location header");
    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch {
      throw new Error("API returned an invalid redirect URL");
    }
    if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") {
      throw new Error("API returned an invalid redirect URL");
    }
    await openInBrowser(targetUrl.href);
    return;
  }

  throw new Error(`Unknown command: ${command}\n${usage()}`);
}

if (require.main === module) {
  run(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`Error: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { formatLinks, openInBrowser, run, validateUrl };
