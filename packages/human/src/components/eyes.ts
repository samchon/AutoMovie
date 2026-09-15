/**
 * Orchestrate the replaceable eye's fit, attachment and refined finish.
 * Inputs describe an observed aperture in head millimetres (+Z anterior).
 * Input admission owns copies; eyeSupport fixes optical identity before blink.
 * Shared lid sections bridge performed inner contact to original host skin.
 * Attachment mutates only the supplied assembly cage; finalSurface proposes
 * common skin targets after refinement, then eyeInterior draws the same support.
 * Gaze cannot refit identity or move the outer attachment. A changed identity
 * invalidates every downstream contact and interior; no stage certifies likeness.
 */
import { Vector3, createAutoMovieMeshDepthSampler } from "@automovie/engine";
import type { IAutoMovieVector3 as Point } from "@automovie/interface";

import {
  portraitSpline as interpolate,
  portraitPoint as p,
  portraitPart,
} from "../geometry/geometry";
import {
  type IPortraitComponent,
  portraitFacesInsideLoop,
} from "../geometry/portraitComponents";
import { createPortraitDirectionalContact } from "../geometry/portraitDirectionalContact";
import { portraitEyeSphereIntersection } from "../geometry/portraitEyeSphere";
import { refinePortraitSkinBridge } from "../geometry/refinePortraitSkinBridge";
import {
  portraitSkinAnnulus,
  reservePortraitSkin,
} from "../geometry/reservePortraitSkin";
import { resolvePortraitEyeInputs } from "./eyeComponentInputs";
import { buildPortraitEye } from "./eyeInterior";
import { portraitEyeLidRows, portraitEyeLoop } from "./eyeLidRows";
import { appendPortraitEyeMargins } from "./eyeMargins";
import { buildPortraitEyeContactBasis } from "./eyeOpticalSurface";
import {
  type IPortraitEyePerformance,
  posePortraitLidCurves,
} from "./eyePerformance";
import type { IPortraitEyeShape, IPortraitEyeSocket } from "./eyeShape";
import { createPortraitEyeSupport } from "./eyeSupport";
import { createPortraitEyeSurfaceContact } from "./eyeSurfaceContact";
import { createPortraitIrisMaterials } from "./irisPigment";

// Keep the established component module imports while definitions own their contracts.
export type {
  IPortraitAegyoSalShape,
  IPortraitEyeShape,
  IPortraitEyeSocket,
} from "./eyeShape";
export { appendPortraitEyeMargins } from "./eyeMargins";
export { buildPortraitEye } from "./eyeInterior";

/**
 * Fit one replaceable eye and expose its actual outer lid as the skin seam.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Fits a swappable eye whose outer lid seam is shared with the surrounding skin.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Builds observed-relative lid rows around a fixed globe, reserves or adapts host skin, and resolves final optical contact before constructing interiors.
 */
export function createPortraitEyeComponent(
  inputSocket: IPortraitEyeSocket,
  inputShape: IPortraitEyeShape,
  inputPerformance?: IPortraitEyePerformance,
): IPortraitComponent {
  const { performance, socket, shape, tissues, lowerProfile, upperProfile } =
    resolvePortraitEyeInputs(inputSocket, inputShape, inputPerformance);
  return {
    id: socket.name + "-eye",
    // Each optical volume owns its material so changing one shell's thickness
    // cannot leave a shared global thickness behind on either eye.
    materials: [
      {
        id: socket.name + "-cornea",
        name: socket.name + " corneal surface",
        baseColor: { r: 1, g: 1, b: 1, a: 1, hex: null },
        roughness: 0.035,
        metallic: 0,
        opacity: 1,
        emissive: null,
        baseColorTexture: null,
        doubleSided: true,
        transmission: 1,
        ior: 1.376,
        thickness: shape.cornealThickness / 1000,
      },
      // Preserve the optical material's established first slot; additive
      // pigment ownership appends materials without moving that existing entry.
      ...(shape.irisPigment === undefined
        ? []
        : createPortraitIrisMaterials(
            socket.name + "-iris",
            shape.irisPigment,
          )),
    ],
    fit: (host) => {
      const loop = portraitEyeLoop(socket);
      const points = loop.map((id) => host.positions[id]);
      const left = Math.min(...points.map((p) => p[0])),
        right = Math.max(...points.map((p) => p[0]));
      const middleX = (left + right) / 2;
      const middleY =
        (Math.min(...points.map((p) => p[1])) +
          Math.max(...points.map((p) => p[1]))) /
        2;
      const aperture = host.positions.map((point) => [...point]);
      for (const id of loop) {
        const point = host.positions[id],
          u = (point[0] - left) / (right - left);
        const outer = socket.name === "left" ? u : 1 - u;
        aperture[id] = [
          middleX + (point[0] - middleX) * shape.widthScale,
          middleY +
            (point[1] - middleY) * shape.openingScale +
            shape.outerCornerLift * outer,
          point[2],
        ].map((value, axis) => value + shape.socketLift * host.viewRay[axis]);
      }
      aperture[socket.iris] = host.positions[socket.iris].map(
        (value, axis) => value + shape.socketLift * host.viewRay[axis],
      );
      const direction = p(host.viewRay[0], host.viewRay[1], host.viewRay[2]);
      const pointAt = (id: number): Point =>
        p(aperture[id][0], aperture[id][1], aperture[id][2]);
      const { sphere, fittedSphere, shifted, canthal, intersect } =
        createPortraitEyeSupport(
          socket.top.map(pointAt),
          socket.bottom.map(pointAt),
          direction,
          shape,
        );
      // The host seam belongs to the fitted socket, not to optical prominence.
      // Keep its reference sphere while moving the complete optical body along
      // the observation ray. This preserves image coordinates without lifting
      // the brow-side attachment by the same amount.
      const identityGuide =
        performance === undefined
          ? undefined
          : aperture.map((point) => [...point]);
      // Transport from the observed aperture on this same optical sphere.
      // Contact/refinement still owns the final root; neither gaze nor a second
      // assembled reference face is needed to carry the strand's direction.
      const lashReference =
        shape.upperLashProfile === undefined ||
        performance === undefined ||
        performance.blink === performance.observedBlink
          ? undefined
          : socket.top.map((id) => intersect(pointAt(id)));
      if (performance !== undefined) {
        const posed = posePortraitLidCurves(
          socket.top.map(pointAt),
          socket.bottom.map(pointAt),
          performance,
        );
        for (const band of ["top", "bottom"] as const)
          socket[band].forEach((id, i) => {
            const point = posed[band === "top" ? "upper" : "lower"][i];
            aperture[id] = [point.x, point.y, point.z];
          });
      }
      const lashCurrent =
        lashReference === undefined
          ? undefined
          : socket.top.map((id) => intersect(pointAt(id)));
      // The lid section starts at its actual ocular contact, not at a lower
      // globe surface that will later be pushed through a raised cornea. A
      // post-refinement collision correction alone leaves a local platform:
      // its movement never informed the tissue bridge constructed below.
      // Use the same resident optical builder and recorded projection ray as
      // the final contact check. Section thickness is added by the lid rows,
      // so this boundary query uses zero extra clearance, avoiding two copies.
      const contactBoundary =
        shape.lidContact !== "cornea"
          ? undefined
          : createPortraitDirectionalContact(
              portraitPart(
                "corneal-attachment-basis",
                buildPortraitEyeContactBasis(
                  portraitEyeSphereIntersection(
                    sphere,
                    pointAt(socket.iris),
                    direction,
                  ),
                  sphere,
                  shape,
                  [],
                  performance,
                  canthal?.surface,
                ),
                "skin",
              ).geometry.mesh,
              direction,
            );
      // Corneal contact must not redefine the gaze-independent outer seam.
      // Legacy support uses its reference sphere projection; separate canthal
      // support retains the observed anchors. Fade performed inner movement
      // to zero across either identity's tissue bridge.
      const apertureGuide =
        identityGuide ??
        (canthal === undefined
          ? undefined
          : aperture.map((point) => [...point])) ??
        (contactBoundary === undefined && !shifted
          ? undefined
          : aperture.map((point) => [...point]));
      for (const id of loop) {
        const contact = intersect(pointAt(id));
        if (apertureGuide !== undefined) {
          const guideContact =
            canthal !== undefined
              ? p(
                  ...((identityGuide ?? aperture)[id] as [
                    number,
                    number,
                    number,
                  ]),
                )
              : identityGuide === undefined && !shifted
                ? contact
                : portraitEyeSphereIntersection(
                    fittedSphere,
                    p(
                      ...((identityGuide ?? aperture)[id] as [
                        number,
                        number,
                        number,
                      ]),
                    ),
                    direction,
                  );
          apertureGuide[id] = [guideContact.x, guideContact.y, guideContact.z];
        }
        if (contactBoundary === undefined)
          aperture[id] = [contact.x, contact.y, contact.z];
        else {
          const metric = p(
            contact.x / 1000,
            contact.y / 1000,
            contact.z / 1000,
          );
          const boundary = contactBoundary(metric);
          // A missed/clear sample keeps the original double coordinates
          // exactly, rather than introducing an unnecessary unit round trip.
          aperture[id] =
            boundary === metric
              ? [contact.x, contact.y, contact.z]
              : [boundary.x * 1000, boundary.y * 1000, boundary.z * 1000];
        }
      }
      // The outer eyelid attaches to the actual supporting skin. Its section
      // bridges that depth to the fitted ocular contact instead of extruding a flat
      // annulus from the aperture. The two boundaries keep distinct ownership.
      const support = createAutoMovieMeshDepthSampler(
        portraitPart(
          "orbital-support-basis",
          {
            positions: host.positions.flat(),
            indices: host.indices,
            normals: null,
            uvs: null,
            skin: null,
          },
          "skin",
        ).geometry.mesh,
        "z",
      );
      const outerConstraints = portraitEyeLidRows(
        aperture,
        socket,
        shape,
        undefined,
        lowerProfile,
        apertureGuide,
        upperProfile,
      ).map((row) => {
        const hit = support(row.outer[0] / 1000, row.outer[1] / 1000);
        if (hit === null)
          throw new Error(
            "An eyelid's outer attachment must remain on supporting skin.",
          );
        return {
          vertex: row.id,
          target: [
            row.outer[0],
            row.outer[1],
            hit.maximum * 1000 + shape.socketLift * host.viewRay[2],
          ],
          reach: shape.blendReach,
        };
      });
      const cutFaces = portraitFacesInsideLoop(host, loop);
      const reservation =
        shape.skinAttachment === undefined
          ? undefined
          : reservePortraitSkin(
              host,
              loop,
              outerConstraints.map((constraint) => constraint.target),
            );
      return {
        constraints: [
          // Internal seam targets still participate in shared ownership checks.
          // Zero reach prevents them from initiating a host deformation; simply
          // omitting them would hide a contradictory target from another part.
          ...(reservation === undefined
            ? outerConstraints
            : outerConstraints.map((constraint) => ({
                ...constraint,
                reach: 0,
              }))),
          { vertex: socket.iris, target: aperture[socket.iris], reach: 0 },
        ],
        cutFaces: reservation?.faces ?? cutFaces,
        attach: (cage, _adapted, region) => {
          let bridge: number[] = [];
          let bridgePositions: number[][] = [];
          if (reservation !== undefined) {
            // The old aperture IDs are now wholly inside the removed patch.
            // Moving them cannot drag a remaining host triangle across the new
            // seam. Admit the actual post-adaptation annulus before mutating the
            // cage: another component may have moved its outer boundary.
            const targets = new Map(
              outerConstraints.map((constraint) => [
                constraint.vertex,
                constraint.target,
              ]),
            );
            bridge = portraitSkinAnnulus(
              cage.positions.map((point, id) => targets.get(id) ?? point),
              reservation.boundary,
              loop,
            );
            if (shape.skinBridge === "sampled") {
              const refined = refinePortraitSkinBridge(
                cage.positions.map((point, id) => targets.get(id) ?? point),
                bridge,
                (x, y) => {
                  const hit = support(x / 1000, y / 1000);
                  if (hit === null)
                    throw new Error(
                      "Reserved orbital bridge must stay over its original skin support.",
                    );
                  return hit.maximum * 1000;
                },
              );
              bridge = refined.indices;
              bridgePositions = refined.positions.slice(cage.positions.length);
            }
            for (const { vertex, target } of outerConstraints)
              cage.positions[vertex] = [...target];
          }
          cage.positions.push(...bridgePositions);
          const lidGroup =
            shape.lidContact === "cornea"
              ? region(socket.name + "-eyelids", "skin")
              : 0;
          const margins = appendPortraitEyeMargins(
            cage,
            aperture,
            socket,
            shape,
            lidGroup,
            lowerProfile,
            apertureGuide,
            upperProfile,
          );
          for (let i = 0; i < bridge.length; i += 3) {
            cage.indices.push(...bridge.slice(i, i + 3));
            cage.groups.push(0);
          }
          return {
            openings: [portraitEyeLoop(socket).map((id) => margins.get(id)!)],
            closures:
              performance?.blink === 1 ? [margins.get(loop[0])!] : undefined,
            finalSurface:
              shape.lidContact !== "cornea"
                ? undefined
                : createPortraitEyeSurfaceContact({
                    iris: socket.iris,
                    sphere,
                    shape,
                    direction,
                    lidGroup,
                    performance,
                    canthal: canthal?.surface,
                  }),
            finish: (refined) =>
              buildPortraitEye(
                refined.positions,
                refined,
                margins,
                host.viewRay,
                socket,
                shape,
                sphere,
                tissues,
                performance,
                lashReference === undefined
                  ? undefined
                  : (at) => ({
                      from: Vector3.subtract(
                        interpolate(lashReference, at),
                        sphere.center,
                      ),
                      to: Vector3.subtract(
                        interpolate(lashCurrent!, at),
                        sphere.center,
                      ),
                    }),
                canthal,
              ),
          };
        },
      };
    },
  };
}
