import { validateModel } from "@automovie/engine";
import type { IAutoMovieModel } from "@automovie/interface";

import type { IAutoMovieHumanFaceDocument } from "./IAutoMovieHumanFaceDocument";
import { createPortraitCheekLayer } from "./components/cheeks";
import { createPortraitDentalComponent } from "./components/dentalComponent";
import { buildPortraitEars } from "./components/ears";
import { createPortraitEyeComponent } from "./components/eyes";
import { createPortraitFacePerformanceComponent } from "./components/facePerformance";
import { buildPortraitHairCards } from "./components/hairCards";
import { createPortraitHairMaterial } from "./components/hairMaterial";
import { buildPortraitHead } from "./components/head";
import { createPortraitMandibularDentition } from "./components/mandibularDentition";
import { createPortraitMouthComponent } from "./components/mouth";
import { createPortraitNoseComponent } from "./components/nose";
import { createPortraitOrbitalSupport } from "./components/orbitalSupport";
import { portraitPart } from "./geometry/geometry";
import {
  createPortraitReliefCurveLayer,
  createPortraitReliefLayer,
} from "./geometry/portraitRelief";
import { resolveHumanFaceDocument } from "./resolveHumanFaceDocument";

/**
 * Construct one resident anatomical face from a standalone numerical document.
 * No photograph, detector, named-subject preset or mesh cache is consulted.
 * Identity parts fit the same immutable host, tissue performance shares their
 * attachments, the upper dental arch stays maxillary, and final geometry uses
 * metres. Sampling rounds are independent of identity and range from zero
 * through four; the default two rounds is the editor's full-shape preview.
 *
 * Model validation proves construction admission, not visual quality or
 * likeness. Static glTF precision/material admission and direct multi-view
 * review remain separate gates after this function returns.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-document Replays one face solely from its versioned anatomical document.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-document Resolves a cloned versioned basis and recipe without photo IO, random state or editor history.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Assembles the resident cranium, eyes, nose, lips, upper dentition, ears and neck.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-expression Applies independent observed-relative facial performance without moving maxillary teeth with the lip.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Connects numerical part profiles to actual geometry rather than metadata-only controls.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-expression Builds posed shared tissue with fixed optical identity and explicit mandibular attachments.
 * @evidenceExclude requirements/actors/facial-authoring/README.md#face-requirements This domain index also covers application controls and subjective study review; the numerical library owns face construction and export, not the complete authoring workflow.
 * @evidenceExclude specifications/asset-and-representation/facial-authoring/README.md#face-specifications This index joins replay, UI and inspection boundaries; this builder does not own the browser adapter or human review process.
 */
export function buildHumanFace(
  document: IAutoMovieHumanFaceDocument,
  subdivisionRounds = 2,
): IAutoMovieModel {
  const face = resolveHumanFaceDocument(document);
  const { host, bindings, recipe, expression, observation } = face;
  const hair =
    recipe.hair === undefined ? [] : buildPortraitHairCards(recipe.hair);
  const materials = [...face.materials];
  if (hair.length !== 0) {
    const finish = materials.find(
      (material) => material.id === recipe.hair!.material,
    );
    if (finish === undefined)
      throw new Error("Hair cards require their named resident finish.");
    // The card material is independent: a shared base finish can still colour
    // untextured eyelashes or other geometry without giving them a missing UV.
    const material = createPortraitHairMaterial(finish, recipe.hair!);
    const { id } = material;
    if (materials.some((material) => material.id === id))
      throw new Error(
        "Generated hair finish identity collides with a resident material.",
      );
    materials.push(material);
    for (const part of hair) part.material = id;
  }
  const components = [
    ...(["right", "left"] as const).map((side) =>
      createPortraitEyeComponent(bindings.eyes[side], face[side].eye, {
        blink: expression.blink[side],
        observedBlink: observation.blink[side],
        yaw: expression.gazeYaw[side] - observation.gazeYaw[side],
        pitch: expression.gazePitch[side] - observation.gazePitch[side],
      }),
    ),
    createPortraitNoseComponent(bindings.nose, recipe.nose),
    createPortraitMouthComponent(bindings.mouth, recipe.mouth, {
      lipPart: expression.lipPart,
      observedLipPart: observation.lipPart,
      jaw:
        bindings.jawHinge === undefined
          ? undefined
          : {
              hinge: bindings.jawHinge,
              observed: observation.jawOpen,
              current: expression.jawOpen,
            },
      smile: {
        right: expression.smile.right - observation.smile.right,
        left: expression.smile.left - observation.smile.left,
      },
      pucker: { current: expression.pucker, observed: observation.pucker },
    }),
    createPortraitFacePerformanceComponent(bindings, observation, expression),
    ...(recipe.dentition === undefined
      ? []
      : [
          createPortraitDentalComponent(
            bindings.dentition!,
            recipe.dentition.row,
            recipe.dentition.placement,
            "observed-maxilla",
          ),
        ]),
    ...(recipe.lowerDentition === undefined
      ? []
      : [
          createPortraitMandibularDentition(
            {
              rightCorner: bindings.mouth.lower[0],
              leftCorner: bindings.mouth.lower[bindings.mouth.lower.length - 1],
              lowerLipMiddle:
                bindings.mouth.lower[
                  Math.floor(bindings.mouth.lower.length / 2)
                ],
            },
            recipe.lowerDentition.row,
            recipe.lowerDentition.placement,
            {
              hinge: bindings.jawHinge!,
              observed: observation.jawOpen,
              current: expression.jawOpen,
            },
          ),
        ]),
  ];
  const layers = [
    ...(["right", "left"] as const).flatMap((side) =>
      face[side].cheek === undefined
        ? []
        : [createPortraitCheekLayer(bindings.cheeks![side], face[side].cheek!)],
    ),
    ...(recipe.orbits === undefined
      ? []
      : (["right", "left"] as const).map((side) =>
          createPortraitOrbitalSupport(side, recipe.orbits![side]),
        )),
    ...(recipe.relief ?? []).map((layer) =>
      createPortraitReliefLayer(layer.id, layer.regions),
    ),
    ...(recipe.curves ?? []).map((layer) =>
      createPortraitReliefCurveLayer(layer.id, layer.curves),
    ),
  ];
  const head = buildPortraitHead(host, components, subdivisionRounds, layers, {
    cranium: recipe.cranium,
    neck: recipe.neck,
  });
  const skin = portraitPart(
    "temporal-attachment",
    {
      positions: head.refined.positions.flat(),
      indices: head.refined.indices,
      normals: null,
      uvs: null,
      skin: null,
    },
    "skin",
  ).geometry.mesh;
  const model: IAutoMovieModel = {
    id: face.document.id,
    name: face.document.name,
    origin: "generated",
    parts: [
      ...head.parts,
      ...hair,
      ...buildPortraitEars(skin, face.right.ear, "right"),
      ...buildPortraitEars(skin, face.left.ear, "left"),
    ],
    materials: [
      ...materials,
      ...components.flatMap((component) => component.materials ?? []),
    ],
    skeleton: null,
    body: null,
    asset: null,
  };
  const validation = validateModel({ model });
  if (!validation.success)
    throw new Error(
      `The constructed face is not a valid resident model: ${JSON.stringify(validation)}.`,
    );
  return model;
}
