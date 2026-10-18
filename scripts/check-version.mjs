#!/usr/bin/env node
// Fails unless package.json, src-tauri/Cargo.toml and src-tauri/tauri.conf.json
// carry the same version, and (when given) the release tag matches it.
//
//   node scripts/check-version.mjs            # files agree with each other
//   node scripts/check-version.mjs v0.1.0-rc1 # ...and with the tag
//
// A tag is vX.Y.Z with an optional "-suffix" (e.g. -rc1) that only marks a
// pre-release; the suffix is not part of the app version.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(root + p, "utf8");

const versions = {
  "package.json": JSON.parse(read("package.json")).version,
  "src-tauri/tauri.conf.json": JSON.parse(read("src-tauri/tauri.conf.json")).version,
  "src-tauri/Cargo.toml": read("src-tauri/Cargo.toml").match(/^\[package\][^[]*?^version\s*=\s*"([^"]+)"/ms)?.[1],
};

let ok = true;
const app = versions["package.json"];
for (const [file, v] of Object.entries(versions)) {
  if (v !== app) {
    console.error(`✗ ${file} has version ${v ?? "(none)"}, package.json has ${app}`);
    ok = false;
  }
}

const tag = process.argv[2];
if (tag) {
  const m = /^v(\d+\.\d+\.\d+)(-[0-9A-Za-z.-]+)?$/.exec(tag);
  if (!m) {
    console.error(`✗ Tag ${tag} is not of the form vX.Y.Z or vX.Y.Z-suffix`);
    ok = false;
  } else if (m[1] !== app) {
    console.error(`✗ Tag ${tag} is for ${m[1]} but the app version is ${app}. Bump the version first.`);
    ok = false;
  }
}

if (!ok) process.exit(1);
console.log(`✓ Version ${app}${tag ? ` matches tag ${tag}` : ""}`);
