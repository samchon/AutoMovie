// Validate the JS engine against a headless MakeHuman oracle export.
// Usage: node mh_validate.mjs <oraclePrefix> <config.json>
//   compares <prefix>.coords.f32 / .details.json against buildMesh(config)
import fs from "node:fs";
import path from "node:path";
import { buildMesh, loadModifierTable } from "./mhEngine.mjs";

const [prefix, cfgPath] = process.argv.slice(2);
if (!prefix || !cfgPath) {
  console.error("usage: node mh_validate.mjs <oraclePrefix> <config.json>");
  process.exit(1);
}

const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
const table = loadModifierTable();
const { coords, detail } = buildMesh(table, cfg.macro || {}, cfg.modifiers || {});

// --- detail stack compare ---
const oracleDetail = JSON.parse(fs.readFileSync(prefix + ".details.json", "utf8"));
const TARGETS_ROOT = path
  .resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")),
           "../../../../.references/makehuman/makehuman/data/targets")
  .replace(/\\/g, "/");
const norm = (p) => p.replace(/\\/g, "/").replace(TARGETS_ROOT + "/", "");
const oracleMap = new Map(Object.entries(oracleDetail).map(([k, v]) => [norm(k), v]));

let detailMismatch = 0;
const allPaths = new Set([...oracleMap.keys(), ...detail.keys()]);
for (const p of allPaths) {
  const a = oracleMap.get(p) ?? 0;
  const b = detail.get(p) ?? 0;
  if (Math.abs(a - b) > 1e-6) {
    detailMismatch++;
    if (detailMismatch <= 20) console.log(`  detailΔ ${p}: oracle=${a} js=${b}`);
  }
}

// --- coords compare ---
const buf = fs.readFileSync(prefix + ".coords.f32");
const oracleCoords = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
let maxErr = 0, sumSq = 0, n = Math.min(oracleCoords.length, coords.length);
let worstIdx = -1;
for (let i = 0; i < n; i++) {
  const e = Math.abs(oracleCoords[i] - coords[i]);
  if (e > maxErr) { maxErr = e; worstIdx = i; }
  sumSq += e * e;
}
const rms = Math.sqrt(sumSq / n);

console.log(`\n== VALIDATION ${path.basename(prefix)} ==`);
console.log(`vertices: oracle ${oracleCoords.length / 3}  js ${coords.length / 3}`);
console.log(`detail stack: oracle ${oracleMap.size}  js ${detail.size}  mismatches ${detailMismatch}`);
console.log(`coord maxErr ${maxErr.toExponential(3)} (vert ${Math.floor(worstIdx / 3)} axis ${worstIdx % 3})  rms ${rms.toExponential(3)}`);
const ok = detailMismatch === 0 && maxErr < 1e-3;
console.log(ok ? "RESULT: ✅ IDENTICAL (within 1e-3)" : "RESULT: ❌ DIVERGENT");
process.exit(ok ? 0 : 2);
