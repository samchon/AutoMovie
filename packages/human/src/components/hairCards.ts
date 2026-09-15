import { Vector3, mergeAutoMovieMeshes } from "@automovie/engine";
import type { IAutoMovieMesh, IAutoMovieModelPart } from "@automovie/interface";

import {
  portraitNormals,
  portraitPart,
  portraitPoint,
  portraitSpline,
} from "../geometry/geometry";
import { assertPortraitHairFibreCurl } from "./hairTexture";

/**
 * One authored lock represented by a curved strip, not individual hair tubes.
 * Stations use head millimetres. Across vectors give the width direction and
 * need not be unit length; their interpolated direction must remain nonzero.
 * The root is an authored scalp attachment, not an inferred hairstyle.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Names the rooted guide, width and transverse orientation of one surface-based hair lock.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Defines head-space guide stations that emit a continuous UV-bearing strip.
 * @author Samchon
 */
export interface IPortraitHairCard {
  /** Two through 32 ordered root-to-tip centreline witnesses, in mm. */
  guide: readonly (readonly [number, number, number])[];
  /** Width directions paired with guide stations, independent of view direction. */
  across: readonly (readonly [number, number, number])[];
  /** Positive full root width in mm, no greater than 40. */
  width: number;
}

/**
 * A bounded population of surface locks. Empty cards remove the hairstyle.
 * Sampling changes geometry cost without changing the guide population. The
 * material names a resident finish; construction supplies its procedural mask.
 * This is static groom authoring, not strand simulation or a hairstyle preset.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Keeps authored lock arrays replaceable as one independent numerical profile.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls Separates complete card replacement from width, taper and tessellation controls.
 * @author Samchon
 */
export interface IPortraitHairShape {
  /** Resident base finish id, shared across the generated locks. */
  material: string;
  /** Zero through 1024 independently authored curved locks. */
  cards: readonly IPortraitHairCard[];
  /** Integral segments per card from 2 through 64. */
  segments: number;
  /** Shared width multiplier in [0.1,4]. One preserves authored widths. */
  widthScale: number;
  /** Tip/root width ratio in [0.05,1]; positive tips avoid collapsed triangles. */
  tipWidth: number;
  /**
   * Root-to-tip fraction in [0,0.95] where width starts narrowing. Omission is
   * zero, preserving the original full-length taper. A later start retains
   * scalp coverage and the body of a long lock without widening its root.
   */
  taperStart?: number;
  /** Deterministic texture seed, an unsigned 32-bit integer. */
  seed: number;
  /** Number of painted fibres per lock, from 1 through 32. These are not meshes. */
  fibres: number;
  /** Fractional fibre coverage in [0.1,1]; larger fills gaps between painted fibres. */
  coverage: number;
  /**
   * Procedural RGB modulation strength in [0,1]. Omission or one retains the
   * original shaded fibres; zero uses white RGB so only the base finish sets
   * pigment. Intermediate values interpolate encoded texture RGB towards white.
   * Alpha, normals and geometry are independent of this raster control.
   */
  fibreShadeStrength?: number;
  /**
   * Generated fibre-normal strength in [0,1]. Omission or zero leaves the base
   * finish's normal binding unchanged. Positive values replace that binding
   * on the owned card finish, never on other users of the base material.
   * One uses the full circular fibre cross-section, not a physical diameter.
   */
  fibreNormalScale?: number;
  /**
   * Optional complete curled-fibre pattern. It changes the resident alpha and
   * normal maps, not the guide geometry. Omission preserves the legacy mask.
   * These normalized pattern controls do not measure biological hair diameter.
   */
  fibreCurl?: {
    /** Maximum transverse excursion as a fraction of card UV width, in [0,0.5]. */
    amplitude: number;
    /** Nominal turns along UV length, in [0,16], with seeded 20 percent variation. */
    cycles: number;
    /** Nominal card width/length ratio in [0.01,100], used for the curl-normal direction. */
    aspectRatio: number;
  };
}

/**
 * Tessellate cubic guide strips with root-to-tip UVs. Each row has two vertices
 * and each interval two triangles, independent of painted fibre count. Normals
 * come from the emitted triangles. No camera-facing rotation or random state
 * enters the construction. Caller guides and profiles remain unchanged.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Constructs curved surface hair locks from named guide and width controls.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Emits metric strips with shared sampling, deterministic UVs and finite nondegenerate frames.
 */
export function buildPortraitHairCards(
  shape: IPortraitHairShape,
): IAutoMovieModelPart[] {
  if (shape.fibreCurl !== undefined)
    assertPortraitHairFibreCurl(shape.fibreCurl);
  if (
    shape.material.trim().length === 0 ||
    shape.cards.length > 1024 ||
    !Number.isInteger(shape.segments) ||
    shape.segments < 2 ||
    shape.segments > 64 ||
    !Number.isFinite(shape.widthScale) ||
    shape.widthScale < 0.1 ||
    shape.widthScale > 4 ||
    !Number.isFinite(shape.tipWidth) ||
    shape.tipWidth < 0.05 ||
    shape.tipWidth > 1 ||
    (shape.taperStart !== undefined &&
      (!Number.isFinite(shape.taperStart) ||
        shape.taperStart < 0 ||
        shape.taperStart > 0.95)) ||
    !Number.isInteger(shape.seed) ||
    shape.seed < 0 ||
    shape.seed > 0xffffffff ||
    !Number.isInteger(shape.fibres) ||
    shape.fibres < 1 ||
    shape.fibres > 32 ||
    !Number.isFinite(shape.coverage) ||
    shape.coverage < 0.1 ||
    shape.coverage > 1 ||
    (shape.fibreShadeStrength !== undefined &&
      (!Number.isFinite(shape.fibreShadeStrength) ||
        shape.fibreShadeStrength < 0 ||
        shape.fibreShadeStrength > 1)) ||
    (shape.fibreNormalScale !== undefined &&
      (!Number.isFinite(shape.fibreNormalScale) ||
        shape.fibreNormalScale < 0 ||
        shape.fibreNormalScale > 1))
  )
    throw new Error(
      "Hair cards need bounded finite widths, sampling, coverage and an unsigned seed.",
    );
  const meshes: IAutoMovieMesh[] = [];
  const taperStart = shape.taperStart ?? 0;
  for (const card of shape.cards) {
    if (
      card.guide.length < 2 ||
      card.guide.length > 32 ||
      card.across.length !== card.guide.length ||
      !Number.isFinite(card.width) ||
      card.width <= 0 ||
      card.width > 40 ||
      [...card.guide, ...card.across].some(
        (p) => p.length !== 3 || !p.every(Number.isFinite),
      )
    )
      throw new Error(
        "Each hair card needs paired finite guide/frame stations and a positive bounded width.",
      );
    const guide = card.guide.map((p) => portraitPoint(...p));
    const across = card.across.map((p) => portraitPoint(...p));
    const mesh: IAutoMovieMesh = {
      positions: [],
      indices: [],
      normals: null,
      uvs: [],
      skin: null,
    };
    for (let row = 0; row <= shape.segments; row++) {
      const t = row / shape.segments;
      const center = portraitSpline(guide, t),
        frame = portraitSpline(across, t);
      const direction = Vector3.normalize(frame);
      if (
        ![direction.x, direction.y, direction.z].every(Number.isFinite) ||
        Vector3.length(direction) === 0
      )
        throw new Error(
          "Hair width frames must remain finite and nonzero between stations.",
        );
      const radius =
        (card.width *
          shape.widthScale *
          (1 -
            (Math.max(0, t - taperStart) / (1 - taperStart)) *
              (1 - shape.tipWidth))) /
        2;
      for (const side of [-1, 1]) {
        const point = Vector3.add(
          center,
          Vector3.scale(direction, side * radius),
        );
        mesh.positions.push(point.x, point.y, point.z);
        mesh.uvs!.push((side + 1) / 2, t);
      }
      if (row > 0) {
        const a = 2 * (row - 1);
        mesh.indices!.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    for (let i = 0; i < mesh.indices!.length; i += 3) {
      const [a, b, c] = mesh
        .indices!.slice(i, i + 3)
        .map((id) =>
          portraitPoint(
            mesh.positions[id * 3],
            mesh.positions[id * 3 + 1],
            mesh.positions[id * 3 + 2],
          ),
        );
      const area = Vector3.length(
        Vector3.cross(Vector3.subtract(b, a), Vector3.subtract(c, a)),
      );
      if (!(area > 1e-8) || !Number.isFinite(area))
        throw new Error(
          "Hair card guides and width frames must produce finite nondegenerate triangles.",
        );
    }
    mesh.normals = portraitNormals(mesh.positions, mesh.indices!);
    meshes.push(mesh);
  }
  return meshes.length === 0
    ? []
    : [
        portraitPart(
          "scalp-hair-cards",
          mergeAutoMovieMeshes(meshes),
          shape.material,
        ),
      ];
}
