import {
  CANONICAL_FACE_POSITIONS,
  buildBust,
  buildSkullShell,
} from "@autofilm/forge";
import { TestValidator } from "@nestia/e2e";

/**
 * The bust grounds the head: its top must tuck behind the jaw (above the chin
 * line, so no gap opens at any chin length), the neck must be narrower than the
 * face while the shoulders flare wider, and both controls must actually steer
 * their spans.
 *
 * Scenario: default-face bust tops above the chin; neck max-x at the top ring
 * is below the face half-width while shoulder max-x exceeds it;
 * `neck`/`shoulders` at 1 strictly widen their regions vs 0.
 */
export const test_forge_bust = (): void => {
  const chinY = CANONICAL_FACE_POSITIONS[152 * 3 + 1]!;
  const halfW =
    Math.abs(
      CANONICAL_FACE_POSITIONS[454 * 3]! - CANONICAL_FACE_POSITIONS[234 * 3]!,
    ) / 2;
  const slim = buildBust({ neck: 0, shoulders: 0 });
  const wide = buildBust({ neck: 1, shoulders: 1 });

  const topY = (p: number[]): number => {
    let m = -Infinity;
    for (let i = 1; i < p.length; i += 3) m = Math.max(m, p[i]!);
    return m;
  };
  TestValidator.predicate("tucks behind the jaw", topY(slim.positions) > chinY);

  const maxXAt = (p: number[], yMin: number, yMax: number): number => {
    let m = 0;
    for (let i = 0; i < p.length; i += 3) {
      const y = p[i + 1]!;
      if (y >= yMin && y <= yMax) m = Math.max(m, Math.abs(p[i]!));
    }
    return m;
  };
  const top = topY(slim.positions);
  const neckX = maxXAt(slim.positions, top - 0.02, top);
  TestValidator.predicate("neck narrower than the face", neckX < halfW);
  const shoulderX = maxXAt(slim.positions, -Infinity, top - 0.06);
  TestValidator.predicate("shoulders wider than the face", shoulderX > halfW);

  TestValidator.predicate(
    "controls steer their spans",
    maxXAt(wide.positions, top - 0.02, top) > neckX &&
      maxXAt(wide.positions, -Infinity, top - 0.06) > shoulderX,
  );

  // sanity against the skull: the bust must start below the dome's bottom
  const dome = buildSkullShell();
  let domeBot = Infinity;
  for (let i = 1; i < dome.positions.length; i += 3)
    domeBot = Math.min(domeBot, dome.positions[i]!);
  TestValidator.predicate("starts below the dome", top < domeBot + 0.05);
};
