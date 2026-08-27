import { describeAutoMovieSubject } from "@automovie/engine";
import {
  type IAutoMovieViewerSubjectBounds,
  type IAutoMovieViewerViewpoint,
  applyAutoMovieViewerSubjectPose,
  autoMovieViewerTurntableViewpoints,
  frameAutoMovieViewerSubject,
} from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { namedFacts } from "../internal/predicates";
import {
  subjectInspectionArtifact,
  subjectInspectionModel,
} from "../internal/subjectInspectionFixtures";

/**
 * A subject named by key is framed from the box its contents fill, not from
 * the box a room was declared over.
 *
 * This pins the seam the scaffold's subject page stands on
 * (`packages/template/scaffold/viewer/src/subject.ts`, opened as
 * `viewer/subject.html?subject=<kind>:<id>`). That page holds no geometry of
 * its own: it resolves a key through `describeAutoMovieSubject`, takes the
 * description's CONTENT box, and hands it to `frameAutoMovieViewerSubject`.
 * Every property a reviewer relies on there — that the thing named is the
 * thing framed, that all of it is inside the picture, that none of it is
 * clipped away — is a property of that chain and is measured here.
 *
 * The declared box is the trap, and it is a trap because it is plausible. A
 * space is authored as a convex cell and its contents fill some other extent
 * inside it; reading the first as the second aims the eye at a point where
 * nothing stands, which is how three of four cameras in one survey framed a
 * wall (samchon/automovie#1920). Choosing content over declared is therefore
 * not a preference, and the two ways the wrong choice shows are measured
 * rather than described: the aim moves, and the subject shrinks.
 *
 * Scenarios:
 *
 * 1. The two boxes of one room genuinely disagree, so the choice between them
 *    is a real choice.
 * 2. Every planned viewpoint, at a landscape and a portrait viewport, contains
 *    the whole content box inside the frustum — side planes, near and far.
 * 3. Framing the declared cell instead moves the aim point off the contents
 *    and shrinks what the reviewer is looking at.
 * 4. Where the contents overflow their own cell, the declared framing does not
 *    merely shrink them: it crops them out of the picture.
 * 5. A room with nothing in it reports no content box, and the declared cell
 *    is what is left to frame.
 * 6. A fixed downward ring puts the eye under the ground for a room and not
 *    for a slate on a roof, and the eye's height rises with the angle, which
 *    is what makes one grounded angle per subject well defined.
 * 7. The compiled ids the page spells from a subject key resolve, and a
 *    prototype's answer is model-space, which is why the page refuses to aim
 *    a world camera at one.
 */
export const test_viewer_subject_page_framing = (): void => {
  const artifact = subjectInspectionArtifact();
  const room = describeAutoMovieSubject(artifact, "space:castle/hall");
  const content = room.bounds.content;
  const declared = room.bounds.declared;
  if (content === null || declared === null)
    throw new Error("The inspection fixture must state both room extents.");

  //----
  // 1. THE TWO BOXES DISAGREE
  //----
  TestValidator.equals(
    "a declared cell and its contents are different extents",
    namedFacts([
      ["world space", () => room.bounds.coordinateSpace === "world"],
      ["declared holds the contents", () => holds(declared, content)],
      ["aims apart", () => middle(declared).distanceTo(middle(content)) > 1],
      ["contents are smaller", () => radius(content) < radius(declared) / 1.5],
    ]),
    {
      "world space": true,
      "declared holds the contents": true,
      "aims apart": true,
      "contents are smaller": true,
    },
  );

  //----
  // 2. THE CONTENT BOX IS WHOLLY IN FRAME, FROM EVERY PLANNED VIEWPOINT
  //----
  const plan = autoMovieViewerTurntableViewpoints({
    azimuthCount: 8,
    elevationsDeg: [-20, 10, 45],
    distanceFactor: 1.25,
  });
  const escaped: string[] = [];
  for (const viewpoint of plan)
    // A portrait viewport is the framing failure nobody notices from a
    // thumbnail: fitting the wider field crops a tall subject out of a narrow
    // one, so both shapes are walked rather than the comfortable one.
    for (const aspect of [16 / 9, 9 / 16])
      if (frames(content, viewpoint, aspect) === false)
        escaped.push(`${viewpoint.id}@${aspect.toFixed(2)}`);
  TestValidator.equals(
    "every planned viewpoint holds the whole subject inside the picture",
    escaped,
    [],
  );

  //----
  // 3. FRAMING THE DECLARED CELL AIMS AT NOTHING AND SHRINKS THE SUBJECT
  //----
  const viewpoint = plan[3]!;
  const fromContent = frameAutoMovieViewerSubject(content, viewpoint, LENS);
  const fromDeclared = frameAutoMovieViewerSubject(declared, viewpoint, LENS);
  TestValidator.equals(
    "the declared cell moves the aim off the contents and shrinks them",
    namedFacts([
      [
        "content framing aims at the contents",
        () => middle(content).distanceTo(vector(fromContent.target)) < 1e-9,
      ],
      [
        "declared framing aims somewhere else",
        () => middle(content).distanceTo(vector(fromDeclared.target)) > 1,
      ],
      [
        "and the contents subtend a smaller angle",
        () =>
          subtended(content, fromContent.position) >
          subtended(content, fromDeclared.position) * 1.5,
      ],
    ]),
    {
      "content framing aims at the contents": true,
      "declared framing aims somewhere else": true,
      "and the contents subtend a smaller angle": true,
    },
  );

  //----
  // 4. A ROOM THAT OVERFLOWS ITS OWN CELL IS CROPPED BY THE DECLARED FRAMING
  //----
  // The shape is the medieval-residence `stair-ground`: a storey-high cell
  // (4.20 m) whose stair tower runs 9.40 m up through it, so the contents are
  // the LARGER box. Framing the cell then puts the eye nearer than the contents
  // need and aims below them, and geometry leaves the picture outright rather
  // than merely reading small. Reproduced here by one tall placement inside the
  // fixture's own room.
  const overflow = describeAutoMovieSubject(
    subjectInspectionArtifact({
      models: [
        subjectInspectionModel({
          id: "stair-tower-model",
          min: { x: -19, y: 0, z: -19 },
          max: { x: 19, y: 60, z: 19 },
        }),
      ],
    }),
    "space:castle/hall",
  );
  const tower = overflow.bounds.content!;
  const cell = overflow.bounds.declared!;
  TestValidator.equals(
    "the overflowing contents are the larger box and frame themselves whole",
    namedFacts([
      ["the contents are the larger box", () => radius(tower) > radius(cell)],
      [
        "the contents frame themselves whole",
        () => plan.every((planned) => frames(tower, planned, 16 / 9)),
      ],
    ]),
    {
      "the contents are the larger box": true,
      "the contents frame themselves whole": true,
    },
  );
  TestValidator.equals(
    "no planned viewpoint derived from the cell holds the contents",
    plan
      .filter((planned) => framesInside(cell, tower, planned, 16 / 9))
      .map((planned) => planned.id),
    [],
  );

  //----
  // 5. AN EMPTY ROOM STILL HAS SOMETHING TO FRAME
  //----
  const bare = describeAutoMovieSubject(
    subjectInspectionArtifact({ models: [], nodes: [] }),
    "space:castle/hall",
  );
  TestValidator.equals(
    "an undressed room reports no contents and keeps its declared cell",
    namedFacts([
      ["no content box", () => bare.bounds.content === null],
      ["a declared cell remains", () => bare.bounds.declared !== null],
      [
        "which frames",
        () => frames(bare.bounds.declared!, plan[0]!, 16 / 9) === true,
      ],
    ]),
    {
      "no content box": true,
      "a declared cell remains": true,
      "which frames": true,
    },
  );

  //----
  // 6. A DOWNWARD RING IS THE SUBJECT'S TO ANSWER, NOT THE PLAN'S TO FIX
  //----
  // A soffit ring is right for a slate on a roof, which drops half a metre and
  // is still ten metres up, and wrong for a room, which is fitted at tens of
  // metres and therefore drops through the floor: on the medieval residence a
  // -20 degree ring put the hall's eye 7.5 m underground, looking up at the
  // building through the ground, on eight of twenty-four viewpoints and on the
  // first frame anybody saw. The page answers by deriving the ring from the
  // subject the way it already derives the distance. What is measured here is
  // what makes that derivation well posed rather than the arithmetic of it:
  // the hazard is real, level is always safe, the two are separated by a
  // monotone height, and a subject standing clear of the ground keeps the
  // whole ring it asked for.
  const grounded = describeAutoMovieSubject(artifact, "space:castle/hall")
    .bounds.content!;
  const lifted = describeAutoMovieSubject(
    subjectInspectionArtifact({
      models: [
        subjectInspectionModel({
          id: "roof-slate-model",
          min: { x: -0.29, y: 11.9, z: -0.29 },
          max: { x: 0.29, y: 11.95, z: 0.29 },
        }),
      ],
    }),
    "element:castle/roof-slate",
  ).bounds.content!;
  const eyeHeight = (
    bounds: IAutoMovieViewerSubjectBounds,
    elevationDeg: number,
  ): number =>
    frameAutoMovieViewerSubject(
      bounds,
      { id: "probe", azimuthDeg: 0, elevationDeg, distanceFactor: 1.25 },
      LENS,
    ).position.y;
  TestValidator.equals(
    "how far down a subject may be looked at from is the subject's own answer",
    namedFacts([
      [
        "a room standing on the ground is put under it",
        () => eyeHeight(grounded, -20) < Math.min(0, grounded.min.y),
      ],
      [
        "a level eye never is",
        () => eyeHeight(grounded, 0) >= Math.min(0, grounded.min.y),
      ],
      [
        "and height rises with the angle between them",
        () =>
          [-20, -15, -10, -5, 0].every(
            (deg, index, all) =>
              index === 0 ||
              eyeHeight(grounded, deg) > eyeHeight(grounded, all[index - 1]!),
          ),
      ],
      [
        "while a slate on a roof keeps the whole ring it asked for",
        () => eyeHeight(lifted, -20) > 0,
      ],
    ]),
    {
      "a room standing on the ground is put under it": true,
      "a level eye never is": true,
      "and height rises with the angle between them": true,
      "while a slate on a roof keeps the whole ring it asked for": true,
    },
  );

  //----
  // 7. WHAT A SUBJECT KEY SPELLS, AND WHAT IT MUST NOT AIM AT
  //----
  TestValidator.equals(
    "a placed subject answers in world space and a prototype does not",
    [
      describeAutoMovieSubject(artifact, "space:castle/hall").bounds
        .coordinateSpace,
      describeAutoMovieSubject(artifact, "element:castle/solar-oriel").bounds
        .coordinateSpace,
      describeAutoMovieSubject(artifact, "prototype:solar-oriel-model").bounds
        .coordinateSpace,
    ],
    ["world", "world", "model"],
  );
  TestValidator.equals(
    "a room lists the placements standing in it, so a reviewer can descend",
    room.members.items,
    [
      "element:castle/guard-rack-west-pole-0",
      "element:castle/solar-oriel",
      "element:castle/south-half-timber-brace-0",
    ],
  );
};

/** The lens the scaffold page looks through. */
const LENS = { fovDeg: 35, aspect: 16 / 9 };

const vector = (value: { x: number; y: number; z: number }): THREE.Vector3 =>
  new THREE.Vector3(value.x, value.y, value.z);

const middle = (bounds: IAutoMovieViewerSubjectBounds): THREE.Vector3 =>
  vector(bounds.min).add(vector(bounds.max)).multiplyScalar(0.5);

const radius = (bounds: IAutoMovieViewerSubjectBounds): number =>
  vector(bounds.max).sub(vector(bounds.min)).length() / 2;

const corners = (bounds: IAutoMovieViewerSubjectBounds): THREE.Vector3[] =>
  [bounds.min.x, bounds.max.x].flatMap((x) =>
    [bounds.min.y, bounds.max.y].flatMap((y) =>
      [bounds.min.z, bounds.max.z].map((z) => new THREE.Vector3(x, y, z)),
    ),
  );

/** Whether the outer box contains the inner one. */
const holds = (
  outer: IAutoMovieViewerSubjectBounds,
  inner: IAutoMovieViewerSubjectBounds,
): boolean =>
  (["x", "y", "z"] as const).every(
    (axis) =>
      outer.min[axis] <= inner.min[axis] && inner.max[axis] <= outer.max[axis],
  );

/** Half-angle the box's bounding sphere subtends from one eye position. */
const subtended = (
  bounds: IAutoMovieViewerSubjectBounds,
  eye: { x: number; y: number; z: number },
): number => Math.atan2(radius(bounds), middle(bounds).distanceTo(vector(eye)));

/**
 * Whether one viewpoint puts every corner of the box inside the drawn volume.
 *
 * `THREE.Frustum` decides against all six planes, so this is one question about
 * the side fields AND the derived clip range: a near plane that sliced the
 * subject's front face, or a far plane short of its back, fails here exactly as
 * a cropped edge does.
 */
const frames = (
  bounds: IAutoMovieViewerSubjectBounds,
  viewpoint: IAutoMovieViewerViewpoint,
  aspect: number,
): boolean => framesInside(bounds, bounds, viewpoint, aspect);

/** The same question when the eye was derived from some OTHER box. */
const framesInside = (
  framed: IAutoMovieViewerSubjectBounds,
  judged: IAutoMovieViewerSubjectBounds,
  viewpoint: IAutoMovieViewerViewpoint,
  aspect: number,
): boolean => {
  const camera = new THREE.PerspectiveCamera();
  applyAutoMovieViewerSubjectPose(
    camera,
    frameAutoMovieViewerSubject(framed, viewpoint, { fovDeg: 35, aspect }),
  );
  const frustum = new THREE.Frustum().setFromProjectionMatrix(
    new THREE.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    ),
  );
  return corners(judged).every((corner) => frustum.containsPoint(corner));
};
