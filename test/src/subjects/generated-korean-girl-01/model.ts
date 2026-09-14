import { buildPortraitEars } from "@automovie/human/components/ears";
import { buildPortraitHead } from "@automovie/human/components/head";
import { createPortraitMaterials } from "@automovie/human/components/materials";
import { portraitPart } from "@automovie/human/geometry/geometry";
import type { IPortraitComponent } from "@automovie/human/geometry/portraitComponents";
import { applyPortraitOralContact } from "@automovie/human/geometry/portraitOralContact";
import type { IPortraitSurfaceLayer } from "@automovie/human/geometry/portraitSurface";
import type { IAutoMovieMaterial, IAutoMovieModel } from "@automovie/interface";

import { portraitHairShape } from "./configuration";
import { referenceControlNet } from "./controlNet";
import { buildFittedReferencePortrait } from "./fittedModel";
import { buildPortraitHairProxy } from "./hairProxy";
import type { portraitReview } from "./review";

/**
 * Assemble this one reference face from independently inspectable anatomical
 * builders now shared by the human package. This study retains its own measured
 * basis and configuration rather than loading the portable face-document API.
 * Construction coordinates are millimetres, +Y is up and +Z points out of the
 * face. Anatomical left is +X.
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
 * @evidenceReview src/subjects/generated-korean-girl-01/review.md#front #7c8e313 Reopened the frozen front frame after a byte-identical Node 22 GLB replay: the connected nose retains an angular base, the lower lids form regular bands and the visible crowns remain coarse. No likeness acceptance follows.
 * @evidenceReview src/subjects/generated-korean-girl-01/review.md#left-oblique #580c386 Reopened the positive-yaw frozen frame: the exposed pinna and continuous nasal sidewall remain visible, with a broad cheek-to-mouth depression. Hidden anatomy and eye fitting remain unaccepted.
 * @evidenceReview src/subjects/generated-korean-girl-01/review.md#right-oblique #5a791c9 Reopened the negative-yaw frozen frame: no detached upper nasal crosspiece is visible, the far eye is occluded and the coarse temporal hair overhang dominates.
 * @evidenceReview src/subjects/generated-korean-girl-01/review.md#left-profile #6a3370e Reopened the frozen anatomical-left profile: forehead, nasal, lip and chin silhouettes are continuous without the rejected bridge spikes. Single-view depth inference is not independently verified.
 * @evidenceReview src/subjects/generated-korean-girl-01/review.md#right-profile #c836ccb Reopened the opposing frozen profile: the nasal silhouette remains connected while the curtain hides most of the side head. Coarse lip and crown form does not establish posterior likeness.
 * @evidenceReview src/subjects/generated-korean-girl-01/review.md#back #5c7de2a Reopened the frozen back frame and corrected the observation to retain its visible horizontal cap-to-curtain seam. The tightly framed coarse hair mass is not a reproduced groom.
 * @evidenceReview src/subjects/generated-korean-girl-01/review.md#top #0b45dcc Reopened the frozen overhead frame: the cap is helmet-like and the exposed nasal silhouette has no detached triangular bridge projections. Posterior dimensions remain inferred.
 * @evidenceReview src/subjects/generated-korean-girl-01/review.md#bottom #cd2a6e6 Reopened the frozen underside: two nasal openings and their lining are visible, the cropped neck is open, and the broad chin-to-throat transition and simplified columella remain unaccepted.
 * @evidenceReview src/subjects/generated-korean-girl-01/review.md#rear-oblique #706d696 Reopened the frozen rear oblique and retained its cap-to-curtain seam in the record. No detached ear fragment is visible, while the curtain hides most of the head and cannot establish unseen likeness.
 * @evidenceReview src/subjects/generated-korean-girl-01/review.md#reference #1899ddf Reopened the frozen recorded-pose frame and read the earlier measured oral-fit record. Synthetic lid, nasal and crown forms remain visible; the historical pixel comparisons were not remeasured in this pass.
 * @evidenceReview src/subjects/generated-korean-girl-01/review.md#clay #6263b83 Reopened all three frozen clay frames: connected nasal and cranial surfaces retain angular alar form, broad perioral depressions and raised vermilion. Opaque clay corneas are not a colour-render optical verdict.
 * @evidenceReview src/subjects/generated-korean-girl-01/review.md#component-replacement #91a7335 Read the replacement history and its explicit uncertified contact figures against the preserved package replay. The byte-identical GLB establishes frozen construction preservation only; earlier numeric contacts, alternate assemblies and whole-PR review are not recertified here.
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
        /** Optional complete base palette; omission retains the construction basis. Component-owned optical finishes remain additional. */
        materials?: readonly IAutoMovieMaterial[];
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
        ? buildPortraitHairProxy(
            head.refined.positions,
            skin.mesh,
            earEnvelope,
            portraitHairShape,
          )
        : []),
    ],
    materials: [
      ...structuredClone(assembly.materials ?? createPortraitMaterials()),
      ...assembly.components.flatMap((component) => component.materials ?? []),
    ],
    skeleton: null,
    body: null,
    asset: null,
  };
}
