// Parse a MakeHuman .mhm model file into our hero config JSON ({macro, modifiers}).
// Lets us reuse community / research .mhm parameter sets (e.g. FaReT face identities).
// Usage: node mhm_to_config.mjs <in.mhm> <out.json> [--asian]
import fs from "node:fs";

const [inPath, outPath, ...flags] = process.argv.slice(2);
const forceAsian = flags.includes("--asian");
const txt = fs.readFileSync(inPath, "utf8");
const macro = {}, modifiers = {};
const MACRO = {
  "macrodetails/Gender": "gender",
  "macrodetails/Age": "age",
  "macrodetails/African": "african",
  "macrodetails/Asian": "asian",
  "macrodetails/Caucasian": "caucasian",
  "macrodetails-universal/Muscle": "muscle",
  "macrodetails-universal/Weight": "weight",
  "macrodetails-height/Height": "height",
  "macrodetails-proportions/BodyProportions": "proportions",
};
for (const line of txt.split("\n")) {
  const m = line.match(/^modifier\s+(\S+)\s+(-?[\d.]+)/);
  if (!m) continue;
  const [, name, valStr] = m;
  const val = +valStr;
  if (MACRO[name]) macro[MACRO[name]] = val;
  else modifiers[name] = val;
}
if (forceAsian) { macro.asian = 1.0; macro.caucasian = 0.0; macro.african = 0.0; }
fs.writeFileSync(outPath, JSON.stringify({ macro, modifiers }, null, 1));
console.log("wrote", outPath, "| macro", JSON.stringify(macro), "| modifiers", Object.keys(modifiers).length);
