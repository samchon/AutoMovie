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
  macro: { ...MACRO, age: 0.46 },
  modifiers: merge(
    eye("eye-scale-decr|incr", 0.45),
    eye("eye-height1-decr|incr", 0.3),
    eye("eye-trans-in|out", 0.22),       // wider set
    eye("eye-trans-down|up", -0.12),     // slightly lower
    eye("eye-epicanthus-in|out", -0.15), // gentle epicanthic fold
    cheek("cheek-volume-decr|incr", 0.32),
    {
      "head/head-round": 0.42,
      "head/head-scale-vert-decr|incr": -0.18,
      "forehead/forehead-scale-vert-decr|incr": 0.2,
      "nose/nose-scale-vert-decr|incr": -0.22,
      "nose/nose-nostrils-width-decr|incr": -0.2,
      "nose/nose-scale-depth-decr|incr": -0.15,
      "chin/chin-height-decr|incr": -0.28,
      "chin/chin-prominent-decr|incr": -0.18,
      "chin/chin-bones-decr|incr": -0.2,
      "mouth/mouth-upperlip-volume-decr|incr": 0.25,
      "mouth/mouth-lowerlip-volume-decr|incr": 0.28,
      "mouth/mouth-scale-horiz-decr|incr": -0.1,
      "eyebrows/eyebrows-trans-down|up": 0.2,
    },
  ),
};

// hero2 — refined beauty (극미녀): large elegant upturned eyes, narrow set,
// high cheekbones, tapered defined jaw/chin, long oval face, refined small nose.
const hero2 = {
  macro: { ...MACRO },
  modifiers: merge(
    eye("eye-scale-decr|incr", 0.36),
    eye("eye-height1-decr|incr", 0.2),
    eye("eye-corner2-down|up", 0.2),     // outer corner up (almond upturn)
    eye("eye-eyefold-angle-down|up", 0.15),
    eye("eye-trans-in|out", -0.14),      // narrower set
    cheek("cheek-bones-decr|incr", 0.4),
    cheek("cheek-volume-decr|incr", -0.1),
    {
      "head/head-oval": 0.4,
      "head/head-scale-vert-decr|incr": 0.18,
      "nose/nose-scale-horiz-decr|incr": -0.25,
      "nose/nose-nostrils-width-decr|incr": -0.3,
      "nose/nose-point-width-decr|incr": -0.25,
      "nose/nose-scale-depth-decr|incr": 0.1,
      "chin/chin-width-decr|incr": -0.3,
      "chin/chin-prominent-decr|incr": 0.15,
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
  macro: { ...MACRO },
  modifiers: merge(
    eye("eye-scale-decr|incr", 0.3),
    eye("eye-height1-decr|incr", 0.2),
    eye("eye-corner2-down|up", 0.12),
    cheek("cheek-bones-decr|incr", 0.25),
    {
      "head/head-oval": 0.3,
      "nose/nose-nostrils-width-decr|incr": -0.25,
      "nose/nose-scale-horiz-decr|incr": -0.2,
      "nose/nose-scale-depth-decr|incr": 0.05,
      "chin/chin-width-decr|incr": -0.2,
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
