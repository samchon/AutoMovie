import {
  IautomovieActionSynthesizer,
  performShot,
  sampleClip,
  stageScene,
} from "@automovie/engine";
import { IautomovieActionCall, IautomovieVector3 } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
  validSynthesizer,
} from "../internal/filmFixtures";
import { createSkeleton } from "../internal/fixtures";
import { vclose } from "../internal/predicates";

/** A launch/attach produces no actor pose ??those animate objects, not the rig. */
const synth: IautomovieActionSynthesizer = (action, actor) =>
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
 * gets a shot `objectMotion` that rides the parent's bone ??animated when the
 * parent moves ??and the prop, being no rig, gets no pose performance.
 *
 * Scenarios:
 *
 * 1. The knight gestures (the arm moves) with the sword attached to its
 *    `leftHand`: the sword gets one `objectMotion` that changes over the shot
 *    (it follows the swinging hand), and only the knight performs.
 * 2. An attachTo parent that is not a staged node ??an input violation.
 * 3. An attachTo parent with no rig to attach a bone of ??a violation.
 * 4. A bone that is not on the parent's skeleton ??a violation.
 */
export const test_film_perform_shot_attach = (): void => {
  const staged = stageScene(scriptOf(), stagingOf());
  if (staged.success !== true) throw new Error("staging must succeed");

  const perform = (draft: IautomovieActionCall[]) =>
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
    "two object motions ??the sword's and the shield's follows",
    ok.shot.objectMotions.map((c) => c.id).sort((a, b) => a.localeCompare(b)),
    ["attach:shield", "attach:sword"],
  );
  const follow = ok.shot.objectMotions.find((c) => c.id === "attach:sword")!;
  TestValidator.equals(
    "the follow drives the sword node",
    follow.tracks.map((t) => (t.channel.kind === "node" ? t.channel.node : "")),
    ["sword", "sword"],
  );
  const posAt = (t: number): IautomovieVector3 => {
    const v = sampleClip(follow, t).get("node:sword:translation")!.value;
    return { x: v[0]!, y: v[1]!, z: v[2]! };
  };
  TestValidator.predicate(
    "the sword rides the swinging hand (a moving follow)",
    !vclose(posAt(0), posAt(0.5), 1e-3),
  );
  TestValidator.equals(
    "the props are no rig ??only the knight performs",
    ok.shot.performances.map((p) => p.node),
    ["knight"],
  );

  // 2. the parent must be a staged node
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

  // 3. the parent must have a rig
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

  // 4. the bone must be on the parent's skeleton
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
};
