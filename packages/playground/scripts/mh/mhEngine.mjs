// MakeHuman macro + modifier geometry engine — faithful JS port.
//
// Reproduces MakeHuman's mesh generation exactly:
//   coord = base.obj + Σ_path detail[path] · delta(path)
// where detail[path] = Π factors[f] over the target's factor dependencies,
// and factors come from the macro *Val formulas (humanmodifier.getTargetWeights +
// human._set*Vals) and the per-modifier left/center/right weights
// (UniversalModifier.getFactors).
//
// Validated vertex-for-vertex against the headless oracle (mh_export.py).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MH_ROOT = path.resolve(__dirname, "../../../../.references/makehuman/makehuman");
const TARGETS_DIR = path.join(MH_ROOT, "data/targets");
const BASE_OBJ = path.join(MH_ROOT, "data/3dobjs/base.obj");

// ---- base mesh ----------------------------------------------------------
export function loadBaseCoords(objPath = BASE_OBJ) {
  const txt = fs.readFileSync(objPath, "utf8");
  const xs = [];
  for (const line of txt.split("\n")) {
    if (line.charCodeAt(0) === 118 /* v */ && line[1] === " ") {
      const p = line.split(/\s+/);
      xs.push(+p[1], +p[2], +p[3]);
    }
  }
  return new Float32Array(xs);
}

// ---- .target cache ------------------------------------------------------
const targetCache = new Map();
export function loadTarget(relPath) {
  if (targetCache.has(relPath)) return targetCache.get(relPath);
  const full = path.join(TARGETS_DIR, relPath);
  const idx = [];
  const dxyz = [];
  if (fs.existsSync(full)) {
    const txt = fs.readFileSync(full, "utf8");
    for (const line of txt.split("\n")) {
      if (!line || line[0] === "#") continue;
      const p = line.trim().split(/\s+/);
      if (p.length !== 4) continue;
      idx.push(+p[0]);
      dxyz.push(+p[1], +p[2], +p[3]);
    }
  }
  const t = { idx: new Int32Array(idx), d: new Float32Array(dxyz) };
  targetCache.set(relPath, t);
  return t;
}

// ---- macro *Val formulas (ports apps/human.py) --------------------------
// Returns a flat map of value-name -> weight, keyed exactly like targets._value_cat.
export function computeVals(macro = {}) {
  const gender = macro.gender ?? 0.0;        // 0 female, 1 male
  const age = macro.age ?? 0.5;              // 0 baby .. 1 old
  const muscle = macro.muscle ?? 0.5;
  const weight = macro.weight ?? 0.5;
  const height = macro.height ?? 0.5;
  const proportions = macro.proportions ?? 0.5;
  const breastSize = macro.breastSize ?? 0.5;
  const breastFirmness = macro.breastFirmness ?? 0.5;

  const v = {};
  // gender
  v.male = gender;
  v.female = 1 - gender;
  // age (apps/human.py _setAgeVals)
  if (age < 0.5) {
    v.old = 0.0;
    v.baby = Math.max(0.0, 1 - age * 5.333);
    v.young = Math.max(0.0, (age - 0.1875) * 3.2);
    v.child = Math.max(0.0, Math.min(1.0, 5.333 * age) - v.young);
  } else {
    v.child = 0.0;
    v.baby = 0.0;
    v.old = Math.max(0.0, age * 2 - 1);
    v.young = 1 - v.old;
  }
  // weight
  v.maxweight = Math.max(0.0, weight * 2 - 1);
  v.minweight = Math.max(0.0, 1 - weight * 2);
  v.averageweight = 1 - (v.maxweight + v.minweight);
  // muscle
  v.maxmuscle = Math.max(0.0, muscle * 2 - 1);
  v.minmuscle = Math.max(0.0, 1 - muscle * 2);
  v.averagemuscle = 1 - (v.maxmuscle + v.minmuscle);
  // height (average = 1 - max(min,max))
  v.maxheight = Math.max(0.0, height * 2 - 1);
  v.minheight = Math.max(0.0, 1 - height * 2);
  v.averageheight = 1 - Math.max(v.maxheight, v.minheight);
  // breast size
  v.maxcup = Math.max(0.0, breastSize * 2 - 1);
  v.mincup = Math.max(0.0, 1 - breastSize * 2);
  v.averagecup = 1 - Math.max(v.maxcup, v.mincup);
  // breast firmness
  v.maxfirmness = Math.max(0.0, breastFirmness * 2 - 1);
  v.minfirmness = Math.max(0.0, 1 - breastFirmness * 2);
  v.averagefirmness = 1 - Math.max(v.maxfirmness, v.minfirmness);
  // proportions
  v.idealproportions = Math.max(0.0, proportions * 2 - 1);
  v.uncommonproportions = Math.max(0.0, 1 - proportions * 2);
  v.regularproportions = 1 - Math.max(v.idealproportions, v.uncommonproportions);
  // race (ethnic) — normalized to sum 1, mimicking setCaucasian/African(sync=False)
  // then setAsian(sync=True): exclude='asian', distribute remaining over the rest.
  ethnicVals(v, macro);
  return v;
}

function ethnicVals(v, macro) {
  let cau = macro.caucasian ?? 0.0;
  let asn = macro.asian ?? 1.0;
  let afr = macro.african ?? 0.0;
  // _setEthnicVals(exclude='asian')
  const remaining = 1.0 - asn;
  const otherTotal = cau + afr;
  if (otherTotal === 0.0) {
    if (Math.abs(asn - 1.0) <= 0.001) {
      cau = 0; afr = 0; asn = 1;
    } else if (asn === 0) {
      cau = afr = asn = 1 / 3;
    } else {
      // both others 0 but asian in (0,1): MakeHuman bumps them to 0.01 then renorm
      cau = afr = 0.01;
      const ot = cau + afr;
      cau = remaining * (cau / ot);
      afr = remaining * (afr / ot);
    }
  } else {
    cau = remaining * (cau / otherTotal);
    afr = remaining * (afr / otherTotal);
  }
  v.caucasian = cau;
  v.asian = asn;
  v.african = afr;
}

// ---- modifier table -----------------------------------------------------
export function loadModifierTable(jsonPath = path.resolve(__dirname, "../../data/mh/modifiers.json")) {
  return JSON.parse(fs.readFileSync(jsonPath, "utf8"));
}

// ---- detail stack -------------------------------------------------------
// macro: slider values. features: { fullName: value }.
// Returns { path: weight } reproducing human.targetsDetailStack.
export function computeDetailStack(table, macro = {}, features = {}) {
  const vals = computeVals(macro);
  const byName = new Map(table.modifiers.map((m) => [m.fullName, m]));
  const detail = new Map();

  const writeTargets = (mod, factors) => {
    for (const t of mod.targets) {
      let w = 1.0;
      for (const f of t.factors) w *= factors[f] ?? 0.0;
      if (w !== 0.0) detail.set(t.path, w);
      else detail.delete(t.path);
    }
  };

  // Macro modifiers always contribute (driven by the macro sliders).
  for (const m of table.modifiers) {
    if (m.type === "MacroModifier" || m.type === "EthnicModifier") {
      const factors = { ...vals, [m.group]: 1.0 };
      writeTargets(m, factors);
    }
  }

  // Explicitly-set feature (Universal/Simple) modifiers.
  for (const [fullName, value] of Object.entries(features)) {
    const m = byName.get(fullName);
    if (!m) { console.warn("unknown modifier", fullName); continue; }
    const factors = { ...vals };
    if (m.left != null) factors[m.left] = -Math.min(value, 0.0);
    if (m.center != null) factors[m.center] = 1.0 - Math.abs(value);
    if (m.right != null) factors[m.right] = Math.max(0.0, value);
    if (m.type === "SimpleModifier") factors["dummy"] = 1.0;
    writeTargets(m, factors);
  }

  return detail;
}

// ---- final mesh ---------------------------------------------------------
export function buildMesh(table, macro = {}, features = {}, baseCoords = null) {
  const base = (baseCoords ?? loadBaseCoords()).slice();
  const detail = computeDetailStack(table, macro, features);
  for (const [relPath, weight] of detail) {
    const t = loadTarget(relPath);
    const { idx, d } = t;
    for (let i = 0; i < idx.length; i++) {
      const vi = idx[i] * 3;
      base[vi] += d[i * 3] * weight;
      base[vi + 1] += d[i * 3 + 1] * weight;
      base[vi + 2] += d[i * 3 + 2] * weight;
    }
  }
  return { coords: base, detail };
}
