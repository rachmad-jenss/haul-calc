#!/usr/bin/env node
/**
 * bump-version.mjs — sync version across package.json, Cargo.toml, tauri.conf.json, and bridge.py
 *
 * Usage:
 *   node scripts/bump-version.mjs patch        # 0.1.0 → 0.1.1
 *   node scripts/bump-version.mjs minor        # 0.1.0 → 0.2.0
 *   node scripts/bump-version.mjs major        # 0.1.0 → 1.0.0
 *   node scripts/bump-version.mjs 1.2.3        # explicit version
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// ── file paths ────────────────────────────────────────────────────────────────

const FILES = {
  pkg: resolve(root, "package.json"),
  cargo: resolve(root, "src-tauri/Cargo.toml"),
  tauri: resolve(root, "src-tauri/tauri.conf.json"),
  bridge: resolve(root, "python-sidecar/bridge.py"),
};

// ── read current versions ────────────────────────────────────────────────────

function readVersions() {
  const pkg = JSON.parse(readFileSync(FILES.pkg, "utf-8"));
  const cargo = readFileSync(FILES.cargo, "utf-8");
  const tauri = JSON.parse(readFileSync(FILES.tauri, "utf-8"));
  const bridge = readFileSync(FILES.bridge, "utf-8");

  // Scope to [package] section — [^\[]* stops at the next section header
  const cargoMatch = cargo.match(/^\[package\][^\[]*?version\s*=\s*"([^"]+)"/ms);
  if (!cargoMatch) throw new Error("Could not find version in Cargo.toml [package] section");

  const bridgeMatch = bridge.match(/^BRIDGE_VERSION\s*=\s*"([^"]+)"/m);
  if (!bridgeMatch) throw new Error("Could not find BRIDGE_VERSION in bridge.py");

  return {
    pkg: pkg.version,
    cargo: cargoMatch[1],
    tauri: tauri.version,
    bridge: bridgeMatch[1],
  };
}

// ── semver bump ───────────────────────────────────────────────────────────────

function bumpVersion(current, bump) {
  if (/^\d+\.\d+\.\d+$/.test(bump)) return bump; // explicit version

  const [major, minor, patch] = current.split(".").map(Number);
  switch (bump) {
    case "major": return `${major + 1}.0.0`;
    case "minor": return `${major}.${minor + 1}.0`;
    case "patch": return `${major}.${minor}.${patch + 1}`;
    default: throw new Error(`Unknown bump type: "${bump}". Use major, minor, patch, or x.y.z`);
  }
}

// ── write ─────────────────────────────────────────────────────────────────────

function applyVersion(newVersion) {
  // package.json
  const pkg = JSON.parse(readFileSync(FILES.pkg, "utf-8"));
  pkg.version = newVersion;
  writeFileSync(FILES.pkg, JSON.stringify(pkg, null, 2) + "\n");

  // Cargo.toml — scope replacement to [package] section, stops at next `[`
  const cargo = readFileSync(FILES.cargo, "utf-8");
  const updatedCargo = cargo.replace(/(^\[package\][^\[]*?version\s*=\s*")[^"]+(")/ms, `$1${newVersion}$2`);
  writeFileSync(FILES.cargo, updatedCargo);

  // tauri.conf.json
  const tauri = JSON.parse(readFileSync(FILES.tauri, "utf-8"));
  tauri.version = newVersion;
  writeFileSync(FILES.tauri, JSON.stringify(tauri, null, 2) + "\n");

  // python-sidecar/bridge.py
  const bridge = readFileSync(FILES.bridge, "utf-8");
  const updatedBridge = bridge.replace(/^(BRIDGE_VERSION\s*=\s*")[^"]+(")/m, `$1${newVersion}$2`);
  writeFileSync(FILES.bridge, updatedBridge);
}

// ── main ──────────────────────────────────────────────────────────────────────

const bump = process.argv[2];
if (!bump) {
  console.error("Usage: node scripts/bump-version.mjs <major|minor|patch|x.y.z>");
  process.exit(1);
}

const versions = readVersions();

  // Guard: all four must be in sync before bumping
  const allSame = versions.pkg === versions.cargo
    && versions.pkg === versions.tauri
    && versions.pkg === versions.bridge;
  if (!allSame) {
    console.error("❌ Version mismatch detected — fix before bumping:");
    console.error(`   package.json:              ${versions.pkg}`);
    console.error(`   src-tauri/Cargo.toml:      ${versions.cargo}`);
    console.error(`   src-tauri/tauri.conf.json: ${versions.tauri}`);
    console.error(`   python-sidecar/bridge.py:  ${versions.bridge}`);
    process.exit(1);
  }

const current = versions.pkg;
const next = bumpVersion(current, bump);

applyVersion(next);

console.log(`✅ Version bumped: ${current} → ${next}`);
console.log(`   package.json               ✓`);
console.log(`   src-tauri/Cargo.toml       ✓`);
console.log(`   src-tauri/tauri.conf.json  ✓`);
console.log(`   python-sidecar/bridge.py   ✓`);
console.log();
console.log(`Next steps:`);
console.log(`  cargo check                 # update Cargo.lock`);
console.log(`  git add -p && git commit -m "chore: bump version to ${next}"`);
console.log(`  git tag v${next}`);
