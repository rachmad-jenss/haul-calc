#!/usr/bin/env node
/**
 * bump-version.mjs — sync version across package.json, Cargo.toml, tauri.conf.json
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
};

// ── read current versions ────────────────────────────────────────────────────

function readVersions() {
  const pkg = JSON.parse(readFileSync(FILES.pkg, "utf-8"));
  const cargo = readFileSync(FILES.cargo, "utf-8");
  const tauri = JSON.parse(readFileSync(FILES.tauri, "utf-8"));

  const cargoMatch = cargo.match(/^version\s*=\s*"([^"]+)"/m);
  if (!cargoMatch) throw new Error("Could not find version in Cargo.toml");

  return {
    pkg: pkg.version,
    cargo: cargoMatch[1],
    tauri: tauri.version,
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

  // Cargo.toml — replace only the first `version = "..."` (package section)
  const cargo = readFileSync(FILES.cargo, "utf-8");
  const updatedCargo = cargo.replace(/^(version\s*=\s*")[^"]+(")/m, `$1${newVersion}$2`);
  writeFileSync(FILES.cargo, updatedCargo);

  // tauri.conf.json
  const tauri = JSON.parse(readFileSync(FILES.tauri, "utf-8"));
  tauri.version = newVersion;
  writeFileSync(FILES.tauri, JSON.stringify(tauri, null, 2) + "\n");
}

// ── main ──────────────────────────────────────────────────────────────────────

const bump = process.argv[2];
if (!bump) {
  console.error("Usage: node scripts/bump-version.mjs <major|minor|patch|x.y.z>");
  process.exit(1);
}

const versions = readVersions();

// Guard: all three must be in sync before bumping
const allSame = versions.pkg === versions.cargo && versions.pkg === versions.tauri;
if (!allSame) {
  console.error("❌ Version mismatch detected — fix before bumping:");
  console.error(`   package.json:           ${versions.pkg}`);
  console.error(`   src-tauri/Cargo.toml:   ${versions.cargo}`);
  console.error(`   src-tauri/tauri.conf.json: ${versions.tauri}`);
  process.exit(1);
}

const current = versions.pkg;
const next = bumpVersion(current, bump);

applyVersion(next);

console.log(`✅ Version bumped: ${current} → ${next}`);
console.log(`   package.json            ✓`);
console.log(`   src-tauri/Cargo.toml    ✓`);
console.log(`   src-tauri/tauri.conf.json ✓`);
console.log();
console.log(`Next steps:`);
console.log(`  cargo check              # update Cargo.lock`);
console.log(`  git add -p && git commit -m "chore: bump version to ${next}"`);
console.log(`  git tag v${next}`);
