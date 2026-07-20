// Emit hero1/2/3 MakeHuman configs (macro + feature modifiers).
// Heroes are PURE modifier presets on the asian-female-young base.
// All magnitudes kept within ±0.5 for a natural (non-grotesque) result.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, "configs");

// helper: symmetric eye/cheek/ear levers. `eye-scale-decr|incr` -> l+r fullNames
const eye = (n, v) => ({ [`eyes/l-${n}`]: v, [`eyes/r-${n}`]: v });
const cheek = (n, v) => ({ [`cheek/l-${n}`]: v, [`cheek/r-${n}`]: v });
const merge = (...o) => Object.assign({}, ...o);

const MACRO = { gender: 0.0, age: 0.5, asian: 1.0, muscle: 0.5, weight: 0.5, height: 0.5, proportions: 0.5 };

// hero1: cute young girl (neoteny): big low-set wide eyes, round short face,
// small nose+chin, full cheeks & lips, high forehead, soft jaw.
const hero1 = {
  macro: { ...MACRO, age: 0.21 }, // R3: younger child (midface too tall at 0.24)
  modifiers: merge(
    // R6: measurement-driven (mhdissect hero1-front): lips +80%/+39%, mouth -15%
    // & too low, eyeOpenness -14%, facialIndex -13%.
    eye("eye-scale-decr|incr", 0.7),
    eye("eye-height1-decr|incr", 0.66),
    eye("eye-height2-decr|incr", 0.3),   // R6: open aperture (was -14%)
    eye("eye-trans-in|out", -0.1),
    eye("eye-trans-down|up", -0.18),
    eye("eye-epicanthus-in|out", -0.15),
    cheek("cheek-volume-decr|incr", 0.52),
    {
      "head/head-round": 0.27,
      "head/head-scale-vert-decr|incr": 0.1, // R6: lengthen (facialIndex -13%)
      "forehead/forehead-scale-vert-decr|incr": 0.2,
      "nose/nose-scale-vert-decr|incr": -0.22,
      "nose/nose-nostrils-width-decr|incr": -0.4, // R6: ease (don't over-narrow)
      "nose/nose-scale-depth-decr|incr": -0.15,
      "chin/chin-height-decr|incr": -0.38,
      "chin/chin-prominent-decr|incr": -0.42,
      "chin/chin-bones-decr|incr": -0.28,
      "mouth/mouth-trans-down|up": 0.3, // R6: raise mouth (eyeToMouth +15%)
      "mouth/mouth-scale-horiz-decr|incr": 0.25, // R6: widen mouth (was -15%)
      "mouth/mouth-upperlip-volume-decr|incr": 0.0,
      "mouth/mouth-lowerlip-volume-decr|incr": 0.0,
      "mouth/mouth-upperlip-height-decr|incr": -0.9, // R6: lips +80% → thin hard
      "mouth/mouth-lowerlip-height-decr|incr": -0.7,
      "eyebrows/eyebrows-trans-down|up": 0.2, // R6: raise brow (browToEye -8%)
    },
  ),
};

// hero2: refined beauty (극미녀): large elegant upturned eyes, narrow set,
// high cheekbones, tapered defined jaw/chin, long oval face, refined small nose.
const hero2 = {
  macro: { ...MACRO },
  modifiers: merge(
    // R6: measurement-driven (mhdissect hero2-front): mostly close (±3%) EXCEPT
    // browToEye -30% (tall eyes crowd the brow), lips +14%, irisSpacing -6.6%.
    eye("eye-scale-decr|incr", 0.7),
    eye("eye-height1-decr|incr", 0.65),
    eye("eye-corner2-down|up", 0.32),
    eye("eye-eyefold-angle-down|up", 0.15),
    eye("eye-trans-in|out", -0.05),      // R6: ease (irisSpacing -6.6%)
    cheek("cheek-bones-decr|incr", 0.55),
    cheek("cheek-volume-decr|incr", -0.2),
    {
      "head/head-oval": 0.7,
      "head/head-scale-vert-decr|incr": 0.55,
      "nose/nose-scale-horiz-decr|incr": -0.5,
      "nose/nose-nostrils-width-decr|incr": -0.35,
      "nose/nose-point-width-decr|incr": -0.4,
      "nose/nose-scale-depth-decr|incr": 0.1,
      "chin/chin-width-decr|incr": -0.62,
      "chin/chin-prominent-decr|incr": 0.6,
      "chin/chin-jaw-drop-decr|incr": -0.15,
      "chin/chin-height-decr|incr": 0.1,
      "chin/chin-bones-decr|incr": 0.2,
      "mouth/mouth-upperlip-volume-decr|incr": 0.0,
      "mouth/mouth-lowerlip-volume-decr|incr": 0.0,
      "mouth/mouth-upperlip-height-decr|incr": -0.6, // R6: lips +14% → thinner
      "mouth/mouth-lowerlip-height-decr|incr": -0.5,
      "mouth/mouth-cupidsbow-decr|incr": 0.2,
      "eyebrows/eyebrows-angle-down|up": 0.25,
      "eyebrows/eyebrows-trans-down|up": 0.5, // R6: raise brow much more (browToEye -30%)
    },
  ),
};

// hero3: 절세미인 (stunning, balanced): a harmonious elevation of every region,
// neither cute-exaggerated nor sharply mature: the flagship base.
const hero3 = {
  macro: { ...MACRO, age: 0.27 }, // ~14yo teen
  // R5: measurement-driven (mhdissect hero3-front). Fixes the over/under-shoots
  // the FULL metric set exposed: lips +41% too thick, eyes -20% openness, nose
  // over-narrowed -9%, brow gap -23% (eyes raised too high), face -12% too short,
  // mouth -14% too narrow + too low.
  modifiers: merge(
    eye("eye-scale-decr|incr", 0.36),    // R6: eyeWidth was +6%
    eye("eye-height1-decr|incr", 0.5),   // open aperture
    eye("eye-height2-decr|incr", 0.3),
    eye("eye-corner2-down|up", 0.2),
    eye("eye-trans-down|up", 0.0),
    eye("eye-trans-in|out", -0.05),
    cheek("cheek-bones-decr|incr", 0.15),
    cheek("cheek-inner-decr|incr", 0.15),
    {
      "head/head-oval": 0.4,
      "head/head-scale-vert-decr|incr": 0.3, // taller face
      "head/head-age-decr|incr": -0.3,
      "nose/nose-nostrils-width-decr|incr": 0.0, // R6: un-narrow fully (was -9.6%)
      "nose/nose-scale-horiz-decr|incr": 0.0,
      "nose/nose-scale-depth-decr|incr": 0.05,
      "nose/nose-base-down|up": 0.12,
      "nose/nose-trans-backward|forward": 0.08,
      "chin/chin-width-decr|incr": -0.2,
      "chin/chin-height-decr|incr": -0.3,
      "chin/chin-prominent-decr|incr": -0.15,
      "chin/chin-jaw-drop-decr|incr": -0.15,
      "chin/chin-bones-decr|incr": 0.1,
      "mouth/mouth-trans-down|up": 0.25,  // raise mouth
      "mouth/mouth-scale-horiz-decr|incr": 0.3, // R6: widen mouth more (was -8%)
      "mouth/mouth-upperlip-volume-decr|incr": 0.0,
      "mouth/mouth-lowerlip-volume-decr|incr": 0.0,
      "mouth/mouth-upperlip-height-decr|incr": -0.85, // R6: lips still +11% → thinner
      "mouth/mouth-lowerlip-height-decr|incr": -0.7,
      "eyebrows/eyebrows-angle-down|up": 0.15,
      "eyebrows/eyebrows-trans-down|up": 0.35, // R6: raise brow (browToEye -20%)
    },
  ),
};

const heroes = { hero1, hero2, hero3 };
for (const [name, cfg] of Object.entries(heroes)) {
  fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(cfg, null, 1));
  console.log("wrote", name, "modifiers:", Object.keys(cfg.modifiers).length);
}
