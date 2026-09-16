import type { IAutoMovieModelPart } from "@automovie/interface";

import { blendPortraitSkin } from "../geometry/blendPortraitSkin";
import {
  portraitNormals,
  portraitPart,
  portraitRegion,
} from "../geometry/geometry";
import {
  type IPortraitComponent,
  type IPortraitComponentHost,
} from "../geometry/portraitComponents";
import { applyPortraitFinalSurfaces } from "../geometry/portraitFinalSurface";
import { applyPortraitRegionReplacements } from "../geometry/portraitRegionReplacement";
import { assertPortraitSkinTopology } from "../geometry/portraitSkinTopology";
import {
  type IPortraitSurfaceLayer,
  applyPortraitSurfaceLayers,
} from "../geometry/portraitSurface";
import { sealPortraitContactSeams } from "../geometry/sealPortraitContactSeams";
import {
  type IControlMesh,
  subdivideControlMesh,
} from "../geometry/subdivideControlMesh";
import {
  type IPortraitNeckShape,
  appendPortraitCranium,
  appendPortraitNeck,
} from "./cranium";
import type { IPortraitCraniumShape } from "./craniumShape";

/**
 * Reference formation and performance of newly appended head tissue. Existing
 * facial/component vertices keep their performed positions and shared IDs.
 * Only continuation vertices are posed before common refinement and normals.
 *
 * @author Samchon
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-expression Separates reference cranial and cervical formation from performed facial attachments.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-expression Continues motion across shared tissue without applying it twice to resident oral components.
 */
export interface IPortraitHeadPerformance {
  /** Restore reference coordinates for construction; do not mutate the input. */
  reference: (point: number[], vertex: number) => number[];
  /** Pose one new reference vertex in millimetres; do not mutate the input. */
  pose: (point: number[]) => number[];
}

type PortraitHeadFormation = {
  cranium?: IPortraitCraniumShape;
  neck?: IPortraitNeckShape;
  performance?: IPortraitHeadPerformance;
};

/**
 * Fit replaceable components and refine the host's connected control surface.
 * Prebuilt surfaces replace their reserved regions afterward, preserving their
 * own sampling while joining the actual refined socket. This assembler knows
 * that protocol rather than a particular eye or nose implementation. Common
 * normals and component interiors consume the resulting joined surface.
 *
 * Host, constraints, cage and returned positions use millimetres. Original
 * triangle ordinals remain meaningful only during cutting; original vertex IDs
 * survive subdivision for socket lookup. Material groups are triangle-local
 * labels that retain socket ownership without a separate normal seam.
 *
 * Surface layers run after subdivision and before normals and interior parts.
 * This order lets a narrow surface feature use the refined resolution and lets
 * dependent interiors read its final rim. A prebuilt component inserted after
 * these layers owns its complete source form. The subject supplies the layers
 * explicitly; this assembler owns their placement in the pipeline.
 * Optional appearance supplies an observed-reference assembly with identical
 * component, region, subdivision-curve and replacement identities. Reference
 * XYZ follows the current surface's sampling, and colour is evaluated only
 * afterward. Final shaping changes geometry, not these material coordinates.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Composes replaceable anatomical parts against one unchanged facial basis and publishes their joined skin and interiors.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-attachments Fits and cuts once, validates shared topology, refines surfaces, seals contacts and only then computes normals and interiors.
 */
export function buildPortraitHead(
  host: IPortraitComponentHost,
  components: IPortraitComponent[],
  rounds: number,
  surfaceLayers: readonly IPortraitSurfaceLayer[] = [],
  anatomy: PortraitHeadFormation & {
    /** Reference formation and numerical skin colour, independent of current performance. */
    appearance?: {
      host: IPortraitComponentHost;
      components: IPortraitComponent[];
      performance?: IPortraitHeadPerformance;
      sample: (reference: readonly number[]) => number[];
    };
  } = {},
) {
  if (!Number.isInteger(rounds) || rounds < 0 || rounds > 4)
    throw new Error(
      "Portrait subdivision rounds must be an integer from zero through four.",
    );
  const assemble = (
    host: IPortraitComponentHost,
    components: IPortraitComponent[],
    anatomy: PortraitHeadFormation,
  ) => {
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
          throw new Error(
            "A component cut must name a resident host triangle.",
          );
        if (removed.has(triangle))
          throw new Error(
            "Portrait components cannot cut the same host triangle.",
          );
        removed.add(triangle);
      }
    const cage: IControlMesh = {
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
      throw new Error(
        "Every attached skin triangle needs one material region.",
      );
    if (
      cage.groups.some(
        (group) =>
          !Number.isInteger(group) || group < 0 || group >= regions.length,
      )
    )
      throw new Error("Component skin must use a registered material region.");
    const continuation =
      anatomy.performance === undefined
        ? cage
        : {
            positions: cage.positions.map((point, vertex) =>
              finiteContinuationPoint(
                anatomy.performance!.reference([...point], vertex),
              ),
            ),
            indices: [] as number[],
            groups: [] as number[],
          };
    const firstContinuation = cage.positions.length;
    const collar = appendPortraitCranium(continuation, anatomy.cranium);
    const neckCrop = appendPortraitNeck(continuation, collar, anatomy.neck);
    if (anatomy.performance !== undefined) {
      for (const point of continuation.positions.slice(firstContinuation))
        cage.positions.push(
          finiteContinuationPoint(anatomy.performance.pose([...point])),
        );
      cage.indices.push(...continuation.indices);
      cage.groups.push(...continuation.groups);
    }
    assertPortraitSkinTopology(cage, [
      neckCrop,
      ...finishers.flatMap((attached) => attached.openings),
    ]);
    return { cage, regions, finishers, source };
  };
  const { cage, regions, finishers, source } = assemble(
    host,
    components,
    anatomy,
  );
  const appearance = anatomy.appearance;
  if (
    appearance !== undefined &&
    (appearance.components.length !== components.length ||
      components.some(
        (component, i) => component.id !== appearance.components[i].id,
      ))
  )
    throw new Error(
      "Skin colour reference must retain component identities and order.",
    );
  const reference =
    appearance === undefined
      ? undefined
      : assemble(appearance.host, appearance.components, {
          cranium: anatomy.cranium,
          neck: anatomy.neck,
          performance: appearance.performance,
        });
  if (reference !== undefined) {
    assertCorrespondingCages(cage, reference.cage);
    const currentCurves = finishers.flatMap((part) => part.curves ?? []);
    const referenceCurves = reference.finishers.flatMap(
      (part) => part.curves ?? [],
    );
    if (
      currentCurves.length !== referenceCurves.length ||
      currentCurves.some(
        (curve, i) =>
          curve.length !== referenceCurves[i].length ||
          curve.some((id, j) => id !== referenceCurves[i][j]),
      )
    )
      throw new Error("Skin colour reference must retain subdivision curves.");
    if (
      regions.length !== reference.regions.length ||
      regions.some(
        (region, i) =>
          region.id !== reference.regions[i].id ||
          region.material !== reference.regions[i].material,
      )
    )
      throw new Error(
        "Skin colour reference must retain component region identities.",
      );
    cage.reference = reference.cage.positions;
  }
  const replacements = finishers.flatMap((attached, index) => {
    const current = attached.replacements ?? [];
    if (reference === undefined) return current;
    const originals = reference.finishers[index].replacements ?? [];
    if (current.length !== originals.length)
      throw new Error(
        "Skin colour reference must retain replacement identities.",
      );
    return current.map((replacement, i) => {
      const original = originals[i];
      if (replacement.group !== original.group)
        throw new Error(
          "Skin colour reference must retain replacement regions.",
        );
      return {
        group: replacement.group,
        append: (mesh: IControlMesh, boundary: readonly number[]) => {
          const originalMesh: IControlMesh = {
            positions: mesh.reference!.map((p) => [...p]),
            indices: [...mesh.indices],
            groups: [...mesh.groups],
          };
          replacement.append(mesh, boundary);
          original.append(originalMesh, boundary);
          assertCorrespondingCages(mesh, originalMesh);
          mesh.reference = originalMesh.positions;
        },
      };
    });
  });
  const surface = applyPortraitFinalSurfaces(
    applyPortraitRegionReplacements(
      applyPortraitSurfaceLayers(
        subdivideControlMesh(
          cage,
          rounds,
          finishers.flatMap((attached) => attached.curves ?? []),
        ),
        surfaceLayers,
      ),
      replacements,
    ),
    finishers.flatMap((attached, index) =>
      attached.finalSurface === undefined
        ? []
        : [
            {
              id: components[index].id,
              propose: attached.finalSurface,
            },
          ],
    ),
  );
  if (appearance !== undefined)
    surface.colors = surface.reference!.map((point) => {
      const rgb = appearance.sample(point);
      if (
        rgb.length !== 3 ||
        rgb.some((v) => !Number.isFinite(v) || v < 0 || v > 1)
      )
        throw new Error("Skin colour must return finite linear RGB in [0,1].");
      return [...rgb];
    });
  const refined = sealPortraitContactSeams(
    surface,
    finishers.flatMap((attached) => attached.closures ?? []),
  );
  const packed = refined.positions.flat(),
    normals = portraitNormals(packed, refined.indices);
  const parts: IAutoMovieModelPart[] = [];
  for (let group = 0; group < regions.length; group++) {
    const selected: number[] = [];
    const colors: number[][] | undefined =
      refined.colors === undefined || regions[group].material !== "skin"
        ? undefined
        : [];
    for (let i = 0; i < refined.groups.length; i++)
      if (refined.groups[i] === group) {
        selected.push(...refined.indices.slice(i * 3, i * 3 + 3));
        if (colors !== undefined)
          colors.push(
            ...(refined.cornerColors === undefined
              ? refined.indices
                  .slice(i * 3, i * 3 + 3)
                  .map((id) => refined.colors![id])
              : refined.cornerColors.slice(i * 3, i * 3 + 3)),
          );
      }
    if (selected.length !== 0)
      parts.push(
        portraitPart(
          regions[group].id,
          portraitRegion(packed, normals, selected, colors),
          regions[group].material,
        ),
      );
  }
  for (const attached of finishers) parts.push(...attached.finish(refined));
  return { parts, refined, source };
}

function assertCorrespondingCages(
  current: IControlMesh,
  reference: IControlMesh,
): void {
  if (
    current.positions.length !== reference.positions.length ||
    current.indices.length !== reference.indices.length ||
    current.indices.some((id, i) => id !== reference.indices[i]) ||
    current.groups.length !== reference.groups.length ||
    current.groups.some((id, i) => id !== reference.groups[i])
  )
    throw new Error(
      "Skin colour reference and performance must share control topology.",
    );
}

function finiteContinuationPoint(point: number[]): number[] {
  if (point.length !== 3 || !point.every(Number.isFinite))
    throw new Error("Head continuation must return finite XYZ millimetres.");
  return [...point];
}
