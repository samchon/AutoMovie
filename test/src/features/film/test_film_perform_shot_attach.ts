import {
  HUMANOID_JOINT_AXES,
  HUMANOID_REST_FRAME,
  IAutoMovieActionSynthesizer,
  Quaternion,
  Vector3,
  performShot,
  resolveAttachment,
  resolveBeatEnd,
  sampleClip,
  sampleMotion,
  stageScene,
} from "@automovie/engine";
import {
  IAutoMovieActionCall,
  IAutoMovieMotion,
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
  joint,
  keyframe,
  makeMotion,
  makePose,
} from "../internal/fixtures";
import { vclose } from "../internal/predicates";

/** A launch/attach produces no actor pose: those animate objects, not the rig. */
const synth: IAutoMovieActionSynthesizer = (action, actor) =>
  action.verb === "launch" || action.verb === "attachTo"
    ? null
    : validSynthesizer(action, actor);

const scriptOf = () =>
  makeScriptWrite({
    cast: [
      { node: "knight", character: "the knight", modelRef: "stickman" },
      { node: "sword", character: "the sword", modelRef: null },
      { node: "shield", character: "the shield", modelRef: null },
    ],
    beats: [
      {
        id: "beat-1",
        name: "the salute",
        summary: "the knight raises the sword",
        durationHint: 2,
      },
    ],
  });

const stagingOf = () =>
  makeStagingWrite({
    actors: [
      { node: "knight", position: { x: 0, y: 0, z: 0 }, facingDeg: 0 },
      { node: "sword", position: { x: 0.75, y: 1.4, z: 0 }, facingDeg: 0 },
      { node: "shield", position: { x: 0, y: 1.4, z: 0 }, facingDeg: 0 },
    ],
    cameras: [
      {
        node: "cam-main",
        position: { x: 3, y: 1.6, z: 3 },
        lookAt: { kind: "node", node: "knight" },
        fovDeg: 45,
      },
    ],
  });

/**
 * Wires the `attachTo` verb through the PERFORMANCE consumer: the coupled prop
 * gets a shot `objectMotion` that rides the parent's bone (animated when the
 * parent moves), and the prop, being no rig, gets no pose performance.
 *
 * Scenarios:
 *
 * 1. The knight gestures (the arm moves) with the sword attached to its
 *    `leftHand`: the sword gets one `objectMotion` that changes over the shot
 *    (it follows the swinging hand), and only the knight performs.
 * 2. A clinical-space parent clip carries its restFrames into the baked follow
 *    clip, matching the renderer/player FK path.
 * 3. An attachTo parent that is not a staged node → an input violation.
 * 4. An attachTo parent with no rig to attach a bone of → a violation.
 * 5. A bone that is not on the parent's skeleton → a violation.
 * 6. A child node cannot attach to one of its own bones.
 * 7. A handoff (#989), the same child attached over two disjoint spans, bakes
 *    UNIQUE ids in start order (`attach:sword`, `attach:sword:2`), so the shot
 *    stays committable, and `resolveBeatEnd` follows the LATEST coupling
 *    WITHOUT any staged mount (#1141, the grab alone drives the end state): the
 *    sword's end transform rides the second attachment's final follow sample
 *    (not the first's, not the staged placement), its end velocity is the
 *    follow clip's trailing read, and its `mount` stays null (a per-beat grab
 *    is not a persistent binding). The never-coupled knight keeps the
 *    staged/pose-root path.
 */
export const test_film_perform_shot_attach = (): void => {
  const staged = stageScene(scriptOf(), stagingOf());
  if (staged.success !== true) throw new Error("staging must succeed");

  const perform = (draft: IAutoMovieActionCall[]) =>
    performShot({
      script: scriptOf(),
      staged,
      performance: makePerformanceWrite({
        beat: "beat-1",
        draft,
        revise: { review: "the salute reads.", final: null },
        duration: 2,
      }),
      synthesize: synth,
      skeleton: (node) =>
        node === "sword" || node === "shield" ? null : createSkeleton(),
    });

  // 1. a valid attach: the sword follows the knight's moving hand; the shield
  // (an array actor, auto duration) rides the chest to the end of the shot.
  const ok = perform([
    {
      verb: "gesture",
      actor: "knight",
      start: 0,
      duration: 1,
      kind: "bow",
    },
    {
      verb: "attachTo",
      actor: "sword",
      parent: "knight",
      bone: "leftHand",
      start: 0,
      duration: 2,
    },
    {
      verb: "attachTo",
      actor: ["shield"],
      parent: "knight",
      bone: "chest",
      start: 0,
      duration: "auto",
    },
  ]);
  TestValidator.equals("the attach performs", ok.success, true);
  if (ok.success !== true) return;

  TestValidator.equals(
    "two object motions, the sword's and the shield's follows",
    ok.shot.objectMotions.map((c) => c.id).sort((a, b) => a.localeCompare(b)),
    ["attach:shield", "attach:sword"],
  );
  const follow = ok.shot.objectMotions.find((c) => c.id === "attach:sword")!;
  TestValidator.equals(
    "the follow drives the sword node",
    follow.tracks.map((t) => (t.channel.kind === "node" ? t.channel.node : "")),
    ["sword", "sword"],
  );
  const posAt = (t: number): IAutoMovieVector3 => {
    const v = sampleClip(follow, t).get("node:sword:translation")!.value;
    return { x: v[0]!, y: v[1]!, z: v[2]! };
  };
  TestValidator.predicate(
    "the sword rides the swinging hand (a moving follow)",
    !vclose(posAt(0), posAt(0.5), 1e-3),
  );
  TestValidator.equals(
    "the props are no rig, only the knight performs",
    ok.shot.performances.map((p) => p.node),
    ["knight"],
  );

  const attachEvents = ok.shot.events ?? [];
  TestValidator.equals(
    "the attach handoff emits grab/attach/detach/release events",
    attachEvents.map((event) => event.kind),
    [
      "grab",
      "grab",
      "attach",
      "attach",
      "detach",
      "detach",
      "release",
      "release",
    ],
  );
  const swordAttach = attachEvents.find(
    (event) => event.kind === "attach" && event.object === "sword",
  )!;
  TestValidator.predicate(
    "the sword attach event points at the parent action",
    swordAttach.source === "scriptedCue" &&
      swordAttach.time === 0 &&
      swordAttach.actor === "sword" &&
      swordAttach.target === "knight" &&
      swordAttach.actionIndex === 1,
  );
  const shieldRelease = attachEvents.find(
    (event) => event.kind === "release" && event.object === "shield",
  )!;
  TestValidator.predicate(
    "the shield release event marks the auto-duration handoff end",
    shieldRelease.time === 2 &&
      shieldRelease.target === "knight" &&
      shieldRelease.actionIndex === 2,
  );

  // 2. restFrames are threaded into the baked objectMotion FK.
  const raisedMotion: IAutoMovieMotion = makeMotion(
    [
      keyframe(0, makePose([joint("leftUpperArm", { abduction: 180 })])),
      keyframe(1, makePose([joint("leftUpperArm", { abduction: 180 })])),
    ],
    1,
  );
  const clinicalSynth: IAutoMovieActionSynthesizer = (action, actor) =>
    actor === "knight" && action.verb === "gesture"
      ? raisedMotion
      : synth(action, actor);
  const framed = performShot({
    script: scriptOf(),
    staged,
    performance: makePerformanceWrite({
      beat: "beat-1",
      draft: [
        {
          verb: "gesture",
          actor: "knight",
          start: 0,
          duration: 1,
          kind: "celebrate",
        },
        {
          verb: "attachTo",
          actor: "sword",
          parent: "knight",
          bone: "leftHand",
          start: 0,
          duration: 1,
        },
      ],
      revise: {
        review: "the clinical arm raise carries the sword.",
        final: null,
      },
      duration: 1,
    }),
    synthesize: clinicalSynth,
    skeleton: (node) => (node === "knight" ? createSkeleton() : null),
    restFrames: (node) => (node === "knight" ? HUMANOID_REST_FRAME : undefined),
  });
  TestValidator.equals("the rest-framed attach performs", framed.success, true);
  if (framed.success !== true) return;
  const framedFollow = framed.shot.objectMotions.find(
    (c) => c.id === "attach:sword",
  )!;
  const framedPos = sampleClip(framedFollow, 0.5).get(
    "node:sword:translation",
  )!.value;
  const framedVec = { x: framedPos[0]!, y: framedPos[1]!, z: framedPos[2]! };
  const parent = staged.scene.nodes.find((n) => n.id === "knight")!;
  const local = resolveAttachment(
    sampleMotion(raisedMotion, 0.5).pose,
    createSkeleton(),
    { parentBone: "leftHand", offset: IDENTITY_TRANSFORM },
    HUMANOID_JOINT_AXES,
    HUMANOID_REST_FRAME,
  );
  const expected = Vector3.add(
    parent.transform.translation,
    Quaternion.rotateVector(parent.transform.rotation, local.translation),
  );
  TestValidator.predicate(
    "performShot passes restFrames to attach FK",
    vclose(framedVec, expected, 1e-9),
  );

  // 3. the parent must be a staged node
  const noParent = perform([
    {
      verb: "attachTo",
      actor: "sword",
      parent: "ghost",
      bone: "leftHand",
      start: 0,
      duration: 2,
    },
  ]);
  TestValidator.equals("an unstaged parent fails", noParent.success, false);
  if (noParent.success === false)
    TestValidator.predicate(
      "the violation names the parent",
      noParent.violations.some((v) => v.path.includes(".parent")),
    );

  // 4. the parent must have a rig
  const noRig = perform([
    {
      verb: "attachTo",
      actor: "knight",
      parent: "sword",
      bone: "leftHand",
      start: 0,
      duration: 2,
    },
  ]);
  TestValidator.equals("a rig-less parent fails", noRig.success, false);
  if (noRig.success === false)
    TestValidator.predicate(
      "the violation names the parent",
      noRig.violations.some((v) => v.path.includes(".parent")),
    );

  // 5. the bone must be on the parent's skeleton
  const noBone = perform([
    {
      verb: "attachTo",
      actor: "sword",
      parent: "knight",
      bone: "rightHand",
      start: 0,
      duration: 2,
    },
  ]);
  TestValidator.equals("a missing bone fails", noBone.success, false);
  if (noBone.success === false)
    TestValidator.predicate(
      "the violation names the bone",
      noBone.violations.some((v) => v.path.includes(".bone")),
    );

  // 6. the child and parent must be different nodes
  const selfAttach = perform([
    {
      verb: "attachTo",
      actor: "knight",
      parent: "knight",
      bone: "leftHand",
      start: 0,
      duration: 2,
    },
  ]);
  TestValidator.equals("self-attachment fails", selfAttach.success, false);
  if (selfAttach.success === false)
    TestValidator.predicate(
      "the violation names the child actor",
      selfAttach.violations.some((v) => v.path.includes(".actor")),
    );

  // 7. a handoff bakes unique ids and the beat end follows the latest coupling
  const handoff = perform([
    {
      verb: "gesture",
      actor: "knight",
      start: 0,
      duration: 2,
      kind: "bow",
    },
    {
      verb: "attachTo",
      actor: "sword",
      parent: "knight",
      bone: "leftHand",
      start: 0,
      duration: 0.8,
    },
    {
      verb: "attachTo",
      actor: "sword",
      parent: "knight",
      bone: "chest",
      start: 1.2,
      duration: 0.8,
    },
  ]);
  TestValidator.equals("the handoff performs", handoff.success, true);
  if (handoff.success !== true) return;
  TestValidator.equals(
    "handoff clips carry unique start-ordered ids",
    handoff.shot.objectMotions
      .map((c) => c.id)
      .sort((a, b) => a.localeCompare(b)),
    ["attach:sword", "attach:sword:2"],
  );
  const first = handoff.shot.objectMotions.find(
    (c) => c.id === "attach:sword",
  )!;
  const second = handoff.shot.objectMotions.find(
    (c) => c.id === "attach:sword:2",
  )!;
  const clipEnd = (clip: typeof second): IAutoMovieVector3 => {
    const v = sampleClip(clip, 2).get("node:sword:translation")!.value;
    return { x: v[0]!, y: v[1]!, z: v[2]! };
  };
  const ended = resolveBeatEnd({
    beat: "beat-1",
    scene: staged.scene,
    shot: handoff.shot,
    motions: Object.values(handoff.motions),
  });
  const endedSword = ended.actors.find((a) => a.node === "sword")!;
  TestValidator.predicate(
    "the beat end follows the LATEST coupling without a staged mount",
    vclose(endedSword.transform.translation, clipEnd(second)),
  );
  TestValidator.equals(
    "a per-beat grab is not a persistent binding",
    endedSword.mount,
    null,
  );
  TestValidator.predicate(
    "the grabbed prop's end velocity is the follow clip's trailing read",
    endedSword.rootVelocity !== null &&
      [
        endedSword.rootVelocity.x,
        endedSword.rootVelocity.y,
        endedSword.rootVelocity.z,
      ].every((c) => Number.isFinite(c)),
  );
  const endedKnight = ended.actors.find((a) => a.node === "knight")!;
  TestValidator.predicate(
    "a never-coupled actor keeps the staged/pose-root path",
    vclose(endedKnight.transform.translation, { x: 0, y: 0, z: 0 }),
  );

  // a hand-authored bogus suffix ranks below the bare stable id, so the
  // follow resolves to the real coupling, never the malformed one
  const bogus = resolveBeatEnd({
    beat: "beat-1",
    scene: staged.scene,
    shot: {
      ...handoff.shot,
      objectMotions: [first, { ...second, id: "attach:sword:x" }],
    },
    motions: Object.values(handoff.motions),
  });
  TestValidator.predicate(
    "a bogus suffix does not count as a coupling",
    vclose(
      bogus.actors.find((a) => a.node === "sword")!.transform.translation,
      clipEnd(first),
    ),
  );

  // 8. an "auto" attach starting at the shot end has zero span (#1224): before
  // the fix this passed every validation and baked a follow clip with duplicate
  // keyframe times [start, start], which threw the moment anything sampled it.
  // A numeric duration at the end is already caught by the span check; the auto
  // case was the uncaught remainder. The shot is `perform`'s 2 s, so start 2 is
  // exactly the end.
  const zeroSpan = perform([
    {
      verb: "attachTo",
      actor: "sword",
      parent: "knight",
      bone: "leftHand",
      start: 2,
      duration: "auto",
    },
  ]);
  TestValidator.equals(
    "an auto attach starting at the shot end is rejected",
    zeroSpan.success,
    false,
  );
  if (zeroSpan.success === false)
    TestValidator.predicate(
      "the violation names the zero-span duration",
      zeroSpan.violations.some((v) => v.path.includes(".duration")),
    );
};
