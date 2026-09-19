import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destination = resolve(process.cwd(), process.argv[2] ?? "dist", "regions.json.gz");
mkdirSync(dirname(destination), { recursive: true });
copyFileSync(resolve(root, "catalog/regions.json.gz"), destination);
console.log(`Copied regions.json.gz to ${destination}`);
