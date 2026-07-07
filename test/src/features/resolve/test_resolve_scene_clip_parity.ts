import {
  Matrix4,
  forgeCast,
  motionToClip,
  performShot,
  resolveFrame,
  resolvePose,
  sampleMotion,
  sceneToNodes,
  stageScene,
} from "@automovie/engine";
import { IAutoMovieClip, IAutoMovieModel } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { bakeTimes } from "../internal/clipParity";
import {
  forgeEntry,
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
  validSynthesizer,
} from "../internal/filmFixtures";
import { createModel, createSkeleton } from "../internal/fixtures";
import { qclose, vclose } from "../internal/predicates";

/**
 * The convergence proof of #594 S3: a real performed film shot plays back
 * IDENTICALLY through the general Clip path. The duel fixture runs the actual
 * pipeline (forge → stage → perform), each actor's compiled humanoid motion is
 * baked through `motionToClip` with its placement prefix, the tracks merge into
 * ONE clip over the ONE `sceneToNodes` graph, and at every bake-clock time each
 * actor's every bone world from `resolveFrame` equals the specialized path —
 * `placement ∘ resolvePose(sampleMotion(motion, t))`. The engine's execution
 * representation converges on Clip while `IAutoMovieMotion` stays the authoring
 * surface.
 *
 * Scenarios:
 *
 * 1. The merge precondition: every compiled motion fits the shot and at least one
 *    spans it exactly — a shorter actor's tracks end early and HOLD, the same
 *    clamp-hold boundary rule `sampleMotion` applies, so the merged clip is
 *    well-formed (track times ≤ clip duration).
 * 2. For every bake time and both actors, every bone's world position and rotation
 *    agree between the specialized and general paths (1e-6) — including the
 *    hold window where the shorter actor has ended (the hold semantics agree
 *    across both pipelines).
 * 3. The negative twin: reading knightA's bones through knightB's prefix does NOT
 *    match — the per-placement prefixes really keep the two actors' subtrees
 *    distinct (the knights stand 0.7 m apart, facing opposite ways).
 */
export const test_resolve_scene_clip_parity = (): void => {
  const script = makeScriptWrite();
  const forged = forgeCast(script, {
    type: "write",
    entries: [forgeEntry("knightB")],
  });
  if (forged.success !== true) throw new Error("forge must succeed");
  const staged = stageScene(script, makeStagingWrite());
  if (staged.success !== true) throw new Error("stage must succeed");
  const performed = performShot({
    script,
    staged,
    performance: makePerformanceWrite(),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  if (performed.success !== true) throw new Error("perform must succeed");

  const skeleton = createSkeleton();
  const models: Record<string, IAutoMovieModel> = {
    stickman: { ...createModel(skeleton), id: "stickman" },
    knightB: forged.models["knightB"]!,
  };
  const nodes = sceneToNodes({ scene: staged.scene, models });

  const actors = ["knightA", "knightB"] as const;
  TestValidator.predicate(
    "every motion fits the shot and one spans it (a shorter one holds)",
    actors.every(
      (node) => performed.motions[node]!.duration <= performed.shot.duration,
    ) &&
      actors.some(
        (node) => performed.motions[node]!.duration === performed.shot.duration,
      ),
  );

  const merged: IAutoMovieClip = {
    id: "duel",
    name: null,
    duration: performed.shot.duration,
    loop: false,
    tracks: actors.flatMap(
      (node) =>
        motionToClip({
          motion: performed.motions[node]!,
          skeleton,
          nodePrefix: `${node}/`,
        }).clip.tracks,
    ),
  };

  const times = bakeTimes(performed.shot.duration);
  let parity = true;
  let crossed = false;
  for (const time of times) {
    const world = resolveFrame({
      nodes,
      clip: merged,
      limits: [],
      seconds: time,
    }).world;
    for (const node of actors) {
      const placement = staged.scene.nodes.find(
        (n) => n.id === node,
      )!.transform;
      const placementMatrix = Matrix4.compose(
        placement.translation,
        placement.rotation,
        placement.scale,
      );
      const expected = resolvePose(
        sampleMotion(performed.motions[node]!, time).pose,
        skeleton,
      );
      for (const bone of expected) {
        const matrix = world.get(`${node}/${bone.bone}`);
        if (matrix === undefined) {
          parity = false;
          break;
        }
        const specialized = Matrix4.multiply(
          placementMatrix,
          Matrix4.compose(bone.worldPosition, bone.worldRotation, {
            x: 1,
            y: 1,
            z: 1,
          }),
        );
        if (
          !vclose(Matrix4.position(matrix), Matrix4.position(specialized)) ||
          !qclose(
            Matrix4.decompose(matrix).rotation,
            Matrix4.decompose(specialized).rotation,
          )
        ) {
          parity = false;
          break;
        }
        // the cross-actor twin: knightA's specialized world must NOT match
        // knightB's lowered node (they stand apart, facing opposite ways).
        if (node === "knightA" && bone.bone === "hips") {
          const other = world.get(`knightB/${bone.bone}`)!;
          if (!vclose(Matrix4.position(other), Matrix4.position(specialized)))
            crossed = true;
        }
      }
      if (!parity) break;
    }
    if (!parity) break;
  }
  TestValidator.predicate(
    "every bone of both actors agrees between the two paths at every time",
    parity,
  );
  TestValidator.predicate(
    "prefixes keep the actors' subtrees distinct (cross-read differs)",
    crossed,
  );
};
