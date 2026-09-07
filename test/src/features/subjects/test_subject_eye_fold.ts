import { TestValidator } from "@nestia/e2e";

import { blendPortraitSkin } from "../../subjects/blendPortraitSkin";
import {
  portraitEyeShape,
  portraitEyeSockets,
} from "../../subjects/generated-korean-girl-01/configuration";
import { referenceControlNet } from "../../subjects/generated-korean-girl-01/controlNet";
import { createPortraitEyeComponent } from "../../subjects/generated-korean-girl-01/eyes";
import { subdivideControlMesh } from "../../subjects/subdivideControlMesh";

/**
 * An upper-lid fold survives refinement without becoming an aperture control.
 * The crease changes depth while the exact refined inner rim stays unchanged.
 *
 * Scenarios:
 * 1. Build zero-depth and recessed folds around the same socket and refine the
 *    isolated lid annulus three times. Every inner-rim position remains equal.
 * 2. The recessed fold retains a depth contrast between its hood and trough,
 *    rather than smoothing back into the flat profile.
 */
export const test_subject_eye_fold = (): void => {
  const host = {
    positions: referenceControlNet.positions,
    indices: referenceControlNet.indices,
    viewRay: referenceControlNet.viewRay,
  };
  const socket = portraitEyeSockets[0];
  const loop = [...socket.bottom, ...socket.top.slice(1, -1).reverse()];
  const middle = loop.indexOf(socket.top[Math.floor(socket.top.length / 2)]);
  const results = [];
  for (const foldDepth of [0, 0.8]) {
    const plan = createPortraitEyeComponent(socket, {
      ...portraitEyeShape,
      foldDepth,
    }).fit(host);
    const source = blendPortraitSkin(
      host.positions,
      host.indices,
      plan.constraints,
    );
    const cage = {
      positions: source.map((point) => [...point]),
      indices: [] as number[],
      groups: [] as number[],
    };
    const start = cage.positions.length;
    const attached = plan.attach(cage, source, () => 0);
    const refined = subdivideControlMesh(cage, 3);
    results.push({
      rim: attached.openings[0].map((id) => refined.positions[id]),
      depth:
        refined.positions[start + loop.length + middle][2] -
        refined.positions[start + 3 * loop.length + middle][2],
    });
  }
  TestValidator.equals(
    "fold does not change the refined aperture",
    results[0].rim,
    results[1].rim,
  );
  TestValidator.predicate(
    "crease survives subdivision",
    results[1].depth - results[0].depth > 0.3,
  );
};
