import {
  HUMANOID_JOINT_AXES,
  IAutoMovieActionSynthesizer,
  Quaternion,
  Vector3,
  performShot,
  resolveAttachment,
  sampleClip,
  sampleMotion,
  stageScene,
} from "@automovie/engine";
import {
  IAutoMovieActionCall,
  IAutoMovieClip,
  IAutoMovieMotion,
  IAutoMoviePose,
  IAutoMovieQuaternion,
  IAutoMovieStagingApplication,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
  validSynthesizer,
} from "../internal/filmFixtures";
import {
  IDENTITY_TRANSFORM,
  createSkeleton,
  keyframe,
  makeMotion,
  makePose,
} from "../internal/fixtures";
import { vclose } from "../internal/predicates";

/** The dragon strides +x by 2 m over the 2 s shot (root translation only). */
const dragonWalk: IAutoMovieMotion = makeMotion(
  [
    keyframe(
      0,
      makePose([], {
        translation: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      }),
    ),
    keyframe(
      2,
      makePose([], {
        translation: { x: 2, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      }),
    ),
  ],
  2,
);

/** The dragon animates its stride; launch/attach fatten objects, not rigs. */
const synth: IAutoMovieActionSynthesizer = (action, actor) =>
  action.verb === "launch" || action.verb === "attachTo"
    ? null
    : actor === "dragon"
      ? dragonWalk
      : validSynthesizer(action, actor);

const scriptOf = () =>
  makeScriptWrite({
    cast: [
      { node: "dragon", character: "the wyrm", modelRef: "stickman" },
      { node: "horse", character: "the steed", modelRef: "stickman" },
      { node: "rider", character: "the knight", modelRef: "stickman" },
      { node: "sword", character: "the blade", modelRef: null },
    ],
    beats: [
      {
        id: "beat-1",
        name: "the caravan",
        summary: "the mounted column strides out",
        durationHint: 2,
      },
    ],
  });

const cameraOf = (): IAutoMovieStagingApplication.IWrite["cameras"] => [
  {
    node: "cam",
    position: { x: 4, y: 2, z: 4 },
    lookAt: { kind: "node", node: "dragon" },
    fovDeg: 45,
  },
];

/**
 * Every intermediate parent is staged at a decoy coordinate the chain must
 * override: the horse rides the dragon's hips, the rider rides the horse's
 * spine, and the sword is grabbed per beat: three couplings deep.
 */
const stagingOf = () =>
  makeStagingWrite({
    scene: { id: "scene-caravan", name: "the caravan" },
    actors: [
      { node: "dragon", position: { x: 0, y: 0, z: 0 }, facingDeg: 0 },
      {
        node: "horse",
        position: { x: 7, y: 7, z: 7 },
        facingDeg: 0,
        attach: { parent: "dragon", bone: "hips" },
      },
      {
        node: "rider",
        position: { x: 5, y: 5, z: 5 },
        facingDeg: 0,
        attach: { parent: "horse", bone: "spine" },
      },
      { node: "sword", position: { x: 3, y: 3, z: 3 }, facingDeg: 0 },
    ],
    cameras: cameraOf(),
  });

const posAt = (
  clip: IAutoMovieClip,
  node: string,
  t: number,
): IAutoMovieVector3 => {
  const v = sampleClip(clip, t).get(`node:${node}:translation`)!.value;
  return { x: v[0]!, y: v[1]!, z: v[2]! };
};

/** Compose `local` onto a parent world frame: compileAttach's composition. */
const composed = (
  parent: { translation: IAutoMovieVector3; rotation: IAutoMovieQuaternion },
  local: IAutoMovieTransform,
): { translation: IAutoMovieVector3; rotation: IAutoMovieQuaternion } => ({
  translation: Vector3.add(
    parent.translation,
    Quaternion.rotateVector(parent.rotation, local.translation),
  ),
  rotation: Quaternion.multiply(parent.rotation, local.rotation),
});

/**
 * Chained object couplings compose through every link (#1140). Before the fix
 * each coupling was baked from its parent's STAGED transform + pose motion
 * alone: a prop attached to a mounted knight silently stayed at the knight's
 * staged spot while the knight rode away, and a coupling cycle baked two
 * frozen couplings with no violation.
 *
 * Scenarios:
 *
 * 1. A three-deep chain (sword ← rider ← horse ← walking dragon) bakes every link
 *    onto its parent's RIDDEN path: the sword's baked follow equals the
 *    hand-composed FK chain exactly, at the shot start and end.
 * 2. The whole chain carries the dragon's stride: the sword's net displacement is
 *    exactly the dragon's +2 m root travel (every other link is static).
 * 3. The pre-fix output is dead: the sword never sits at the composition onto the
 *    rider's staged decoy placement.
 * 4. A mount cycle (A rides B, B rides A) fails the shot with a violation naming
 *    the cycle: never a silent frozen bake.
 * 5. A mutual per-beat `attachTo` (A grabs B while B grabs A) fails the same way:
 *    the gate covers both coupling sources.
 * 6. A chained coupling whose intermediate parent has no rig still reports the
 *    existing mount-rig violation: the chain does not mask it.
 */
export const test_film_perform_shot_coupling_chain = (): void => {
  const staged = stageScene(scriptOf(), stagingOf());
  if (staged.success !== true) throw new Error("staging must succeed");

  const skeleton = createSkeleton();
  const ok = performShot({
    script: scriptOf(),
    staged,
    performance: makePerformanceWrite({
      beat: "beat-1",
      draft: [
        {
          verb: "gesture",
          actor: "dragon",
          start: 0,
          duration: 2,
          kind: "bow",
        },
        {
          verb: "attachTo",
          actor: "sword",
          parent: "rider",
          bone: "leftHand",
          start: 0,
          duration: 2,
        },
      ],
      revise: { review: "the caravan reads.", final: null },
      duration: 2,
    }),
    synthesize: synth,
    skeleton: (node) => (node === "sword" ? null : skeleton),
  });
  TestValidator.equals("the chained shot performs", ok.success, true);
  if (ok.success !== true) return;
  TestValidator.equals(
    "every coupling bakes a follow clip",
    ok.shot.objectMotions.map((c) => c.id).sort((a, b) => a.localeCompare(b)),
    ["attach:horse", "attach:rider", "attach:sword"],
  );

  // 1. the exact chain oracle: dragon staged ∘ dragon pose FK(hips) → horse,
  //    ∘ rest FK(spine) → rider, ∘ rest FK(leftHand) → sword.
  const rest: IAutoMoviePose = {
    skeleton: skeleton.id,
    root: null,
    joints: [],
  };
  const dragonStaged = staged.scene.nodes.find(
    (n) => n.id === "dragon",
  )!.transform;
  const swordClip = ok.shot.objectMotions.find((c) => c.id === "attach:sword")!;
  const expectedSwordAt = (t: number): IAutoMovieVector3 => {
    const horse = composed(
      dragonStaged,
      resolveAttachment(
        sampleMotion(ok.motions["dragon"]!, t).pose,
        skeleton,
        { parentBone: "hips", offset: IDENTITY_TRANSFORM },
        HUMANOID_JOINT_AXES,
      ),
    );
    const rider = composed(
      horse,
      resolveAttachment(
        rest,
        skeleton,
        { parentBone: "spine", offset: IDENTITY_TRANSFORM },
        HUMANOID_JOINT_AXES,
      ),
    );
    return composed(
      rider,
      resolveAttachment(
        rest,
        skeleton,
        { parentBone: "leftHand", offset: IDENTITY_TRANSFORM },
        HUMANOID_JOINT_AXES,
      ),
    ).translation;
  };
  TestValidator.predicate(
    "the sword's baked follow equals the composed chain at the start",
    vclose(posAt(swordClip, "sword", 0), expectedSwordAt(0), 1e-9),
  );
  TestValidator.predicate(
    "the sword's baked follow equals the composed chain at the end",
    vclose(posAt(swordClip, "sword", 2), expectedSwordAt(2), 1e-9),
  );

  // 2. the chain carries the dragon's stride, link-invariant.
  TestValidator.predicate(
    "the sword's net displacement is exactly the dragon's +2 m travel",
    vclose(
      Vector3.subtract(
        posAt(swordClip, "sword", 2),
        posAt(swordClip, "sword", 0),
      ),
      { x: 2, y: 0, z: 0 },
      1e-9,
    ),
  );

  // 3. the pre-fix composition (rider's staged decoy placement) is dead.
  const staleSword = composed(
    { translation: { x: 5, y: 5, z: 5 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
    resolveAttachment(
      rest,
      skeleton,
      { parentBone: "leftHand", offset: IDENTITY_TRANSFORM },
      HUMANOID_JOINT_AXES,
    ),
  ).translation;
  TestValidator.predicate(
    "the sword never sits at the stale staged-parent composition",
    !vclose(posAt(swordClip, "sword", 2), staleSword, 1e-3),
  );

  // 4. a mount cycle violates instead of baking frozen couplings.
  const cyclic = stageScene(
    scriptOf(),
    makeStagingWrite({
      scene: { id: "scene-cycle", name: "the ouroboros" },
      actors: [
        { node: "dragon", position: { x: 0, y: 0, z: 0 }, facingDeg: 0 },
        {
          node: "horse",
          position: { x: 1, y: 0, z: 0 },
          facingDeg: 0,
          attach: { parent: "rider", bone: "spine" },
        },
        {
          node: "rider",
          position: { x: 2, y: 0, z: 0 },
          facingDeg: 0,
          attach: { parent: "horse", bone: "spine" },
        },
        { node: "sword", position: { x: 3, y: 3, z: 3 }, facingDeg: 0 },
      ],
      cameras: cameraOf(),
    }),
  );
  if (cyclic.success !== true) throw new Error("cyclic staging must succeed");
  const cycleShot = performShot({
    script: scriptOf(),
    staged: cyclic,
    performance: makePerformanceWrite({
      beat: "beat-1",
      draft: [
        {
          verb: "gesture",
          actor: "dragon",
          start: 0,
          duration: 2,
          kind: "bow",
        },
      ],
      revise: { review: "the ouroboros cannot ride.", final: null },
      duration: 2,
    }),
    synthesize: synth,
    skeleton: (node) => (node === "sword" ? null : skeleton),
  });
  TestValidator.equals(
    "a mount cycle fails the shot",
    cycleShot.success,
    false,
  );
  if (cycleShot.success === false)
    TestValidator.predicate(
      "the violation names the cycle",
      cycleShot.violations.some((v) => v.expected.includes("cycle")),
    );

  // 5. a mutual per-beat attachTo violates the same way.
  const mutual = (draft: IAutoMovieActionCall[]) =>
    performShot({
      script: scriptOf(),
      staged,
      performance: makePerformanceWrite({
        beat: "beat-1",
        draft,
        revise: { review: "the mutual grip cannot resolve.", final: null },
        duration: 2,
      }),
      synthesize: synth,
      skeleton: (node) => (node === "sword" ? null : skeleton),
    });
  const grip = mutual([
    {
      verb: "attachTo",
      actor: "horse",
      parent: "rider",
      bone: "leftHand",
      start: 0,
      duration: 2,
    },
    {
      verb: "attachTo",
      actor: "rider",
      parent: "horse",
      bone: "leftHand",
      start: 0,
      duration: 2,
    },
  ]);
  TestValidator.equals("a mutual attachTo fails the shot", grip.success, false);
  if (grip.success === false)
    TestValidator.predicate(
      "the mutual grip violation names the cycle",
      grip.violations.some((v) => v.expected.includes("cycle")),
    );

  // 6. a rig-less intermediate parent still reports the mount-rig violation.
  const riglessLink = performShot({
    script: scriptOf(),
    staged,
    performance: makePerformanceWrite({
      beat: "beat-1",
      draft: [
        {
          verb: "gesture",
          actor: "dragon",
          start: 0,
          duration: 2,
          kind: "bow",
        },
      ],
      revise: { review: "the wyrm has no rig.", final: null },
      duration: 2,
    }),
    synthesize: synth,
    skeleton: (node) =>
      node === "sword" || node === "dragon" ? null : skeleton,
  });
  TestValidator.equals(
    "a rig-less chain link fails the shot",
    riglessLink.success,
    false,
  );
  if (riglessLink.success === false)
    TestValidator.predicate(
      "the chain does not mask the mount-rig violation",
      riglessLink.violations.some((v) => v.path === "$staged.mounts"),
    );
};
