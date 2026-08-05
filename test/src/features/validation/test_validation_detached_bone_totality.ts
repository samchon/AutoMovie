import {
  detectBodyCollision,
  validateBalanceSupport,
  validateFootSkate,
  validateSelfIntersection,
} from "@automovie/engine";
import {
  IAutoMovieKeyframe,
  IAutoMoviePose,
  IAutoMovieSkeleton,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { hasViolation } from "../internal/predicates";

const restAt = (x: number, y: number, z: number): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

/**
 * A skeleton with a **detached** bone: `leftFoot` is declared, but its parent
 * `leftLowerLeg` is absent, so its chain never reaches the null-parent root
 * (`hips`). `skeleton.bones` membership sees `leftFoot`, yet `resolvePose`'s
 * root-anchored walk never visits it.
 */
const DETACHED_SKELETON: IAutoMovieSkeleton = {
  id: "detached",
  bones: [
    { bone: "hips", parent: null, rest: restAt(0, 1, 0), constraint: null },
    {
      bone: "leftFoot",
      parent: "leftLowerLeg",
      rest: restAt(0, -0.9, 0),
      constraint: null,
    },
  ],
};

const restPose: IAutoMoviePose = {
  skeleton: DETACHED_SKELETON.id,
  root: null,
  joints: [],
};
const key = (time: number): IAutoMovieKeyframe => ({
  time,
  pose: restPose,
  expression: null,
  easing: "linear",
  bezier: null,
});
const MOTION = {
  id: "motion-detached",
  skeleton: DETACHED_SKELETON.id,
  duration: 1,
  loop: false,
  keyframes: [key(0), key(1)],
};

/**
 * A physics validator's bone membership is checked against the DECLARED set
 * (`skeleton.bones`), but `resolvePose` returns only the FK-REACHABLE set: the
 * bones its root-anchored walk visits. A declared-but-detached bone slips the
 * gap: the declared check passes, yet the resolved lookup comes back empty, and
 * the old code asserted it non-null and crashed. A validator must be total:
 * malformed input becomes a violation, never a thrown exception (the #593
 * severity/ledger contract, the same totality #685/#688 restored for the
 * collision oracle).
 *
 * `validateFootSkate`, `validateBalanceSupport`, and the capsule validators
 * (`validateSelfIntersection`, `detectBodyCollision`, #1056) must all report
 * the detached bone as a `type` violation and never throw, while a normal
 * (fully-reachable) rig keeps validating exactly as before.
 */
export const test_validation_detached_bone_totality = (): void => {
  // footskate: a contact on the detached bone reports, does not crash.
  const foot = validateFootSkate({
    motion: MOTION,
    skeleton: DETACHED_SKELETON,
    contacts: [{ bone: "leftFoot", start: 0, end: 1 }],
  });
  TestValidator.predicate(
    "footskate: detached contact bone is a reachability violation, not a crash",
    hasViolation(foot, "type", "contacts[0].bone") &&
      foot.success === false &&
      foot.violations.some((v) => v.expected.includes("not reachable")),
  );

  // balance: a detached centerBone reports, does not crash.
  const center = validateBalanceSupport({
    motion: MOTION,
    skeleton: DETACHED_SKELETON,
    supports: [
      { centerBone: "leftFoot", supportBones: ["hips"], start: 0, end: 1 },
    ],
  });
  TestValidator.predicate(
    "balance: detached centerBone is a reachability violation, not a crash",
    hasViolation(center, "type", "supports[0].centerBone") &&
      center.success === false &&
      center.violations.some((v) => v.expected.includes("not reachable")),
  );

  // balance: a detached support bone reports, does not crash.
  const support = validateBalanceSupport({
    motion: MOTION,
    skeleton: DETACHED_SKELETON,
    supports: [
      { centerBone: "hips", supportBones: ["leftFoot"], start: 0, end: 1 },
    ],
  });
  TestValidator.predicate(
    "balance: detached support bone is a reachability violation, not a crash",
    hasViolation(support, "type", "supports[0].supportBones") &&
      support.success === false &&
      support.violations.some((v) => v.expected.includes("not reachable")),
  );

  // self-intersection: a capsule endpoint on the detached bone reports at the
  // endpoint's own path, does not crash (#1056).
  const capsule = validateSelfIntersection({
    motion: MOTION,
    skeleton: DETACHED_SKELETON,
    pairs: [
      {
        first: { from: "hips", to: "leftFoot", radius: 0.1 },
        second: { from: "leftFoot", to: "hips", radius: 0.1 },
      },
    ],
  });
  TestValidator.predicate(
    "self-intersection: detached capsule endpoint is a reachability violation, not a crash",
    hasViolation(capsule, "type", "pairs[0].first.to") &&
      hasViolation(capsule, "type", "pairs[0].second.from") &&
      capsule.success === false &&
      capsule.violations.some((v) => v.expected.includes("not reachable")),
  );

  // body collision: a detached endpoint on either actor reports, does not
  // crash, and sampling is skipped (#1056).
  const actor = (node: string) => ({
    node,
    skeleton: DETACHED_SKELETON,
    motion: MOTION,
    capsules: [{ from: "hips" as const, to: "leftFoot" as const, radius: 0.1 }],
    body: null,
  });
  const collision = detectBodyCollision({ a: actor("a"), b: actor("b") });
  TestValidator.predicate(
    "body collision: detached capsule endpoint is a reachability violation, not a crash",
    hasViolation(collision.validation, "type", "a.capsules[0].to") &&
      hasViolation(collision.validation, "type", "b.capsules[0].to") &&
      collision.validation.success === false &&
      collision.events.length === 0 &&
      collision.response === null,
  );

  // A bone entirely absent from the skeleton still reports "must exist", NOT
  // the reachability message: the two failures stay distinct.
  const absent = validateFootSkate({
    motion: MOTION,
    skeleton: DETACHED_SKELETON,
    contacts: [{ bone: "rightFoot", start: 0, end: 1 }],
  });
  TestValidator.predicate(
    "footskate: an absent bone reports must-exist, not unreachable",
    absent.success === false &&
      absent.violations.some((v) => v.expected.includes("must exist")) &&
      !absent.violations.some((v) => v.expected.includes("not reachable")),
  );

  // A fully-reachable rig validates with no bone-structure violations (the
  // reachability gate never fires on a well-formed skeleton).
  const reachableSkeleton: IAutoMovieSkeleton = {
    id: "reachable",
    bones: [
      { bone: "hips", parent: null, rest: restAt(0, 1, 0), constraint: null },
      {
        bone: "leftFoot",
        parent: "hips",
        rest: restAt(0, -0.9, 0),
        constraint: null,
      },
    ],
  };
  const wellFormed = validateFootSkate({
    motion: { ...MOTION, skeleton: reachableSkeleton.id },
    skeleton: reachableSkeleton,
    contacts: [{ bone: "leftFoot", start: 0, end: 1 }],
  });
  TestValidator.equals(
    "footskate: a reachable rig reports no bone-structure violation",
    wellFormed.success,
    true,
  );
  const wellFormedBalance = validateBalanceSupport({
    motion: { ...MOTION, skeleton: reachableSkeleton.id },
    skeleton: reachableSkeleton,
    supports: [
      { centerBone: "hips", supportBones: ["leftFoot"], start: 0, end: 1 },
    ],
  });
  TestValidator.equals(
    "balance: a reachable rig reports no bone-structure violation",
    wellFormedBalance.success,
    true,
  );
};
