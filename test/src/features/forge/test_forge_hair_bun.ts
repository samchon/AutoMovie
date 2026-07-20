import { buildHairBun, buildSkullShell } from "@automovie/forge";
import { TestValidator } from "@nestia/e2e";

/**
 * The chignon lobe rides the occiput: size `0` must yield empty parts (the
 * preset schema covers bunless styles), a real bun sits wholly BEHIND the
 * head's center plane, and `height` moves it up the occiput. The lobe must also
 * stay inside the skull's vertical span: a bun floating off the head is the
 * failure this pins.
 *
 * Scenario: size 0 → empty; size 0.8 at two heights → both behind (mean z < 0),
 * the higher one strictly higher, both within the dome's y range. The mesh must
 * also wind OUTWARD (#1041): its signed volume is positive. The z-mirrored
 * parameterization previously kept the skull's winding and faced every triangle
 * into the bun.
 */
export const test_forge_hair_bun = (): void => {
  const none = buildHairBun({ size: 0, height: 0.5 });
  TestValidator.equals("size 0 is empty", none.positions.length, 0);
  TestValidator.equals("size 0 has no triangles", none.indices.length, 0);

  const skull = { width: 0, crown: 0, depth: 0 };
  const low = buildHairBun({ size: 0.8, height: 0.2 }, skull);
  const high = buildHairBun({ size: 0.8, height: 0.9 }, skull);
  const mean = (p: number[], k: number): number => {
    let s = 0;
    for (let i = k; i < p.length; i += 3) s += p[i]!;
    return s / (p.length / 3);
  };
  TestValidator.predicate(
    "bun sits behind the head",
    mean(low.positions, 2) < 0 && mean(high.positions, 2) < 0,
  );
  TestValidator.predicate(
    "height raises the bun",
    mean(high.positions, 1) > mean(low.positions, 1) + 0.02,
  );
  const dome = buildSkullShell(skull);
  let domeTop = -Infinity;
  let domeBot = Infinity;
  for (let i = 1; i < dome.positions.length; i += 3) {
    domeTop = Math.max(domeTop, dome.positions[i]!);
    domeBot = Math.min(domeBot, dome.positions[i]!);
  }
  for (const part of [low, high])
    for (let i = 1; i < part.positions.length; i += 3) {
      const y = part.positions[i]!;
      if (y < domeBot - 0.06 || y > domeTop + 0.06)
        throw new Error("bun strays off the skull's vertical span");
    }

  // winding: outward-facing triangles enclose a positive signed volume
  const signedVolume = (part: {
    positions: number[];
    indices: number[];
  }): number => {
    let six = 0;
    for (let i = 0; i < part.indices.length; i += 3) {
      const [a, b, c] = [
        part.indices[i]! * 3,
        part.indices[i + 1]! * 3,
        part.indices[i + 2]! * 3,
      ];
      const p = part.positions;
      six +=
        p[a]! * (p[b + 1]! * p[c + 2]! - p[b + 2]! * p[c + 1]!) -
        p[a + 1]! * (p[b]! * p[c + 2]! - p[b + 2]! * p[c]!) +
        p[a + 2]! * (p[b]! * p[c + 1]! - p[b + 1]! * p[c]!);
    }
    return six / 6;
  };
  TestValidator.predicate(
    "the bun winds outward (positive signed volume)",
    signedVolume(low) > 0 && signedVolume(high) > 0,
  );
};
