// Kopiert die Web-App in einen Ordner, aus dem Android-App und Windows-Programm
// gebaut werden. Aufruf: node tools/build-web.mjs [Zielordner]
import { cpSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, process.argv[2] || "dist/web");
const files = ["index.html", "manifest.webmanifest", "sw.js", "assets"];

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const f of files) {
  const src = join(root, f);
  if (!existsSync(src)) throw new Error("fehlt: " + f);
  cpSync(src, join(out, f), { recursive: true });
}
console.log("Web-App nach " + out + " kopiert.");
