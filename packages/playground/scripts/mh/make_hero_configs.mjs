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
  macro: { ...MACRO, age: 0.24 }, // R2: ~11yo child (was 0.3, read too teen)
  modifiers: merge(
    eye("eye-scale-decr|incr", 0.55),    // R2: bigger child eyes (cap 0.55)
    eye("eye-height1-decr|incr", 0.53),  // R2: round the aperture
    eye("eye-trans-in|out", 0.0),        // R2: neutral close-set
    eye("eye-trans-down|up", -0.18),     // low-set childlike eyes
    eye("eye-epicanthus-in|out", -0.15), // gentle epicanthic fold
    cheek("cheek-volume-decr|incr", 0.42), // R2: baby-fat hides jaw (cap 0.42)
    {
      "head/head-round": 0.27,           // de-dome the balloon crown
      "head/head-scale-vert-decr|incr": -0.06,
      "forehead/forehead-scale-vert-decr|incr": 0.2,
      "nose/nose-scale-vert-decr|incr": -0.22,
      "nose/nose-nostrils-width-decr|incr": -0.42, // R2: narrow small child nose
      "nose/nose-scale-depth-decr|incr": -0.15,
      "chin/chin-height-decr|incr": -0.38, // R2: shorten lower third
      "chin/chin-prominent-decr|incr": -0.28, // R2: recess forward chin
      "chin/chin-bones-decr|incr": -0.28,  // R2: soften gonial/jaw
      "mouth/mouth-upperlip-volume-decr|incr": 0.25,
      "mouth/mouth-lowerlip-volume-decr|incr": 0.28,
      "mouth/mouth-scale-horiz-decr|incr": -0.1,
      "eyebrows/eyebrows-trans-down|up": 0.08,
    },
  ),
};

// hero2 — refined beauty (극미녀): large elegant upturned eyes, narrow set,
// high cheekbones, tapered defined jaw/chin, long oval face, refined small nose.
const hero2 = {
  macro: { ...MACRO },
  modifiers: merge(
    eye("eye-scale-decr|incr", 0.66),    // R2.2: signature large eyes (cap 0.66)
    eye("eye-height1-decr|incr", 0.5),   // R2.2: open aperture vertically
    eye("eye-corner2-down|up", 0.2),     // outer corner up (almond upturn)
    eye("eye-eyefold-angle-down|up", 0.15),
    eye("eye-trans-in|out", -0.14),      // narrower set
    cheek("cheek-bones-decr|incr", 0.4),
    cheek("cheek-volume-decr|incr", -0.2), // R2.2: carve sub-cheekbone hollow
    {
      "head/head-oval": 0.7,             // R2.2: reinforce tall oval
      "head/head-scale-vert-decr|incr": 0.43, // R2.2: lengthen face (facialIndex -13%)
      "nose/nose-scale-horiz-decr|incr": -0.5, // R2.2: narrow refined nose
      "nose/nose-nostrils-width-decr|incr": -0.4,
      "nose/nose-point-width-decr|incr": -0.25,
      "nose/nose-scale-depth-decr|incr": 0.1,
      "chin/chin-width-decr|incr": -0.45, // slim jaw for V-taper
      "chin/chin-prominent-decr|incr": 0.45, // R2.2: forward pointed chin
      "chin/chin-jaw-drop-decr|incr": -0.15, // R2.2: taper full jaw
      "chin/chin-height-decr|incr": 0.1,
      "chin/chin-bones-decr|incr": 0.2,
      "mouth/mouth-upperlip-volume-decr|incr": 0.2,
      "mouth/mouth-lowerlip-volume-decr|incr": 0.2,
      "mouth/mouth-cupidsbow-decr|incr": 0.2,
      "eyebrows/eyebrows-angle-down|up": 0.25,
      "eyebrows/eyebrows-trans-down|up": 0.05, // R2.2: shrink heavy upper-lid gap
    },
  ),
};

// hero3 — 절세미인 (stunning, balanced): a harmonious elevation of every region,
// neither cute-exaggerated nor sharply mature — the flagship base.
const hero3 = {
  macro: { ...MACRO, age: 0.27 }, // R2.2: ~14yo teen (small step from 0.3)
  modifiers: merge(
    eye("eye-scale-decr|incr", 0.42),    // bigger softer teen eyes
    eye("eye-height1-decr|incr", 0.2),
    eye("eye-corner2-down|up", 0.18),    // slight outer-canthus lift
    eye("eye-trans-down|up", 0.12),      // R2.2: raise eyes, tighten brow gap
    cheek("cheek-bones-decr|incr", 0.15), // R2.2: slim fuller-than-teen lower face
    cheek("cheek-inner-decr|incr", 0.15), // juvenile apple-cheek fullness
    {
      "head/head-oval": 0.3,
      "head/head-age-decr|incr": -0.1,   // R2.2: juvenile cranial proportions
      "nose/nose-nostrils-width-decr|incr": -0.5, // R2.2: narrow alar base
      "nose/nose-scale-horiz-decr|incr": -0.32,
      "nose/nose-scale-depth-decr|incr": 0.05,
      "nose/nose-base-down|up": 0.12,    // soft juvenile upturn
      "nose/nose-trans-backward|forward": 0.08, // R2.2: restore tip projection
      "chin/chin-width-decr|incr": -0.2,
      "chin/chin-height-decr|incr": -0.35,   // R2.2: shorten long lower face
      "chin/chin-prominent-decr|incr": -0.15,
      "chin/chin-jaw-drop-decr|incr": -0.15,
      "chin/chin-bones-decr|incr": 0.1,
      "mouth/mouth-trans-down|up": 0.1,  // R2.2: raise low mouth
      "mouth/mouth-upperlip-volume-decr|incr": 0.2,
      "mouth/mouth-lowerlip-volume-decr|incr": 0.1, // R2.2: lighter lower lip
      "eyebrows/eyebrows-angle-down|up": 0.15,
    },
  ),
};

const heroes = { hero1, hero2, hero3 };
for (const [name, cfg] of Object.entries(heroes)) {
  fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(cfg, null, 1));
  console.log("wrote", name, "modifiers:", Object.keys(cfg.modifiers).length);
}
