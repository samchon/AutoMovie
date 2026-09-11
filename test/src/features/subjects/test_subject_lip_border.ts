import { TestValidator } from "@nestia/e2e";

import {
  portraitMouthShape,
  portraitMouthSocket,
} from "../../subjects/generated-korean-girl-01/configuration";
import { referenceControlNet } from "../../subjects/generated-korean-girl-01/controlNet";
import { buildPortraitHead } from "../../subjects/generated-korean-girl-01/head";
import {
  type IPortraitMouthShape,
  createPortraitMouthComponent,
} from "../../subjects/generated-korean-girl-01/mouth";
import { throwsError } from "../internal/predicates";

/**
 * A mouth declares its shared cutaneous border through the generic attachment
 * protocol. The host applies that rule without knowing any lip landmark IDs.
 *
 * Scenarios:
 * 1. Omitted and explicit surface detail produce identical refined heads.
 *    Curve detail moves outer controls while preserving the first-round inner
 *    rim and a remote forehead vertex; skin and lips still share positions.
 * 2. Component construction owns the socket and selected rule. Invalid detail
 *    refuses before attachment, with valid surface/curve values as twins.
 */
export const test_subject_lip_border = (): void => {
  const host = {
    positions: referenceControlNet.positions,
    indices: referenceControlNet.indices,
    viewRay: referenceControlNet.viewRay,
  };
  const shape = { ...portraitMouthShape, crowns: [] };
  const build = (borderRefinement: IPortraitMouthShape["borderRefinement"]) =>
    buildPortraitHead(
      host,
      [
        createPortraitMouthComponent(portraitMouthSocket, {
          ...shape,
          borderRefinement,
        }),
      ],
      1,
    );
  const basic = build(undefined),
    explicit = build("surface"),
    detail = build("curve");
  TestValidator.equals("omission is surface", basic, explicit);
  TestValidator.predicate(
    "border changes final geometry",
    portraitMouthSocket.outer.some(
      (id) =>
        JSON.stringify(basic.refined.positions[id]) !==
        JSON.stringify(detail.refined.positions[id]),
    ),
  );
  TestValidator.equals(
    "remote forehead unchanged",
    detail.refined.positions[10],
    basic.refined.positions[10],
  );
  for (const id of [...portraitMouthSocket.upper, ...portraitMouthSocket.lower])
    TestValidator.equals(
      "first-round oral boundary unchanged",
      detail.refined.positions[id],
      basic.refined.positions[id],
    );
  const skin = detail.parts.find((p) => p.id === "head")!.geometry;
  const lips = detail.parts.find((p) => p.id === "lips")!.geometry;
  if (skin.type !== "mesh" || lips.type !== "mesh")
    throw new Error("Expected resident shared skin meshes.");
  const points = new Set<string>();
  for (let i = 0; i < skin.mesh.positions.length; i += 3)
    points.add(skin.mesh.positions.slice(i, i + 3).join("/"));
  let common = 0;
  for (let i = 0; i < lips.mesh.positions.length; i += 3)
    if (points.has(lips.mesh.positions.slice(i, i + 3).join("/"))) common++;
  TestValidator.equals(
    "one complete shared refined border",
    common,
    portraitMouthSocket.outer.length * 2,
  );
  const socket = structuredClone(portraitMouthSocket),
    ownedShape = { ...shape, borderRefinement: "curve" as const };
  const component = createPortraitMouthComponent(socket, ownedShape);
  socket.outer.reverse();
  ownedShape.borderRefinement = "surface" as "curve";
  TestValidator.equals(
    "owned curve remains selected",
    buildPortraitHead(host, [component], 1).refined,
    detail.refined,
  );
  TestValidator.predicate(
    "invalid detail refuses",
    throwsError(() =>
      createPortraitMouthComponent(portraitMouthSocket, {
        ...shape,
        borderRefinement: "unknown" as "curve",
      }),
    ),
  );
};
