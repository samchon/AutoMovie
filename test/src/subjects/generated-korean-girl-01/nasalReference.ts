import type { IAutoMovieModelPart } from "@automovie/interface";

import { assertPortraitFitBasis } from "../portraitFitBasis";
import type { IPortraitMeshPatch } from "../portraitMeshPatch";
import {
  anatomicalStudyShape,
  buildAnatomicalStudy,
} from "../reference-anatomy/model";
import { referenceControlNet } from "./controlNet";
import binding from "./nasalReferenceBinding.json";
import fit from "./surfaceFit.json";

/**
 * The subject-bound CC0 nasal source, retaining the existing fitted skin basis.
 * The prior builder supplies native nasal tissue and cavities. Its whole face
 * is not selected: the boundary below selects only the complete nasal patch.
 * Each fit rechecks the current source model and target bytes, then the exact
 * fitted skin bytes to which these boundary identities belong. Changing a
 * source, residual or sampling requires rebinding rather than retaining IDs
 * against a silently different mesh. No ignored capture is a runtime input.
 *
 * Distances cross the existing prior's metre boundary back to host millimetres.
 * The supplied binding may select another boundary on this same admitted skin;
 * its expected skin digest is an artifact identity, not a code snapshot.
 */
export function buildPortraitNasalReference(
  input: Pick<
    typeof binding,
    "sourceSkinSha256" | "sourceSubdivisionRounds" | "sourceBoundary"
  > = binding,
): IPortraitMeshPatch {
  const encoder = new TextEncoder();
  const source = buildAnatomicalStudy({
    ...anatomicalStudyShape,
    subdivisionRounds: fit.basis.sourceSubdivisionRounds,
  });
  const targetBytes = encoder.encode(JSON.stringify(referenceControlNet));
  assertPortraitFitBasis(
    fit.basis,
    encoder.encode(JSON.stringify(source)),
    targetBytes,
  );
  const fitted = buildAnatomicalStudy(
    {
      ...anatomicalStudyShape,
      subdivisionRounds: input.sourceSubdivisionRounds,
    },
    fit,
  );
  // The prior emits this named part through portraitPart, whose result is a
  // mesh. Its complete bytes are still admitted below before IDs are consumed.
  const skin = (
    fitted.parts.find((p) => p.id === "anatomical-skin")!.geometry as Extract<
      IAutoMovieModelPart["geometry"],
      { type: "mesh" }
    >
  ).mesh;
  assertPortraitFitBasis(
    {
      sourceModelSha256: input.sourceSkinSha256,
      targetControlNetSha256: fit.basis.targetControlNetSha256,
    },
    encoder.encode(JSON.stringify(skin)),
    targetBytes,
  );
  return {
    mesh: {
      positions: Array.from({ length: skin.positions.length / 3 }, (_, i) =>
        skin.positions.slice(i * 3, i * 3 + 3).map((v) => v * 1000),
      ),
      indices: [...skin.indices!],
      groups: new Array(skin.indices!.length / 3).fill(0),
    },
    boundary: [...input.sourceBoundary],
  };
}
