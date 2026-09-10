import type { IAutoMovieModel } from "@automovie/interface";

import { portraitPart } from "../geometry";
import type { IPortraitComponent } from "../portraitComponents";
import { applyPortraitOralContact } from "../portraitOralContact";
import type { IPortraitSurfaceLayer } from "../portraitSurface";
import { referenceControlNet } from "./controlNet";
import { buildPortraitEars } from "./ears";
import { buildFittedReferencePortrait } from "./fittedModel";
import { buildPortraitHairProxy } from "./hairProxy";
import { buildPortraitHead } from "./head";
import { createPortraitMaterials } from "./materials";
import type { portraitReview } from "./review";

/**
 * Assemble this one reference face from independently inspectable anatomical
 * builders. This direct study has no dependency on a human parameter module.
 * Construction coordinates
 * are millimetres, +Y is up and +Z points out of the face. Anatomical left is +X.
 *
 * The anatomical foundation delegates to the connected prior and recorded fit;
 * the procedural foundation uses the replaceable component protocol below.
 * Their settings are deliberately separate, so a procedural nose parameter
 * cannot silently become an inactive control on the anatomical foundation.
 * The control net owns measurement provenance. Replaceable components supply
 * exact skin attachments; the host adapts surrounding skin and refines their
 * common surface before each component finishes against its actual opening.
 * Every part crosses the same engine-owned metre conversion in portraitPart before becoming AutoMovie
 * model data. Optional coarse hair supports silhouette inspection; detailed
 * hair and torso remain outside this face iteration.
 *
 * The caller chooses components and optional refined-skin layers. Empty layers
 * preserve the subdivided skin. Eye-owned optical materials are collected with
 * the shared palette, while the ear builder samples the final skin in metres.
 * See ../README.md for the tracked export, capture and verification entrypoints.
 *
 * @evidence src/subjects/generated-korean-girl-01/review.md#front Supplies the assembled eyes, nose and dental row inspected from the front.
 * @evidence src/subjects/generated-korean-girl-01/review.md#left-oblique Supplies the nasal projection and left pinna relationship inspected at positive yaw.
 * @evidence src/subjects/generated-korean-girl-01/review.md#right-oblique Supplies the opposite cheek, eye occlusion and mouth depth inspected at negative yaw.
 * @evidence src/subjects/generated-korean-girl-01/review.md#left-profile Supplies the forehead-to-chin silhouette inspected from the anatomical left.
 * @evidence src/subjects/generated-korean-girl-01/review.md#right-profile Supplies the opposite profile and mirrored ear inspected from the anatomical right.
 * @evidence src/subjects/generated-korean-girl-01/review.md#back Supplies the inferred closed rear skull and neck attachment inspected from behind.
 * @evidence src/subjects/generated-korean-girl-01/review.md#top Supplies the cranial and nasal silhouette inspected at steep positive elevation.
 * @evidence src/subjects/generated-korean-girl-01/review.md#bottom Supplies the nasal cavities, chin underside and intentionally open neck crop inspected from below.
 * @evidence src/subjects/generated-korean-girl-01/review.md#rear-oblique Supplies the opposing oblique that exposes the hair curtain and rear attachment relationship.
 * @evidence src/subjects/generated-korean-girl-01/review.md#reference Supplies the geometry compared against the photograph in its recorded camera pose.
 * @evidence src/subjects/generated-korean-girl-01/review.md#clay Supplies the shared surface inspected independently of its material colours.
 * @evidence src/subjects/generated-korean-girl-01/review.md#component-replacement Assembles the component selections exercised by the replacement tests; fresh alternate-assembly captures remain pending for this revision.
 * @evidence {@link portraitReview} Retains the construction review carrier for this assembled face; its written observations do not accept the likeness.
 */
export function buildReferencePortrait(
  assembly:
    | {
        foundation: "anatomical";
        /** Surface sampling remains independent of the fitted anatomical controls. */
        subdivisionRounds: number;
      }
    | {
        foundation?: undefined;
        components: IPortraitComponent[];
        subdivisionRounds: number;
        surfaceLayers?: readonly IPortraitSurfaceLayer[];
        /** Include only the coarse hairstyle mass; omitted for isolated face inspection. */
        hairProxy?: boolean;
        /** Named assembled oral surfaces and nonnegative clearance in metres. */
        oralContact?: Parameters<typeof applyPortraitOralContact>[1];
      },
): IAutoMovieModel {
  if (assembly.foundation === "anatomical")
    return buildFittedReferencePortrait(assembly.subdivisionRounds);
  const head = buildPortraitHead(
    {
      positions: referenceControlNet.positions,
      indices: referenceControlNet.indices,
      viewRay: referenceControlNet.viewRay,
    },
    assembly.components,
    assembly.subdivisionRounds,
    assembly.surfaceLayers,
  );
  head.parts = applyPortraitOralContact(head.parts, assembly.oralContact);
  const skin = portraitPart(
    "ear-attachment-basis",
    {
      positions: head.refined.positions.flat(),
      indices: head.refined.indices,
      normals: null,
      uvs: null,
      skin: null,
    },
    "skin",
  ).geometry;
  const ears = buildPortraitEars(skin.mesh);
  // The coarse hair enclosure must include the resident ears as well as scalp.
  // Otherwise a separately attached pinna can penetrate a cap correctly fitted
  // to the head alone. Ear buffers are metres; the enclosure consumes mm, like
  // the refined skin. Ears govern lateral clearance only; including them in the
  // scalp's uniform fit would incorrectly raise and deepen the complete cap.
  const earEnvelope = ears.flatMap((ear) => {
    const positions = ear.geometry.mesh.positions;
    return Array.from({ length: positions.length / 3 }, (_v, i) =>
      positions.slice(3 * i, 3 * i + 3).map((value) => value * 1000),
    );
  });
  // portraitPart preserves mesh geometry while applying the same metre boundary
  // used by the GLTF exporter; the ear sampler therefore reads renderer units.
  return {
    id: "generated-korean-girl-01",
    name: "Measured reference face study",
    origin: "generated",
    parts: [
      ...head.parts,
      ...ears,
      ...(assembly.hairProxy
        ? buildPortraitHairProxy(head.refined.positions, skin.mesh, earEnvelope)
        : []),
    ],
    materials: [
      ...createPortraitMaterials(),
      ...assembly.components.flatMap((component) => component.materials ?? []),
    ],
    skeleton: null,
    body: null,
    asset: null,
  };
}
