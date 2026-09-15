import { validateModel } from "@automovie/engine";
import type { IAutoMovieModel } from "@automovie/interface";

import type { IAutoMovieHumanFaceDocument } from "./IAutoMovieHumanFaceDocument";
import { createPortraitCheekLayer } from "./components/cheeks";
import { createPortraitDentalComponent } from "./components/dentalComponent";
import { buildPortraitEars } from "./components/ears";
import { createPortraitEyeComponent } from "./components/eyes";
import { createPortraitFacePerformanceComponent } from "./components/facePerformance";
import { buildPortraitHairGroom } from "./components/hairLayers";
import { buildPortraitHead } from "./components/head";
import { createPortraitJawContinuation } from "./components/jawContinuation";
import { createPortraitMandibularDentition } from "./components/mandibularDentition";
import { createPortraitMouthComponent } from "./components/mouth";
import { createPortraitNoseComponent } from "./components/nose";
import { createPortraitOrbitalSupport } from "./components/orbitalSupport";
import { createPortraitSkinLayer } from "./components/skin";
import { createPortraitSkinColour } from "./components/skinColour";
import { createPortraitTongueComponent } from "./components/tongue";
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
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-skin-colour Builds optional regional skin colour on reference tissue independently of current performance.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-skin-colour Pairs observed/current component cages, transports reference coordinates and emits linear RGB on head and pinna surfaces.
 * @evidenceExclude requirements/actors/facial-authoring/README.md#face-requirements This domain index also covers application controls and subjective study review; the numerical library owns face construction and export, not the complete authoring workflow.
 * @evidenceExclude specifications/asset-and-representation/facial-authoring/README.md#face-specifications This index joins replay, UI and inspection boundaries; this builder does not own the browser adapter or human review process.
 */
export function buildHumanFace(
  document: IAutoMovieHumanFaceDocument,
  subdivisionRounds = 2,
): IAutoMovieModel {
  const face = resolveHumanFaceDocument(document);
  const { host, bindings, recipe, expression, observation } = face;
  const { parts: hair, materials } = buildPortraitHairGroom({
    hair: recipe.hair,
    layers: recipe.hairLayers,
    materials: face.materials,
  });
  const makeComponents = (expression: typeof face.expression) => [
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
    ...(recipe.tongue === undefined
      ? []
      : [
          createPortraitTongueComponent(
            {
              rightCorner: bindings.mouth.lower[0],
              leftCorner: bindings.mouth.lower[bindings.mouth.lower.length - 1],
              lowerLipMiddle:
                bindings.mouth.lower[
                  Math.floor(bindings.mouth.lower.length / 2)
                ],
            },
            recipe.tongue,
            bindings.jawHinge!,
            observation,
            expression,
          ),
        ]),
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
  const components = makeComponents(expression);
  const colour =
    recipe.skinColour === undefined || recipe.skinColour.length === 0
      ? undefined
      : createPortraitSkinColour(host, recipe.skinColour);
  const layers = [
    createPortraitSkinLayer(bindings, recipe.skin!, expression),
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
    performance: createPortraitJawContinuation(
      host,
      bindings,
      observation,
      expression,
      recipe.neck!,
    ),
    appearance:
      colour === undefined
        ? undefined
        : {
            host,
            components: makeComponents(observation),
            performance: createPortraitJawContinuation(
              host,
              bindings,
              observation,
              observation,
              recipe.neck!,
            ),
            sample: colour,
          },
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
  const referenceSkin =
    colour === undefined
      ? undefined
      : portraitPart(
          "reference-temporal-attachment",
          {
            positions: head.refined.reference!.flat(),
            indices: head.refined.indices,
            normals: null,
            uvs: null,
            skin: null,
          },
          "skin",
        ).geometry.mesh;
  const ears = (["right", "left"] as const).flatMap((side) => {
    const parts = buildPortraitEars(skin, face[side].ear, side);
    if (referenceSkin !== undefined) {
      const originals = buildPortraitEars(referenceSkin, face[side].ear, side);
      parts.forEach((part, index) => {
        const positions = originals[index].geometry.mesh.positions;
        part.geometry.mesh.colors = [];
        for (let i = 0; i < positions.length; i += 3)
          part.geometry.mesh.colors.push(
            ...colour!(positions.slice(i, i + 3).map((v) => v * 1000)),
          );
      });
    }
    return parts;
  });
  const model: IAutoMovieModel = {
    id: face.document.id,
    name: face.document.name,
    origin: "generated",
    parts: [...head.parts, ...hair, ...ears],
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
