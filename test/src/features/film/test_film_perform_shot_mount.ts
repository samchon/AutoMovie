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
  IAutoMovieClip,
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
  keyframe,
  makeMotion,
  makePose,
} from "../internal/fixtures";
import { vclose } from "../internal/predicates";

/** The horse walks +x by 2 m over the 2 s shot (root translation only). */
const horseWalk: IAutoMovieMotion = makeMotion(
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

/** The horse animates its own walk; every other actor uses the shared clip. */
const synth: IAutoMovieActionSynthesizer = (action, actor) =>
  actor === "horse" ? horseWalk : validSynthesizer(action, actor);

const scriptOf = () =>
  makeScriptWrite({
    cast: [
      { node: "horse", character: "the steed", modelRef: "stickman" },
      { node: "rider", character: "the knight", modelRef: "stickman" },
    ],
    beats: [
      {
        id: "beat-1",
        name: "the ride",
        summary: "the knight rides the steed",
        durationHint: 2,
      },
    ],
  });

/**
 * The rider is placed far away and airborne (5, 5, 5) ON PURPOSE: a coordinate
 * it must never end at. Its `attach` mounts it to the horse's `spine`, so the
 * mount, not the staged placement, owns its world root.
 */
const stagingOf = () =>
  makeStagingWrite({
    scene: { id: "scene-ride", name: "the ride" },
    actors: [
      { node: "horse", position: { x: 0, y: 0, z: 0 }, facingDeg: 0 },
      {
        node: "rider",
        position: { x: 5, y: 5, z: 5 },
        facingDeg: 0,
        attach: { parent: "horse", bone: "spine" },
      },
    ],
    cameras: [
      {
        node: "cam",
        position: { x: 3, y: 2, z: 3 },
        lookAt: { kind: "node", node: "horse" },
        fovDeg: 45,
      },
    ],
  });

const riderPosAt = (clip: IAutoMovieClip, t: number): IAutoMovieVector3 => {
  const v = sampleClip(clip, t).get("node:rider:translation")!.value;
  return { x: v[0]!, y: v[1]!, z: v[2]! };
};

/**
 * A staged mount (#674) auto-descends into the rider's per-frame follow at
 * perform time (no per-beat `attachTo`), so the rider rides the whole film.
 *
 * The horse walks +x; the rider is mounted on its `spine` but staged far away
 * and airborne at (5, 5, 5), a coordinate the mount must override.
 *
 * Scenarios:
 *
 * 1. Perform bakes one `attach:rider` objectMotion (reusing compileAttach), and it
 *    MOVES with the horse: the rider is never left at its staged (5,5,5).
 *    Exact oracle: the follow equals resolveAttachment on the compiled horse
 *    motion composed with the horse's staged transform.
 * 2. A mount emits no grab/attach/detach/release events (persistent scene state,
 *    not a per-shot pickup).
 * 3. `resolveBeatEnd` derives the rider's end transform/velocity from that same
 *    baked clip: it sits at the saddle (following the horse), not at (5,5,5),
 *    with the horse's trailing velocity, and carries the mount binding.
 * 4. Continuity: a SECOND beat with no `attachTo` still bakes the follow: the
 *    persistence #631's beat-end carry is meant to enable.
 * 5. An explicit `attachTo` for the rider this beat overrides its mount (one
 *    follow clip, the attachTo one).
 * 6. A mountless staging bakes no follow clip (byte-compatible with pre-#674).
 * 7. A mount onto a rig-less parent, and onto an absent bone, each fail.
 */
export const test_film_perform_shot_mount = (): void => {
  const staged = stageScene(scriptOf(), stagingOf());
  if (staged.success !== true) throw new Error("staging must succeed");
  TestValidator.equals("staging carries the rider mount", staged.mounts, [
    { node: "rider", binding: { parent: "horse", bone: "spine" } },
  ]);

  const perform = (draft: IAutoMovieActionCall[]) =>
    performShot({
      script: scriptOf(),
      staged,
      performance: makePerformanceWrite({
        beat: "beat-1",
        draft,
        revise: { review: "the ride reads.", final: null },
        duration: 2,
      }),
      synthesize: synth,
      skeleton: () => createSkeleton(),
    });

  // 1. the rider follows the walking horse, never left at its staged (5,5,5).
  const ok = perform([
    { verb: "gesture", actor: "horse", start: 0, duration: 2, kind: "bow" },
  ]);
  TestValidator.equals("the mount performs", ok.success, true);
  if (ok.success !== true) return;

  const follow = ok.shot.objectMotions.find((c) => c.id === "attach:rider");
  TestValidator.predicate("a rider follow clip is baked", follow !== undefined);
  TestValidator.equals(
    "the follow drives the rider node's TRS",
    follow!.tracks.map((t) =>
      t.channel.kind === "node" ? t.channel.node : "",
    ),
    ["rider", "rider"],
  );
  const start = riderPosAt(follow!, 0);
  const end = riderPosAt(follow!, 2);
  TestValidator.predicate(
    "the rider rides the moving horse (a live follow)",
    !vclose(start, end, 1e-3),
  );
  TestValidator.predicate(
    "the rider is never at its staged (5,5,5)",
    !vclose(end, { x: 5, y: 5, z: 5 }, 1e-3),
  );

  // exact oracle: the follow is resolveAttachment on the COMPILED horse motion
  // (what compileAttach sampled) composed with the horse's staged transform.
  const horse = staged.scene.nodes.find((n) => n.id === "horse")!;
  const horseMotion = ok.motions["horse"]!;
  const localAtEnd = resolveAttachment(
    sampleMotion(horseMotion, 2).pose,
    createSkeleton(),
    { parentBone: "spine", offset: IDENTITY_TRANSFORM },
    HUMANOID_JOINT_AXES,
  );
  const expectedEnd = Vector3.add(
    horse.transform.translation,
    Quaternion.rotateVector(horse.transform.rotation, localAtEnd.translation),
  );
  TestValidator.predicate(
    "the baked follow matches the attachment FK exactly",
    vclose(end, expectedEnd, 1e-9),
  );

  // 2. a persistent mount is not a per-shot pickup: no handoff events.
  TestValidator.equals(
    "a mount emits no attach/detach events",
    (ok.shot.events ?? []).filter(
      (e) =>
        e.kind === "grab" ||
        e.kind === "attach" ||
        e.kind === "detach" ||
        e.kind === "release",
    ),
    [],
  );

  // 3. beat-end reads the rider's world from the same baked clip.
  const beatEnd = resolveBeatEnd({
    beat: "beat-1",
    scene: staged.scene,
    shot: ok.shot,
    motions: Object.entries(ok.motions).map(([, m]) => m),
    mounts: staged.mounts,
  });
  const riderEnd = beatEnd.actors.find((a) => a.node === "rider")!;
  TestValidator.predicate(
    "the rider's beat-end sits at the saddle, following the horse",
    vclose(riderEnd.transform.translation, expectedEnd, 1e-9),
  );
  TestValidator.predicate(
    "the rider's beat-end is NOT its airborne staged coordinate",
    !vclose(riderEnd.transform.translation, { x: 5, y: 5, z: 5 }, 1e-3),
  );
  TestValidator.predicate(
    "the rider inherits the horse's trailing velocity (nonzero +x)",
    riderEnd.rootVelocity!.x > 0.5 &&
      Math.abs(riderEnd.rootVelocity!.y) < 1e-6 &&
      Math.abs(riderEnd.rootVelocity!.z) < 1e-6,
  );
  TestValidator.equals("the mount binding is carried", riderEnd.mount, {
    parent: "horse",
    bone: "spine",
  });

  // 3b. a mounted rider whose OWN performance starts exactly at shot end has a
  // local time of 0: its mount-velocity window is empty, so zero (not NaN),
  // while its transform still reads the saddle at the clip's start.
  const endStart = resolveBeatEnd({
    beat: "beat-1",
    scene: staged.scene,
    shot: {
      ...ok.shot,
      performances: [
        ...ok.shot.performances,
        { node: "rider", motion: "horse-walk", startOffset: 2 },
      ],
    },
    motions: [
      ...Object.entries(ok.motions).map(([, m]) => m),
      { ...horseWalk, id: "horse-walk" },
    ],
    mounts: staged.mounts,
  });
  const riderAtStart = endStart.actors.find((a) => a.node === "rider")!;
  TestValidator.predicate(
    "a rider mounted at local time 0 has an empty velocity window (zero)",
    vclose(riderAtStart.rootVelocity!, { x: 0, y: 0, z: 0 }),
  );

  // 3c. a mount whose parent clip is authored in clinical space threads the
  // parent's restFrames into the follow FK (the same path attachTo uses).
  const clinical = performShot({
    script: scriptOf(),
    staged,
    performance: makePerformanceWrite({
      beat: "beat-1",
      draft: [
        { verb: "gesture", actor: "horse", start: 0, duration: 2, kind: "bow" },
      ],
      revise: { review: "the clinical-space ride.", final: null },
      duration: 2,
    }),
    synthesize: synth,
    skeleton: () => createSkeleton(),
    restFrames: (node) => (node === "horse" ? HUMANOID_REST_FRAME : undefined),
  });
  TestValidator.equals("the clinical mount performs", clinical.success, true);
  if (clinical.success === true) {
    const clinicalFollow = clinical.shot.objectMotions.find(
      (c) => c.id === "attach:rider",
    )!;
    const clinicalEnd = sampleClip(clinicalFollow, 2).get(
      "node:rider:translation",
    )!.value;
    const localClinical = resolveAttachment(
      sampleMotion(clinical.motions["horse"]!, 2).pose,
      createSkeleton(),
      { parentBone: "spine", offset: IDENTITY_TRANSFORM },
      HUMANOID_JOINT_AXES,
      HUMANOID_REST_FRAME,
    );
    const expectedClinical = Vector3.add(
      horse.transform.translation,
      Quaternion.rotateVector(
        horse.transform.rotation,
        localClinical.translation,
      ),
    );
    TestValidator.predicate(
      "the mount follow threads the parent's restFrames into its FK",
      vclose(
        { x: clinicalEnd[0]!, y: clinicalEnd[1]!, z: clinicalEnd[2]! },
        expectedClinical,
        1e-9,
      ),
    );
  }

  // 4. continuity: a second beat with NO attachTo still bakes the follow.
  const beatTwo = performShot({
    script: scriptOf(),
    staged,
    performance: makePerformanceWrite({
      beat: "beat-1",
      draft: [
        { verb: "gesture", actor: "horse", start: 0, duration: 2, kind: "bow" },
      ],
      revise: { review: "the ride continues.", final: null },
      duration: 2,
    }),
    synthesize: synth,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals("the next beat performs", beatTwo.success, true);
  if (beatTwo.success === true)
    TestValidator.predicate(
      "the mount persists into the next beat without re-declaration",
      beatTwo.shot.objectMotions.some((c) => c.id === "attach:rider"),
    );

  // 5. an explicit attachTo for the rider this beat overrides its mount.
  const overridden = perform([
    { verb: "gesture", actor: "horse", start: 0, duration: 2, kind: "bow" },
    {
      verb: "attachTo",
      actor: "rider",
      parent: "horse",
      bone: "chest",
      start: 0,
      duration: 2,
    },
  ]);
  TestValidator.equals("the override performs", overridden.success, true);
  if (overridden.success === true)
    TestValidator.equals(
      "one rider follow clip, the explicit attachTo, not a second from the mount",
      overridden.shot.objectMotions.filter((c) => c.id === "attach:rider")
        .length,
      1,
    );

  // 6. a mountless staging bakes no follow clip.
  const bare = stageScene(
    scriptOf(),
    makeStagingWrite({
      scene: { id: "scene-ride", name: "the ride" },
      actors: [
        { node: "horse", position: { x: 0, y: 0, z: 0 }, facingDeg: 0 },
        { node: "rider", position: { x: 1, y: 0, z: 0 }, facingDeg: 0 },
      ],
      cameras: [
        {
          node: "cam",
          position: { x: 3, y: 2, z: 3 },
          lookAt: { kind: "node", node: "horse" },
          fovDeg: 45,
        },
      ],
    }),
  );
  if (bare.success !== true) throw new Error("bare staging must succeed");
  const bareShot = performShot({
    script: scriptOf(),
    staged: bare,
    performance: makePerformanceWrite({
      beat: "beat-1",
      draft: [
        { verb: "gesture", actor: "horse", start: 0, duration: 2, kind: "bow" },
      ],
      revise: { review: "no mount here.", final: null },
      duration: 2,
    }),
    synthesize: synth,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals("the mountless shot performs", bareShot.success, true);
  if (bareShot.success === true)
    TestValidator.equals(
      "no mount, no follow clip (byte-compatible with pre-#674)",
      bareShot.shot.objectMotions,
      [],
    );

  // 7. a mount onto a rig-less parent, and onto an absent bone, each fail.
  const riglessParent = performShot({
    script: scriptOf(),
    staged,
    performance: makePerformanceWrite({
      beat: "beat-1",
      draft: [
        { verb: "gesture", actor: "horse", start: 0, duration: 2, kind: "bow" },
      ],
      revise: { review: "the horse has no rig.", final: null },
      duration: 2,
    }),
    synthesize: synth,
    // horse has no rig now: the mount cannot ride a bone of it.
    skeleton: (node) => (node === "horse" ? null : createSkeleton()),
  });
  TestValidator.equals(
    "a rig-less mount parent fails",
    riglessParent.success,
    false,
  );
  if (riglessParent.success === false)
    TestValidator.predicate(
      "the violation names the mounts",
      riglessParent.violations.some((v) => v.path === "$staged.mounts"),
    );

  const badBone = stageScene(
    scriptOf(),
    makeStagingWrite({
      scene: { id: "scene-ride", name: "the ride" },
      actors: [
        { node: "horse", position: { x: 0, y: 0, z: 0 }, facingDeg: 0 },
        {
          node: "rider",
          position: { x: 5, y: 5, z: 5 },
          facingDeg: 0,
          attach: { parent: "horse", bone: "rightHand" },
        },
      ],
      cameras: [
        {
          node: "cam",
          position: { x: 3, y: 2, z: 3 },
          lookAt: { kind: "node", node: "horse" },
          fovDeg: 45,
        },
      ],
    }),
  );
  if (badBone.success !== true) throw new Error("badBone staging must succeed");
  const missingBone = performShot({
    script: scriptOf(),
    staged: badBone,
    performance: makePerformanceWrite({
      beat: "beat-1",
      draft: [
        { verb: "gesture", actor: "horse", start: 0, duration: 2, kind: "bow" },
      ],
      revise: { review: "the saddle bone is missing.", final: null },
      duration: 2,
    }),
    synthesize: synth,
    // createSkeleton has no rightHand: the saddle bone is absent.
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals(
    "an absent mount bone fails",
    missingBone.success,
    false,
  );
  if (missingBone.success === false)
    TestValidator.predicate(
      "the violation names the bone via the mounts path",
      missingBone.violations.some(
        (v) => v.path === "$staged.mounts" && `${v.value}` === "rightHand",
      ),
    );
};
