import { resolveCameraAt } from "@automovie/engine";
import {
  IAutoMovieAssembleApplication,
  IAutoMovieCameraIntent,
  IAutoMovieGait,
  IAutoMovieVector3,
} from "@automovie/interface";
import {
  AutoMovieApplication,
  IAutoMovieMcpActorContext,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import {
  makeBlockingWrite,
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
} from "../internal/filmFixtures";
import { createSkeleton, makePose } from "../internal/fixtures";
import { vclose } from "../internal/predicates";

const app = new AutoMovieApplication();

const walk: IAutoMovieGait = {
  name: "walk",
  period: 1,
  limbs: [{ bone: "leftUpperLeg", phase: 0, duty: 0.5, amplitude: 25 }],
};

const actorContext = (
  position: IAutoMovieVector3,
  facingDeg: number,
): IAutoMovieMcpActorContext => {
  const skeleton = createSkeleton();
  return {
    skeleton: skeleton.id,
    gaits: [walk],
    position,
    speed: 1,
    facingDeg,
    eyeHeight: 1.6,
    restPose: makePose([]),
    rig: skeleton,
  };
};

const assemble = (shot: string): IAutoMovieAssembleApplication.IWrite => ({
  type: "write",
  sequence: { id: "seq-coverage", name: "the duel, two angles" },
  fps: 12,
  entries: [{ shot, trim: null, transition: null }],
  pacing: "one beat, held.",
  continuity: "the profile angle covers the same performed beat.",
});

/**
 * The multi-camera benchmark contract (#1187, corpus scenario M03) driven
 * through the real MCP tools: cover one beat with a front and a profile camera,
 * then cut the angle mid-beat. `stage` places both cameras, `block` plans the
 * profile angle as `coverage`, `perform` compiles it into an alternate take on
 * `shot.coverage` beside the untouched hero take, and `cut` assembles the one
 * shot: a render host then picks its angle per instant without re-performing
 * anything, which is what makes coverage cheaper than a second shot.
 *
 * Both cameras sit at the framing aim height (y = 0.864 = 0.72 × the fixture
 * rig's 1.2 m rest height) at 2 m with `fovY = 90°`, so the framed distance is
 * (0.62 × 1.2) / 2 / tan(45°) = 0.372 m along each camera's staged bearing: the
 * front take resolves to (0, 0.864, 0.372) and the profile take to (0.372,
 * 0.864, 0), hand numbers rather than echoes of the solve.
 *
 * Scenarios:
 *
 * 1. The ladder runs: stage two cameras, block beat-1 with the profile camera as
 *    `coverage`, perform it against that blocking, cut the resulting shot.
 * 2. The performed shot keeps its singular hero camera `cam-front` and carries
 *    exactly one alternate take: `cam-profile`, its own compiled move, and its
 *    own `{ start: 0, medium, static }` intent record with no invented lens.
 * 3. A cut consumer reading the assembled sequence resolves the hero angle at t =
 *    0.5 s and the coverage angle at t = 1.5 s: two different cameras, two
 *    different world placements, one performed beat.
 * 4. The alternate take covers the WHOLE beat, so the same cut is legal at any
 *    instant: the profile placement resolves identically at t = 0 and t = 2.
 */
export const test_mcp_camera_coverage_cut = (): void => {
  const script = makeScriptWrite();
  const staged = app.stage({
    script,
    staging: makeStagingWrite({
      cameras: [
        {
          node: "cam-front",
          position: { x: 0, y: 0.864, z: 2 },
          lookAt: { kind: "node", node: "knightA" },
          fovDeg: 90,
        },
        {
          node: "cam-profile",
          position: { x: 2, y: 0.864, z: 0 },
          lookAt: { kind: "node", node: "knightA" },
          fovDeg: 90,
        },
      ],
    }),
  }).staged;
  TestValidator.equals("two angles staged", staged.success, true);
  if (staged.success !== true) return;

  // 1. block the beat for both angles.
  const blocked = app.block({
    script,
    staged,
    blocking: makeBlockingWrite({
      coverage: [
        {
          camera: "cam-profile",
          framing: "medium",
          move: "static",
          on: { kind: "node", node: "knightA" },
        },
      ],
    }),
  }).blocked;
  TestValidator.equals("the covered beat blocks", blocked.success, true);
  if (blocked.success !== true) return;

  const position = (id: string): IAutoMovieVector3 => {
    const node = staged.scene.nodes.find((entry) => entry.id === id);
    if (node === undefined) throw new Error(`missing node ${id}`);
    return node.transform.translation;
  };
  const performed = app.perform({
    script,
    staged,
    performance: makePerformanceWrite({
      draft: [
        {
          verb: "locomote",
          actor: ["knightA", "knightB"],
          start: 0,
          duration: 1,
          gait: "walk",
          to: { kind: "point", point: { x: 0, y: 0, z: 0.35 } },
        },
        {
          verb: "frame",
          actor: "cam-front",
          start: 0,
          duration: "auto",
          framing: "medium",
          move: "static",
          on: { kind: "node", node: "knightA" },
        },
      ],
      revise: { review: "unchanged.", final: null },
    }),
    actors: {
      knightA: actorContext(position("knightA"), 0),
      knightB: actorContext(position("knightB"), 180),
    },
    blocking: blocked.blocking,
  }).performed;
  TestValidator.equals("the covered beat performs", performed.success, true);
  if (performed.success !== true) return;

  // 2. the hero election is untouched; the alternate rides beside it.
  TestValidator.equals(
    "the hero take stays the single live camera",
    performed.shot.camera,
    "cam-front",
  );
  TestValidator.equals(
    "one alternate take covers the beat",
    performed.shot.coverage!.map((take) => take.camera),
    ["cam-profile"],
  );
  const take = performed.shot.coverage![0]!;
  TestValidator.equals(
    "the alternate carries its own compiled move",
    take.cameraMotion!.id,
    "cam:beat-1:cam-profile",
  );
  const expectedIntent: IAutoMovieCameraIntent[] = [
    {
      start: 0,
      framing: "medium",
      move: "static",
      focus: null,
      focalLength: null,
    },
  ];
  TestValidator.equals(
    "the alternate carries its own intent",
    take.cameraIntent,
    expectedIntent,
  );

  const cut = app.cut({
    assemble: assemble(performed.shot.id),
    shots: [performed.shot],
  }).cut;
  TestValidator.equals("the shot cuts", cut.success, true);
  if (cut.success !== true) return;
  TestValidator.equals(
    "the cut plays the one performed beat",
    cut.sequence.shots.map((entry) => entry.shot),
    ["shot:beat-1"],
  );

  // 3. the cut consumer: hero angle before the mid-beat cut, coverage after.
  const shots = [performed.shot];
  const baseOf = (id: string) => {
    const camera = staged.scene.cameras.find((entry) => entry.id === id);
    if (camera === undefined) throw new Error(`missing camera ${id}`);
    return camera.transform;
  };
  const CUT_AT = 1;
  const angleAt = (time: number) => {
    const entry = cut.sequence.shots[0]!;
    const shot = shots.find((candidate) => candidate.id === entry.shot)!;
    const chosen =
      time < CUT_AT
        ? { camera: shot.camera, cameraMotion: shot.cameraMotion }
        : shot.coverage![0]!;
    return {
      camera: chosen.camera,
      ...resolveCameraAt(
        baseOf(chosen.camera),
        chosen.cameraMotion,
        chosen.camera,
        time,
      ),
    };
  };

  const before = angleAt(0.5);
  const after = angleAt(1.5);
  TestValidator.equals(
    "the consumer cuts from the front angle to the profile angle",
    [before.camera, after.camera],
    ["cam-front", "cam-profile"],
  );
  TestValidator.predicate(
    "the front angle sits on the subject's +Z bearing",
    vclose(before.position, { x: 0, y: 0.864, z: 0.372 }),
  );
  TestValidator.predicate(
    "the profile angle sits on the subject's +X bearing",
    vclose(after.position, { x: 0.372, y: 0.864, z: 0 }),
  );

  // 4. the alternate spans the whole beat, so the cut instant is free.
  const profileAt = (time: number) =>
    resolveCameraAt(baseOf(take.camera), take.cameraMotion, take.camera, time)
      .position;
  TestValidator.predicate(
    "the profile take holds its placement across the whole beat",
    vclose(profileAt(0), after.position) &&
      vclose(profileAt(2), after.position),
  );
};
