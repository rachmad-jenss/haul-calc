#!/usr/bin/env node
/**
 * Ensure @tauri-apps/* npm packages match major.minor of Rust crates in Cargo.lock.
 * Mirrors the check performed at the start of `tauri build` (without compiling).
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const RUST_TO_NPM = [
  ["tauri", "@tauri-apps/api"],
  ["tauri-plugin-dialog", "@tauri-apps/plugin-dialog"],
  ["tauri-plugin-fs", "@tauri-apps/plugin-fs"],
  ["tauri-plugin-process", "@tauri-apps/plugin-process"],
  ["tauri-plugin-shell", "@tauri-apps/plugin-shell"],
  ["tauri-plugin-updater", "@tauri-apps/plugin-updater"],
];

function majorMinor(version) {
  const parts = version.split(".");
  if (parts.length < 2) {
    throw new Error(`Invalid semver: ${version}`);
  }
  return `${parts[0]}.${parts[1]}`;
}

function readCargoLockVersions(lockPath) {
  const text = readFileSync(lockPath, "utf8").replace(/\r\n/g, "\n");
  const versions = new Map();
  const re = /^name = "([^"]+)"\nversion = "([^"]+)"/gm;
  for (const match of text.matchAll(re)) {
    versions.set(match[1], match[2]);
  }
  return versions;
}

function readInstalledNpmVersion(packageName) {
  const pkgPath = resolve(root, "node_modules", packageName, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  return pkg.version;
}

const cargoVersions = readCargoLockVersions(resolve(root, "src-tauri/Cargo.lock"));
const mismatches = [];

for (const [rustPkg, npmPkg] of RUST_TO_NPM) {
  const rustVersion = cargoVersions.get(rustPkg);
  if (!rustVersion) {
    mismatches.push(`${rustPkg}: missing from src-tauri/Cargo.lock`);
    continue;
  }

  let npmVersion;
  try {
    npmVersion = readInstalledNpmVersion(npmPkg);
  } catch {
    mismatches.push(`${rustPkg} (${rustVersion}) : ${npmPkg} (not installed)`);
    continue;
  }

  if (majorMinor(rustVersion) !== majorMinor(npmVersion)) {
    mismatches.push(`${rustPkg} (v${rustVersion}) : ${npmPkg} (v${npmVersion})`);
  }
}

if (mismatches.length > 0) {
  console.error(
    "Found version mismatched Tauri packages. Align major.minor between Cargo.lock and package.json:\n" +
      mismatches.map((line) => line).join("\n"),
  );
  process.exit(1);
}

console.log("Tauri Rust/npm package versions are aligned.");
