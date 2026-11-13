import { cp, copyFile, mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const push = process.argv.includes("--push");
const bundleDir = path.join(root, "bundle");
const frontendDir = path.join(root, "frontend");
const frontendBuildDir = path.join(frontendDir, "dist", "snip-frontend", "browser");
const publicDir = path.join(bundleDir, "public");
const windows = process.platform === "win32";

function run(command, args, cwd = root) {
  const packageManagerCommand = windows && (command === "npm" || command === "npx");
  const executable = packageManagerCommand ? `${command}.cmd` : command;
  const result = packageManagerCommand
    ? spawnSync(process.env.ComSpec || "cmd.exe", [
      "/d",
      "/s",
      "/c",
      `${executable} ${args.join(" ")}`,
    ], { cwd, stdio: "inherit" })
    : spawnSync(executable, args, { cwd, stdio: "inherit" });

  if (result.error) {
    throw new Error(`Could not run ${command}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

function hasStagedChanges(cwd) {
  const result = spawnSync("git", ["diff", "--cached", "--quiet"], {
    cwd,
    stdio: "inherit",
  });
  if (result.error) {
    throw new Error(`Could not inspect staged changes: ${result.error.message}`);
  }
  if (result.status === 0) return false;
  if (result.status === 1) return true;
  throw new Error(`git diff --cached failed with exit code ${result.status}`);
}

run("git", ["submodule", "update", "--init", "--remote", "backend", "frontend", "cli"]);
run("npm", ["install"], frontendDir);
run("npx", ["ng", "build"], frontendDir);

const builtIndex = path.join(frontendBuildDir, "index.html");
const builtIndexStats = await stat(builtIndex).catch(() => null);
if (!builtIndexStats?.isFile()) {
  throw new Error(`Angular build output is missing: ${builtIndex}`);
}

await mkdir(bundleDir, { recursive: true });
await rm(publicDir, { recursive: true, force: true });
await cp(frontendBuildDir, publicDir, { recursive: true });
await copyFile(path.join(root, "backend", "server.js"), path.join(bundleDir, "server.js"));
await copyFile(path.join(root, "cli", "cli.js"), path.join(bundleDir, "cli.js"));
await writeFile(path.join(bundleDir, ".env"), "PUBLIC_DIR=./public\n");
await writeFile(
  path.join(bundleDir, "package.json"),
  `${JSON.stringify({
    name: "snip-bundle",
    version: "1.0.0",
    private: true,
    scripts: { start: "bun server.js" },
  }, null, 2)}\n`,
);
await writeFile(
  path.join(bundleDir, "Dockerfile"),
  [
    "FROM oven/bun:1-alpine",
    "WORKDIR /app",
    "COPY . .",
    "ENV PORT=3000",
    "EXPOSE 3000",
    'CMD ["bun", "server.js"]',
    "",
  ].join("\n"),
);
await writeFile(
  path.join(bundleDir, ".dockerignore"),
  [".git", ".gitmodules", "node_modules", "npm-debug.log", ""].join("\n"),
);
await writeFile(
  path.join(bundleDir, "railway.json"),
  `${JSON.stringify({
    "$schema": "https://railway.app/railway.schema.json",
    build: { builder: "DOCKERFILE" },
  }, null, 2)}\n`,
);

run("git", ["add", "-A"], bundleDir);
if (hasStagedChanges(bundleDir)) {
  run("git", [
    "commit",
    "-m",
    "Build generated Snip bundle",
    "-m",
    "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>",
    "-m",
    "Co-authored-by: OpenBot <335604065+openbotgit[bot]@users.noreply.github.com>",
  ], bundleDir);
} else {
  console.log("bundle unchanged: no generated files to commit.");
}

if (push) {
  run("git", ["push", "origin", "HEAD:bundle"], bundleDir);
}

run("git", ["add", ".gitmodules", "README.md", "scripts/build-bundle.mjs", "backend", "frontend", "cli", "bundle"]);
if (hasStagedChanges(root)) {
  run("git", [
    "commit",
    "-m",
    "Update Snip bundle and source pointers",
    "-m",
    "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>",
    "-m",
    "Co-authored-by: OpenBot <335604065+openbotgit[bot]@users.noreply.github.com>",
  ]);
}

if (push) {
  run("git", ["push", "origin", "main"]);
}
