import { IAutoMovieBeatEndState, IAutoMovieShot } from "@automovie/interface";
import {
  AutoMovieApplication,
  IAutoMovieMcpWritableSlate,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { makeScriptWrite, makeStagingWrite } from "../internal/filmFixtures";
import { IDENTITY_TRANSFORM } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

const app = new AutoMovieApplication();
const scriptWrite = makeScriptWrite();
const staged = app.stage({
  script: scriptWrite,
  staging: makeStagingWrite(),
}).staged;
if (staged.success !== true) throw new Error("staging fixture must succeed");

/** The staged scene plus one AMBIENT node: a windmill spinning on its own. */
const scene = {
  ...staged.scene,
  nodes: [
    ...staged.scene.nodes,
    {
      id: "windmill",
      model: "windmill-model",
      transform: IDENTITY_TRANSFORM,
      motion: "spin",
      pose: null,
    },
  ],
};

const shot: IAutoMovieShot = {
  id: "shot:beat-1",
  name: null,
  scene: scene.id,
  camera: "cam-main",
  cameraMotion: null,
  performances: [],
  objectMotions: [],
  duration: 1,
};

const slate: IAutoMovieMcpWritableSlate = {
  script: {
    logline: scriptWrite.logline,
    theme: scriptWrite.theme,
    cast: scriptWrite.cast,
    beats: scriptWrite.beats,
  },
  scene,
  shots: [shot],
  beatEnds: [],
  notes: [],
  film: null,
};

const endState = (motion: string | null): IAutoMovieBeatEndState => ({
  beat: "beat-1",
  shot: shot.id,
  actors: [
    {
      node: "windmill",
      transform: IDENTITY_TRANSFORM,
      facing: { x: 0, y: 0, z: 1 },
      pose: null,
      motion,
      localTime: 1,
      gaitPhase: null,
      rootVelocity: null,
      footPlants: null,
      mount: null,
    },
  ],
});

/**
 * The engine derives a non-performed actor's end motion from its scene node's
 * AMBIENT motion (`resolveBeatEnd`'s `endActorOf`: `performed === undefined ?
 * node.motion : performance.motion`), so `commitBeatEnd` must accept what
 * `getShotEndState` derives for ambient nodes (#1094). The gate used to check
 * only `performances[].motion`, dead-ending the advertised derive → commit
 * round trip for every scene using ambient motions.
 *
 * Scenarios (shot with NO performances; windmill node carries `motion:
 * "spin"`):
 *
 * 1. A beat end whose actor motion equals the scene node's ambient motion commits.
 * 2. Negative twin: a motion in NEITHER the performances nor the actor's scene
 *    node ("phantom") is still refused at the actor's motion path — the gate
 *    widened by exactly one source, it did not open.
 * 3. The ambient motion on a DIFFERENT node's actor entry does not qualify: "spin"
 *    committed against a staged actor node (not the windmill) is refused — the
 *    exemption is per-node, mirroring `endActorOf`.
 */
export const test_mcp_beat_end_ambient_motion = (): void => {
  // 1. the engine-derived ambient motion commits
  const ambient = app.commitBeatEnd({ slate, beatEnd: endState("spin") });
  TestValidator.equals("ambient motion commits", ambient.committed, true);
  TestValidator.equals(
    "the committed beat end carries the ambient motion",
    ambient.slate!.beatEnds[0]!.actors[0]!.motion,
    "spin",
  );

  // 2. negative twin: a motion from neither source is still refused
  const phantom = app.commitBeatEnd({ slate, beatEnd: endState("phantom") });
  TestValidator.equals("phantom motion refused", phantom.committed, false);
  TestValidator.predicate(
    "phantom motion located at the actor's motion",
    hasViolation(phantom.validation, "type", "actors[0].motion"),
  );

  // 3. the exemption is per-node: another node cannot borrow the ambient id
  const stagedNode = staged.scene.nodes[0]!.id;
  const borrowed = app.commitBeatEnd({
    slate,
    beatEnd: {
      ...endState(null),
      actors: [{ ...endState("spin").actors[0]!, node: stagedNode }],
    },
  });
  TestValidator.equals(
    "another node cannot borrow the ambient motion",
    borrowed.committed,
    false,
  );
  TestValidator.predicate(
    "the borrowed motion is located at the actor's motion",
    hasViolation(borrowed.validation, "type", "actors[0].motion"),
  );
};
