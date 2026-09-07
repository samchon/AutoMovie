import type { IAutoMovieModelPart } from "@automovie/interface";

import { blendPortraitSkin } from "../blendPortraitSkin";
import { portraitNormals, portraitPart, portraitRegion } from "../geometry";
import {
  type IPortraitComponent,
  type IPortraitComponentHost,
} from "../portraitComponents";
import { assertPortraitSkinTopology } from "../portraitSkinTopology";
import {
  type IPortraitSurfaceLayer,
  applyPortraitSurfaceLayers,
} from "../portraitSurface";
import { subdivideControlMesh } from "../subdivideControlMesh";
import { appendPortraitCranium, appendPortraitNeck } from "./cranium";

/**
 * Fit replaceable components, adapt their surrounding skin, and subdivide the
 * connected surface once. This assembler knows the component protocol rather
 * than a particular eye or nose implementation. A component finishes its own
 * interior parts against the actual refined attachment it helped construct.
 *
 * Host, constraints, cage and returned positions use millimetres. Original
 * triangle ordinals remain meaningful only during cutting; original vertex IDs
 * survive subdivision for socket lookup. Material groups are triangle-local
 * labels and never define a second independently refined skin surface.
 *
 * Surface layers run after subdivision and before normals and interior parts.
 * This order lets a narrow surface feature use the refined resolution and lets
 * dependent interiors read its final rim. The subject supplies its anatomical
 * layers explicitly; this assembler owns their placement in the pipeline.
 */
export function buildPortraitHead(
  host: IPortraitComponentHost,
  components: IPortraitComponent[],
  rounds: number,
  surfaceLayers: readonly IPortraitSurfaceLayer[] = [],
) {
  if (!Number.isInteger(rounds) || rounds < 0 || rounds > 4)
    throw new Error(
      "Portrait subdivision rounds must be an integer from zero through four.",
    );
  if (
    new Set(components.map((component) => component.id)).size !==
    components.length
  )
    throw new Error("Portrait component instance identities must be unique.");
  // Fit all parts to one unchanged basis. Sequentially fitting to another
  // part's displacement would make the result depend on component ordering.
  const plans = components.map((component) => component.fit(host));
  const source = blendPortraitSkin(
    host.positions,
    host.indices,
    plans.flatMap((plan) => plan.constraints),
  );
  const removed = new Set<number>();
  for (const plan of plans)
    for (const triangle of plan.cutFaces) {
      if (
        !Number.isInteger(triangle) ||
        triangle < 0 ||
        triangle >= host.indices.length / 3
      )
        throw new Error("A component cut must name a resident host triangle.");
      if (removed.has(triangle))
        throw new Error(
          "Portrait components cannot cut the same host triangle.",
        );
      removed.add(triangle);
    }
  const cage = {
    positions: source.map((point) => [...point]),
    indices: [] as number[],
    groups: [] as number[],
  };
  for (let i = 0; i < host.indices.length; i += 3) {
    if (removed.has(i / 3)) continue;
    cage.indices.push(...host.indices.slice(i, i + 3));
    cage.groups.push(0);
  }
  const regions = [{ id: "head", material: "skin" }];
  const region = (id: string, material: string): number => {
    if (regions.some((entry) => entry.id === id))
      throw new Error("A component skin region must have a unique identity.");
    return regions.push({ id, material }) - 1;
  };
  // Attachers append shared topology now and return closures for interiors.
  // Those closures are invoked only after the complete skin has been refined.
  const finishers = plans.map((plan) => plan.attach(cage, source, region));
  if (cage.groups.length * 3 !== cage.indices.length)
    throw new Error("Every attached skin triangle needs one material region.");
  if (
    cage.groups.some(
      (group) =>
        !Number.isInteger(group) || group < 0 || group >= regions.length,
    )
  )
    throw new Error("Component skin must use a registered material region.");
  const collar = appendPortraitCranium(cage);
  const neckCrop = appendPortraitNeck(cage, collar);
  assertPortraitSkinTopology(cage, [
    neckCrop,
    ...finishers.flatMap((attached) => attached.openings),
  ]);
  const refined = applyPortraitSurfaceLayers(
    subdivideControlMesh(cage, rounds),
    surfaceLayers,
  );
  const packed = refined.positions.flat(),
    normals = portraitNormals(packed, refined.indices);
  const parts: IAutoMovieModelPart[] = [];
  for (let group = 0; group < regions.length; group++) {
    const selected: number[] = [];
    for (let i = 0; i < refined.groups.length; i++)
      if (refined.groups[i] === group)
        selected.push(...refined.indices.slice(i * 3, i * 3 + 3));
    if (selected.length !== 0)
      parts.push(
        portraitPart(
          regions[group].id,
          portraitRegion(packed, normals, selected),
          regions[group].material,
        ),
      );
  }
  for (const attached of finishers) parts.push(...attached.finish(refined));
  return { parts, refined, source };
}
