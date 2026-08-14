import {
  type IAutoMovieViewerSnapshotRenderer,
  type IAutoMovieViewerSubjectView,
  applyAutoMovieViewerSubjectPose,
  autoMovieViewerPoseFromHeading,
  autoMovieViewerSubjectKey,
  autoMovieViewerTurntableViewpoints,
  captureAutoMovieViewerSubjectView,
  frameAutoMovieViewerSubject,
  parseAutoMovieViewerSubjectKey,
} from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

/**
 * The viewer harness opens a subject by what it is, frames it from its own
 * extent, and answers a pose with an image.
 *
 * Scenarios:
 *
 * 1. A subject key round-trips through its kind, id and revision, and refuses
 *    every name it cannot resolve rather than guessing a kind.
 * 2. A turntable plan is deterministic, refuses a plan it cannot name
 *    uniquely, and refuses degenerate sampling rules.
 * 3. One framing rule fits a 0.05 m part and a 50 m elevation, keeping the
 *    same depth-buffer ratio at both extremes and honouring the narrower of
 *    the two fields of view.
 * 4. A degenerate subject box still yields an aimable eye.
 * 5. A pose applied to a camera stages its world matrix, and pose-to-image
 *    resolves the compact populations before it draws.
 * 6. The observation the harness returns cannot be offered as delivery
 *    evidence.
 */
export const test_viewer_subject_viewpoint = (): void => {
  //----
  // 1. SUBJECT IDENTITY, NOT SHOT IDENTITY
  //----
  TestValidator.equals(
    "a subject is named by kind, id and revision",
    [
      autoMovieViewerSubjectKey({
        kind: "element",
        id: "hall-oriel-2",
        revision: null,
      }),
      autoMovieViewerSubjectKey({
        kind: "model",
        id: "oriel",
        revision: "r7",
      }),
    ],
    ["element:hall-oriel-2", "model:oriel@r7"],
  );
  TestValidator.equals(
    "a subject key round-trips",
    parseAutoMovieViewerSubjectKey("space:solar@rev-3"),
    { kind: "space", id: "solar", revision: "rev-3" },
  );
  TestValidator.equals(
    "an id may carry its own at-sign",
    parseAutoMovieViewerSubjectKey("part:post@2@r1"),
    { kind: "part", id: "post@2", revision: "r1" },
  );
  TestValidator.equals(
    "a key without a revision states none",
    parseAutoMovieViewerSubjectKey("primitive:shaft"),
    { kind: "primitive", id: "shaft", revision: null },
  );
  const refusedKeys = ["hall-oriel-2", "shot:opening", "element:", "model:a@"]
    .map((key) => {
      try {
        parseAutoMovieViewerSubjectKey(key);
        return `${key}: accepted`;
      } catch {
        return `${key}: refused`;
      }
    })
    .join(", ");
  TestValidator.equals(
    "an unresolvable subject name is refused rather than guessed",
    refusedKeys,
    "hall-oriel-2: refused, shot:opening: refused, element:: refused, model:a@: refused",
  );

  //----
  // 2. THE VIEWPOINT PLAN BELONGS TO THE INSPECTION
  //----
  const plan = autoMovieViewerTurntableViewpoints({
    azimuthCount: 4,
    elevationsDeg: [20, -15],
  });
  TestValidator.equals(
    "a turntable plan names its viewpoints deterministically",
    plan.map((viewpoint) => viewpoint.id),
    [
      "az000-el020",
      "az090-el020",
      "az180-el020",
      "az270-el020",
      "az000-eln015",
      "az090-eln015",
      "az180-eln015",
      "az270-eln015",
    ],
  );
  TestValidator.equals(
    "the plan carries its own distance rule",
    plan[0]!.distanceFactor,
    1.25,
  );
  TestValidator.equals(
    "the same plan is produced again",
    autoMovieViewerTurntableViewpoints({
      azimuthCount: 4,
      elevationsDeg: [20, -15],
    }),
    plan,
  );
  const refusedPlans = [
    { azimuthCount: 0, elevationsDeg: [0] },
    { azimuthCount: 2.5, elevationsDeg: [0] },
    { azimuthCount: 2, elevationsDeg: [] },
    { azimuthCount: 2, elevationsDeg: [0], distanceFactor: 0 },
    { azimuthCount: 2, elevationsDeg: [20, 20.2] },
  ].map((options) => {
    try {
      autoMovieViewerTurntableViewpoints(options);
      return "accepted";
    } catch {
      return "refused";
    }
  });
  TestValidator.equals(
    "a plan that cannot be counted or named is refused",
    refusedPlans,
    ["refused", "refused", "refused", "refused", "refused"],
  );

  //----
  // 3. ONE FRAMING RULE AT BOTH SCALE EXTREMES
  //----
  const lens = { fovDeg: 40, aspect: 16 / 9 };
  const mullion = frameAutoMovieViewerSubject(
    {
      min: { x: 0, y: 2, z: 0 },
      max: { x: 0.05, y: 2.6, z: 0.05 },
    },
    { id: "az000-el000", azimuthDeg: 0, elevationDeg: 0, distanceFactor: 1.25 },
    lens,
  );
  const elevation = frameAutoMovieViewerSubject(
    {
      min: { x: -25, y: 0, z: -6 },
      max: { x: 25, y: 18, z: 6 },
    },
    { id: "az000-el000", azimuthDeg: 0, elevationDeg: 0, distanceFactor: 1.25 },
    lens,
  );
  TestValidator.equals(
    "each eye stands off its own subject's centre",
    [
      Number(mullion.target.y.toFixed(4)),
      Number(elevation.target.x.toFixed(4)),
    ],
    [2.3, 0],
  );
  TestValidator.predicate(
    "a small part is framed from close and a large elevation from far",
    () =>
      mullion.position.z > 0.5 &&
      mullion.position.z < 3 &&
      elevation.position.z > 40 &&
      elevation.position.z < 120,
  );
  TestValidator.equals(
    "the depth-buffer ratio is the same at both scales",
    Number((mullion.far / mullion.near).toFixed(6)),
    Number((elevation.far / elevation.near).toFixed(6)),
  );
  const portrait = frameAutoMovieViewerSubject(
    {
      min: { x: -25, y: 0, z: -6 },
      max: { x: 25, y: 18, z: 6 },
    },
    { id: "az000-el000", azimuthDeg: 0, elevationDeg: 0, distanceFactor: 1.25 },
    { fovDeg: 40, aspect: 0.5 },
  );
  TestValidator.predicate(
    "a portrait viewport backs off further, fitting the narrower field",
    () => portrait.position.z > elevation.position.z,
  );
  const orbit = frameAutoMovieViewerSubject(
    { min: { x: -1, y: -1, z: -1 }, max: { x: 1, y: 1, z: 1 } },
    { id: "az090-el030", azimuthDeg: 90, elevationDeg: 30, distanceFactor: 2 },
    lens,
  );
  TestValidator.predicate(
    "azimuth and elevation place the eye around the subject",
    () =>
      orbit.position.x > 0 &&
      orbit.position.y > 0 &&
      Math.abs(orbit.position.z) < 1e-9,
  );
  const wide = frameAutoMovieViewerSubject(
    { min: { x: -1, y: -1, z: -1 }, max: { x: 1, y: 1, z: 1 } },
    { id: "az000-el000", azimuthDeg: 0, elevationDeg: 0, distanceFactor: 1 },
    { fovDeg: 179.9, aspect: 1 },
  );
  TestValidator.predicate(
    "an eye that sits on the subject still has a positive near plane",
    () => wide.near > 0,
  );
  const refusedLenses = [
    { fovDeg: 0, aspect: 1 },
    { fovDeg: 180, aspect: 1 },
    { fovDeg: 40, aspect: 0 },
  ].map((candidate) => {
    try {
      frameAutoMovieViewerSubject(
        { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } },
        {
          id: "az000-el000",
          azimuthDeg: 0,
          elevationDeg: 0,
          distanceFactor: 1,
        },
        candidate,
      );
      return "accepted";
    } catch {
      return "refused";
    }
  });
  TestValidator.equals("an unusable lens is refused", refusedLenses, [
    "refused",
    "refused",
    "refused",
  ]);

  //----
  // 4. A SUBJECT WITH NO MEASURED EXTENT IS STILL AIMABLE
  //----
  const degenerate = frameAutoMovieViewerSubject(
    { min: { x: 3, y: 1, z: -2 }, max: { x: 3, y: 1, z: -2 } },
    { id: "az000-el000", azimuthDeg: 0, elevationDeg: 0, distanceFactor: 1 },
    lens,
  );
  TestValidator.equals(
    "a degenerate box is aimed at where the record does state",
    degenerate.target,
    { x: 3, y: 1, z: -2 },
  );
  TestValidator.predicate(
    "and the eye stands off it rather than inside it",
    () => degenerate.position.z > -2 && degenerate.near > 0,
  );

  //----
  // 5. POSE IN, IMAGE OUT
  //----
  const heading = autoMovieViewerPoseFromHeading(
    { x: 1, y: 2, z: 3 },
    { yaw: 90, pitch: 0 },
    lens,
    { near: 0.05, far: 200 },
  );
  TestValidator.equals(
    "a bare position and heading resolve to a look-at pose",
    {
      x: Number(heading.target.x.toFixed(6)),
      y: Number(heading.target.y.toFixed(6)),
      z: Number(heading.target.z.toFixed(6)),
    },
    { x: 0, y: 2, z: 3 },
  );
  const refusedClips = [
    { near: 0, far: 1 },
    { near: 1, far: 1 },
  ].map((clip) => {
    try {
      autoMovieViewerPoseFromHeading(
        { x: 0, y: 0, z: 0 },
        { yaw: 0, pitch: 0 },
        lens,
        clip,
      );
      return "accepted";
    } catch {
      return "refused";
    }
  });
  TestValidator.equals("an unusable clip range is refused", refusedClips, [
    "refused",
    "refused",
  ]);

  const camera = new THREE.PerspectiveCamera();
  applyAutoMovieViewerSubjectPose(camera, heading);
  TestValidator.equals(
    "the pose is staged on the camera's own world matrix",
    {
      x: Number(camera.matrixWorld.elements[12]!.toFixed(6)),
      y: Number(camera.matrixWorld.elements[13]!.toFixed(6)),
      z: Number(camera.matrixWorld.elements[14]!.toFixed(6)),
      near: camera.near,
      far: camera.far,
      fov: camera.fov,
    },
    { x: 1, y: 2, z: 3, near: 0.05, far: 200, fov: 40 },
  );

  const order: string[] = [];
  const renderer: IAutoMovieViewerSnapshotRenderer = {
    render: () => order.push("render"),
    domElement: {
      width: 1280,
      height: 720,
      toDataURL: (type) => `data:${type ?? "image/png"};base64,AA==`,
    },
  };
  const scene = new THREE.Scene();
  const subject = {
    kind: "element" as const,
    id: "hall-oriel-2",
    revision: "r7",
  };
  let resolvedHeight = 0;
  const view = captureAutoMovieViewerSubjectView({
    subject,
    pose: mullion,
    viewpoint: "az000-el000",
    scene,
    camera,
    renderer,
    resolveForCamera: (_camera, viewportHeight) => {
      order.push("resolve");
      resolvedHeight = viewportHeight;
    },
    snapshot: { mimeType: "image/jpeg", quality: 0.9 },
  });
  TestValidator.equals(
    "the populations are resolved against the drawn viewport before the draw",
    { order, resolvedHeight },
    { order: ["resolve", "render"], resolvedHeight: 720 },
  );
  TestValidator.equals(
    "the observation carries the subject, the viewpoint and the image",
    {
      subject: view.subject,
      viewpoint: view.viewpoint,
      mimeType: view.image.mimeType,
      width: view.image.width,
      height: view.image.height,
    },
    {
      subject,
      viewpoint: "az000-el000",
      mimeType: "image/jpeg",
      width: 1280,
      height: 720,
    },
  );
  TestValidator.equals(
    "an authoring agent and a reviewer naming one subject and pose agree",
    captureAutoMovieViewerSubjectView({
      subject,
      pose: mullion,
      viewpoint: "az000-el000",
      scene,
      camera,
      renderer,
      resolveForCamera: () => {},
      snapshot: { mimeType: "image/jpeg", quality: 0.9 },
    }),
    view,
  );
  const adHoc = captureAutoMovieViewerSubjectView({
    subject,
    pose: heading,
    scene,
    camera,
    renderer,
    resolveForCamera: () => {},
  });
  TestValidator.equals(
    "an unplanned look is not counted as a planned sample",
    { viewpoint: adHoc.viewpoint, mimeType: adHoc.image.mimeType },
    { viewpoint: null, mimeType: "image/png" },
  );

  //----
  // 6. NOTHING THE HARNESS EMITS IS DELIVERY EVIDENCE
  //----
  TestValidator.equals(
    "every subject observation declares itself unfit for delivery review",
    [view.deliveryEvidence, adHoc.deliveryEvidence],
    [false, false],
  );
  const deliveryReview = (evidence: { deliveryEvidence: true }): boolean =>
    evidence.deliveryEvidence;
  const offered: IAutoMovieViewerSubjectView = view;
  // @ts-expect-error A subject observation is structurally refused by a
  // consumer that requires delivery evidence, so no caller can pass one in.
  void (() => deliveryReview(offered));
};
