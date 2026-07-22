import {
  IAutoMovieActionSynthesizer,
  performShot,
  stageScene,
} from "@automovie/engine";
import {
  IAutoMovieActionCall,
  IAutoMovieCameraAction,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
  validSynthesizer,
} from "../internal/filmFixtures";
import {
  createSkeleton,
  joint,
  keyframe,
  makeMotion,
  makePose,
} from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

const locomote: IAutoMovieActionCall = {
  verb: "locomote",
  actor: "knightA",
  start: 0,
  duration: 1,
  gait: "walk",
  to: { kind: "point", point: { x: 0, y: 0, z: 0.25 } },
};

const lookAt = (start: number): IAutoMovieActionCall => ({
  verb: "lookAt",
  actor: "knightA",
  start,
  duration: 1,
  to: { kind: "node", node: "knightB" },
});

const emote = (start: number): IAutoMovieActionCall => ({
  verb: "emote",
  actor: "knightA",
  start,
  duration: 1,
  preset: "neutral",
  intensity: 0.5,
});

const fullBody = (start: number): IAutoMovieActionCall => ({
  verb: "gesture",
  kind: "jump",
  region: "fullBody",
  actor: "knightA",
  start,
  duration: 1,
});

const frame: IAutoMovieCameraAction = {
  verb: "frame",
  actor: "cam-main",
  start: 0,
  duration: "auto",
  framing: "medium",
  move: "static",
  on: { kind: "node", node: "knightA" },
};

/**
 * Overlap gates compare synthesized channels after region masking. Broad
 * `fullBody`/partial and same-region labels are not conflicts by themselves;
 * sharing a root, exact bone, or expression is. Synthesis is cached across the
 * gate and authoritative compile so this inspection does not run user content
 * twice.
 */
export const test_film_perform_shot_region_gates = (): void => {
  const staged = stageScene(makeScriptWrite(), makeStagingWrite());
  if (staged.success !== true) throw new Error("staging must succeed");

  // Both clips carry the same arm but return it to rest at their boundary, so
  // overlap is the only fault under test; adjacent placement remains smooth.
  const armSynth: IAutoMovieActionSynthesizer = () =>
    makeMotion(
      [
        keyframe(0, makePose([joint("leftUpperArm", { flexion: 0 })])),
        keyframe(0.5, makePose([joint("leftUpperArm", { flexion: 20 })])),
        keyframe(1, makePose([joint("leftUpperArm", { flexion: 0 })])),
      ],
      1,
    );
  const overlapping = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [locomote, fullBody(0.5), frame],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: armSynth,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals(
    "overlapping actions sharing an arm fail",
    overlapping.success,
    false,
  );
  TestValidator.predicate(
    "shared-arm overlap is reported on the later action start",
    overlapping.success === false &&
      hasViolation(overlapping, "range", "$input.draft[1].start"),
  );

  const adjacent = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [locomote, fullBody(1), frame],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: armSynth,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals(
    "adjacent shared-arm actions pass",
    adjacent.success,
    true,
  );

  const headSynth: IAutoMovieActionSynthesizer = () =>
    makeMotion(
      [
        keyframe(0, makePose([joint("head", { flexion: 0 })])),
        keyframe(1, makePose([joint("head", { flexion: 20 })])),
      ],
      1,
    );
  const sameRegion = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      // Three overlaps make the first action participate in two comparisons,
      // proving content inspection reuses its carried-channel cache.
      draft: [lookAt(0), lookAt(0.25), lookAt(0.5), frame],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: headSynth,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals(
    "overlapping same-region actions fail",
    sameRegion.success,
    false,
  );
  TestValidator.predicate(
    "same-region overlap is reported on the later action start",
    sameRegion.success === false &&
      hasViolation(sameRegion, "range", "$input.draft[1].start"),
  );

  const rootSynth: IAutoMovieActionSynthesizer = () =>
    makeMotion(
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
          1,
          makePose([], {
            translation: { x: 0, y: 0, z: 1 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            scale: { x: 1, y: 1, z: 1 },
          }),
        ),
      ],
      1,
    );
  const sharedRoot = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [fullBody(0), fullBody(0.5), frame],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: rootSynth,
    skeleton: () => createSkeleton(),
  });
  TestValidator.predicate(
    "two overlapping root motions conflict on root",
    sharedRoot.success === false &&
      sharedRoot.violations.some(
        (violation) =>
          violation.path === "$input.draft[1].start" &&
          violation.expected.includes("root"),
      ),
  );

  const expressionSynth: IAutoMovieActionSynthesizer = () =>
    makeMotion(
      [
        keyframe(0, makePose([]), "linear", {
          preset: "happy",
          intensity: 0.5,
          blendshapes: null,
        }),
        keyframe(1, makePose([]), "linear", {
          preset: "happy",
          intensity: 0.5,
          blendshapes: null,
        }),
      ],
      1,
    );
  const sharedExpression = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [emote(0), emote(0.5), frame],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: expressionSynth,
    skeleton: () => createSkeleton(),
  });
  TestValidator.predicate(
    "two overlapping face clips conflict on expression",
    sharedExpression.success === false &&
      sharedExpression.violations.some(
        (violation) =>
          violation.path === "$input.draft[1].start" &&
          violation.expected.includes("expression"),
      ),
  );

  let synthesisCalls = 0;
  const countedSynth: IAutoMovieActionSynthesizer = (action, actor) => {
    ++synthesisCalls;
    return validSynthesizer(action, actor);
  };
  const layeredPartials = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [lookAt(0), emote(0.25), frame],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: countedSynth,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals(
    "overlapping disjoint partial regions pass",
    layeredPartials.success,
    true,
  );
  TestValidator.equals(
    "overlap inspection and compilation synthesize each actor action once",
    synthesisCalls,
    2,
  );

  // The fixture's fullBody clip authors an arm only, so a head action is truly
  // disjoint despite the broad mask. A fullBody clip that actually authors the
  // head conflicts, as the headSynth twin proves.
  const smileWhileJumping = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [fullBody(0), emote(0.25), frame],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals(
    "an emote overlapping a fullBody gesture passes",
    smileWhileJumping.success,
    true,
  );
  const lookWhileJumping = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [fullBody(0), lookAt(0.25), frame],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.predicate(
    "a content-disjoint head action may overlap a fullBody mask",
    lookWhileJumping.success === true,
  );
  const sharedHead = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [fullBody(0), lookAt(0.25), frame],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: headSynth,
    skeleton: () => createSkeleton(),
  });
  TestValidator.predicate(
    "a fullBody clip and head action sharing head still gate",
    sharedHead.success === false &&
      hasViolation(sharedHead, "range", "$input.draft[1].start"),
  );
};
