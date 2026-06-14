// Closed-loop MakeHuman fitter: render -> dissect -> nudge levers toward the
// reference metrics -> repeat. Coordinate descent on the modifier values until
// the measured face matches the reference photo. Exhausts MakeHuman's geometry
// before any "it can't" claim.
//
// Usage: node mh_solve.mjs <hero> <hair> [iters]
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../..");
const PY = "C:/Users/samch/AppData/Local/Programs/Python/Python311/python.exe";
const [hero, hair = "long01", itersArg] = process.argv.slice(2);
const iters = +(itersArg || 6);
const cfgPath = path.join(here, "configs", `${hero}.json`);
const objPath = path.join(root, "packages/playground/public/mh", `${hero}_full.obj`);
const renderPng = path.join(root, ".shots/mh-full", `${hero}_full`, "front.png");
const refPng = path.join(root, ".shots/_measure", `refcell-${hero}-front.png`);
const dissectJson = path.join(root, ".shots/_measure", `mhdissect-${hero}-front.json`);

// metric -> { keys:[config keys], sign:+1 if raising the lever RAISES the metric }
const E = (n) => [`eyes/l-${n}`, `eyes/r-${n}`];
const MAP = {
  lipThicknessToFace: { keys: ["mouth/mouth-scale-vert-decr|incr"], sign: +1 },
  eyeOpenness:        { keys: E("eye-height1-decr|incr"), sign: +1 },
  eyeWidthToFace:     { keys: E("eye-scale-decr|incr"), sign: +1 },
  facialIndex:        { keys: ["head/head-scale-vert-decr|incr"], sign: +1 },
  noseWidthToFace:    { keys: ["nose/nose-scale-horiz-decr|incr"], sign: +1 },
  mouthWidthToFace:   { keys: ["mouth/mouth-scale-horiz-decr|incr"], sign: +1 },
  eyeToMouth:         { keys: ["mouth/mouth-trans-down|up"], sign: -1 },
  browToEye:          { keys: ["eyebrows/eyebrows-trans-down|up"], sign: +1 },
  irisSpacingToFace:  { keys: E("eye-trans-in|out"), sign: +1 },
};
const GAIN = 1.3, MAXSTEP = 0.25, CLAMP = 1.0, DEADBAND = 0.03;
const clamp = (v) => Math.max(-CLAMP, Math.min(CLAMP, v));

const run = (cmd) => execSync(cmd, { cwd: root, stdio: ["ignore", "pipe", "pipe"] }).toString();
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
cfg.modifiers = cfg.modifiers || {};
let best = { rms: Infinity, mods: null };

for (let it = 0; it <= iters; it++) {
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 1));
  run(`"${PY}" packages/playground/scripts/mh/mh_build_hero.py "${cfgPath}" "${objPath}" --hair ${hair}`);
  process.env.VIEWS = "front"; process.env.MODEL = `${hero}_full`; process.env.PAGE = "mhfull.html";
  run(`node packages/playground/scripts/mh/mh_capture.mjs`);
  run(`node packages/playground/scripts/mh/mh_dissect.mjs "${renderPng}" "${refPng}" ${hero}-front`);
  const d = JSON.parse(fs.readFileSync(dissectJson, "utf8"));
  if (!d.modelDetected) { console.log(`iter ${it}: model not detected`); break; }
  const err = Object.fromEntries(d.metrics.map((m) => [m.metric, m.relErr]));
  const rms = Math.sqrt(d.metrics.reduce((s, m) => s + m.relErr * m.relErr, 0) / d.metrics.length);
  console.log(`iter ${it}: RMS ${(rms * 100).toFixed(1)}%  | ` +
    Object.keys(MAP).map((k) => `${k.slice(0, 6)} ${((err[k] || 0) * 100).toFixed(0)}`).join("  "));
  if (rms < best.rms) best = { rms, mods: JSON.parse(JSON.stringify(cfg.modifiers)) };
  if (it === iters) break;
  for (const [metric, { keys, sign }] of Object.entries(MAP)) {
    const re = err[metric];
    if (re == null || Math.abs(re) < DEADBAND) continue;
    let delta = -GAIN * re * sign;
    delta = Math.max(-MAXSTEP, Math.min(MAXSTEP, delta));
    for (const k of keys) cfg.modifiers[k] = +clamp((cfg.modifiers[k] || 0) + delta).toFixed(3);
  }
}

cfg.modifiers = best.mods;
fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 1));
console.log(`\nBEST RMS ${(best.rms * 100).toFixed(1)}% saved to ${path.relative(root, cfgPath)}`);
