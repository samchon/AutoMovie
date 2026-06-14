// Emit hero1/2/3 MakeHuman configs (macro + feature modifiers).
// Heroes are PURE modifier presets on the asian-female-young base.
// All magnitudes kept within ±0.5 for a natural (non-grotesque) result.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, "configs");

// helper: symmetric eye/cheek/ear levers — `eye-scale-decr|incr` -> l+r fullNames
const eye = (n, v) => ({ [`eyes/l-${n}`]: v, [`eyes/r-${n}`]: v });
const cheek = (n, v) => ({ [`cheek/l-${n}`]: v, [`cheek/r-${n}`]: v });
const merge = (...o) => Object.assign({}, ...o);

const MACRO = { gender: 0.0, age: 0.5, asian: 1.0, muscle: 0.5, weight: 0.5, height: 0.5, proportions: 0.5 };

// hero1 — cute young girl (neoteny): big low-set wide eyes, round short face,
// small nose+chin, full cheeks & lips, high forehead, soft jaw.
const hero1 = {
  macro: { ...MACRO, age: 0.3 }, // ~12yo child to match the cute-girl reference
  modifiers: merge(
    eye("eye-scale-decr|incr", 0.45),
    eye("eye-height1-decr|incr", 0.45),  // R1: taller apertures (biggest miss)
    eye("eye-trans-in|out", 0.1),        // R1: tighten too-wide intercanthal
    eye("eye-trans-down|up", -0.18),     // R1: low-set childlike eyes
    eye("eye-epicanthus-in|out", -0.15), // gentle epicanthic fold
    cheek("cheek-volume-decr|incr", 0.32),
    {
      "head/head-round": 0.27,           // R1: de-dome the balloon crown
      "head/head-scale-vert-decr|incr": -0.06, // R1: lengthen face (raise facialIndex)
      "forehead/forehead-scale-vert-decr|incr": 0.2,
      "nose/nose-scale-vert-decr|incr": -0.22,
      "nose/nose-nostrils-width-decr|incr": -0.32, // R1: narrow too-wide nose
      "nose/nose-scale-depth-decr|incr": -0.15,
      "chin/chin-height-decr|incr": -0.28,
      "chin/chin-prominent-decr|incr": -0.18,
      "chin/chin-bones-decr|incr": -0.2,
      "mouth/mouth-upperlip-volume-decr|incr": 0.25,
      "mouth/mouth-lowerlip-volume-decr|incr": 0.28,
      "mouth/mouth-scale-horiz-decr|incr": -0.1,
      "eyebrows/eyebrows-trans-down|up": 0.08, // R1: lower high brow
    },
  ),
};

// hero2 — refined beauty (극미녀): large elegant upturned eyes, narrow set,
// high cheekbones, tapered defined jaw/chin, long oval face, refined small nose.
const hero2 = {
  macro: { ...MACRO },
  modifiers: merge(
    eye("eye-scale-decr|incr", 0.54),    // R2: largest beauty gap (eyes ~-25%)
    eye("eye-height1-decr|incr", 0.35),  // R2: open aperture taller
    eye("eye-corner2-down|up", 0.2),     // outer corner up (almond upturn)
    eye("eye-eyefold-angle-down|up", 0.15),
    eye("eye-trans-in|out", -0.14),      // narrower set
    cheek("cheek-bones-decr|incr", 0.4),
    cheek("cheek-volume-decr|incr", -0.1),
    {
      "head/head-oval": 0.6,             // R2: long-oval (fixes facialIndex -13%)
      "head/head-scale-vert-decr|incr": 0.28, // R2: lengthen toward tall oval
      "nose/nose-scale-horiz-decr|incr": -0.35, // R2: narrow nose base
      "nose/nose-nostrils-width-decr|incr": -0.4,
      "nose/nose-point-width-decr|incr": -0.25,
      "nose/nose-scale-depth-decr|incr": 0.1,
      "chin/chin-width-decr|incr": -0.45, // R2: slim jaw for V-taper
      "chin/chin-prominent-decr|incr": 0.3, // R2: forward pointed chin
      "chin/chin-height-decr|incr": 0.1,
      "chin/chin-bones-decr|incr": 0.2,
      "mouth/mouth-upperlip-volume-decr|incr": 0.2,
      "mouth/mouth-lowerlip-volume-decr|incr": 0.2,
      "mouth/mouth-cupidsbow-decr|incr": 0.2,
      "eyebrows/eyebrows-angle-down|up": 0.25,
      "eyebrows/eyebrows-trans-down|up": 0.15,
    },
  ),
};

// hero3 — 절세미인 (stunning, balanced): a harmonious elevation of every region,
// neither cute-exaggerated nor sharply mature — the flagship base.
const hero3 = {
  macro: { ...MACRO, age: 0.3 }, // R3: ~15yo teen (was 0.42, read too old)
  modifiers: merge(
    eye("eye-scale-decr|incr", 0.42),    // R3: bigger softer teen eyes
    eye("eye-height1-decr|incr", 0.2),
    eye("eye-corner2-down|up", 0.18),    // R3: slight outer-canthus lift
    cheek("cheek-bones-decr|incr", 0.25),
    cheek("cheek-inner-decr|incr", 0.15), // R3: juvenile apple-cheek fullness
    {
      "head/head-oval": 0.3,
      "nose/nose-nostrils-width-decr|incr": -0.35, // R3: narrow alar base
      "nose/nose-scale-horiz-decr|incr": -0.32,    // R3: narrow nose
      "nose/nose-scale-depth-decr|incr": 0.05,
      "nose/nose-base-down|up": 0.12,    // R3: soft juvenile upturn
      "chin/chin-width-decr|incr": -0.2,
      "chin/chin-height-decr|incr": -0.2,    // R3: shorten long lower face
      "chin/chin-prominent-decr|incr": -0.15, // R3: pull adult chin back
      "chin/chin-jaw-drop-decr|incr": -0.15,  // R3: soften square jaw
      "chin/chin-bones-decr|incr": 0.1,
      "mouth/mouth-upperlip-volume-decr|incr": 0.2,
      "mouth/mouth-lowerlip-volume-decr|incr": 0.2,
      "eyebrows/eyebrows-angle-down|up": 0.15,
    },
  ),
};

const heroes = { hero1, hero2, hero3 };
for (const [name, cfg] of Object.entries(heroes)) {
  fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(cfg, null, 1));
  console.log("wrote", name, "modifiers:", Object.keys(cfg.modifiers).length);
}
