import { extrudeAutoMovieRegion } from "@automovie/engine";
import { buildModel } from "@automovie/viewer";

// Shared in-memory diagnostic candidate. No production geometry is published.
export function applyManorStairCandidate(source) {
  const stair = source.entries.find(entry => entry.id === "central-stair");
  const profile = upper => {
    const outer = [];
    for (let i = 0; i < 7; i++) {
      const y = (upper ? 2 : 0.56) + 0.18 * i;
      outer.push({ x: 0.26 * i, y }, { x: upper && i === 6 ? 1.84 : 0.26 * (i + 1), y });
    }
    if (upper) outer.push({ x: 1.84, y: 2.86 }, { x: 0, y: 1.77 });
    else outer.push({ x: 1.82, y: 1.77 }, { x: 1.95, y: 1.77 }, { x: 1.95, y: 1.51 }, { x: 0.26, y: 0.45 }, { x: 0, y: 0.45 });
    return extrudeAutoMovieRegion({ outer, holes: [], depth: 0.14 });
  };
  stair.model.parts = stair.model.parts.map(part => {
    if (part.id === "inner-turn-join") return { ...part,
      geometry: { type: "primitive", shape: { type: "box", width: 0.065, height: 0.065, depth: 0.1325 } },
      transform: { translation: { x: -0.07, y: 2.81, z: -4.05375 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } },
    };
    const lower = part.id.startsWith("lower-stringer-");
    const upper = part.id.startsWith("upper-stringer-");
    if (!lower && !upper) return part;
    const center = Number(part.id.slice((lower ? "lower-stringer-" : "upper-stringer-").length));
    return { ...part, geometry: { type: "mesh", mesh: profile(upper) }, transform: {
      translation: lower ? { x: center, y: 0, z: -2.17 } : { x: -0.04, y: 0, z: center },
      rotation: lower ? { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 } : { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
    } };
  });
  source.scene.remove(source.objects.get("central-stair"));
  const { object } = buildModel(stair.model);
  source.scene.add(object);
  source.objects.set("central-stair", object);
}
