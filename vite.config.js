import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { readFileSync } from "node:fs";
var pkg = JSON.parse(readFileSync("./package.json", "utf-8"));
var host = process.env.TAURI_DEV_HOST;
var isDebug = !!process.env.TAURI_ENV_DEBUG;
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    define: {
        __APP_VERSION__: JSON.stringify(pkg.version),
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    clearScreen: false,
    server: {
        port: 1420,
        strictPort: true,
        host: host || false,
        hmr: host
            ? { protocol: "ws", host: host, port: 1421 }
            : undefined,
        watch: {
            ignored: ["**/src-tauri/**", "**/python-sidecar/**"],
        },
    },
    envPrefix: ["VITE_", "TAURI_ENV_"],
    build: {
        target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
        minify: isDebug ? false : "esbuild",
        sourcemap: isDebug,
    },
});
