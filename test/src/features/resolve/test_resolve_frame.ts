import { resolveFrame } from "@automovie/engine";
import {
  IAutoMovieChannel,
  IAutoMovieChannelLimit,
  IAutoMovieClip,
  IAutoMovieDrivenDriver,
  IAutoMovieNode,
  IAutoMovieTrack,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose, throwsError } from "../internal/predicates";

const IDENTITY: IAutoMovieTransform = {
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
};

const node = (id: string): IAutoMovieNode => ({
  id,
  name: null,
  parent: null,
  kind: "group",
  transform: IDENTITY,
  mesh: null,
  camera: null,
  light: null,
  skin: null,
});

const nodeChannel = (
  id: string,
  path: "translation" | "rotation" | "scale" | "weights",
): IAutoMovieChannel => ({ kind: "node", node: id, path });

const track = (
  channel: IAutoMovieChannel,
  times: number[],
  values: number[],
): IAutoMovieTrack => ({ channel, times, values, interpolation: "linear" });

const tx = (m: number[]): number => m[12]!;

/**
 * The per-frame resolver end to end: SAMPLE → CONSTRAIN → COMPOSE, plus the
 * weights side-channel and the rest-pose (null clip) path.
 *
 * The scene has five nodes — one animating translation+rotation, one rotation
 * only, one scale only, one morph weights, and one static — exercising every
 * combination of present/absent TRS channels when folding samples into
 * overrides (in particular a rotation-only node, where the translation channel
 * is absent so the rotation channel is the one that triggers the override).
 *
 * Scenarios:
 *
 * 1. A null clip resolves the rest pose: every node sits at its rest transform, no
 *    weights and no violations are produced.
 * 2. With the clip, the translation+rotation node animates (translation and
 *    rotation channels present, scale absent → kept from rest), the scale node
 *    animates scale only (translation/rotation absent → kept from rest), and
 *    the static node (no channels) keeps its rest transform entirely.
 * 3. A channel limit on the translation channel clamps the sampled overshoot
 *    (x=100 → 50) and reports exactly one violation tagged with that channel;
 *    the clamped value flows through to the composed world matrix.
 * 4. A limit on a channel the clip does not animate is skipped (no sample to
 *    clamp), producing no violation.
 * 5. The morph-weights channel populates the weights map for that node only; the
 *    static and TRS nodes never appear in it.
 */
export const test_resolve_frame = (): void => {
  const nodes = [
    node("trs"),
    node("rot"),
    node("scl"),
    node("morph"),
    node("static"),
  ];
  const clip: IAutoMovieClip = {
    id: "c",
    name: null,
    duration: 1,
    loop: false,
    tracks: [
      track(nodeChannel("trs", "translation"), [0, 1], [0, 0, 0, 100, 0, 0]),
      track(nodeChannel("trs", "rotation"), [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]),
      track(nodeChannel("rot", "rotation"), [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]),
      track(nodeChannel("scl", "scale"), [0, 1], [1, 1, 1, 2, 2, 2]),
      track(nodeChannel("morph", "weights"), [0, 1], [0, 1]),
    ],
  };
  const limits: IAutoMovieChannelLimit[] = [
    {
      channel: nodeChannel("trs", "translation"),
      min: null,
      max: [50, null, null],
    },
    // a limit on a channel the clip never animates → skipped
    {
      channel: nodeChannel("ghost", "translation"),
      min: [0, 0, 0],
      max: null,
    },
  ];

  // 1. null clip → rest pose
  const rest = resolveFrame({ nodes, clip: null, limits, seconds: 1 });
  TestValidator.predicate(
    "null clip leaves node at rest",
    nclose(tx(rest.world.get("trs")!), 0),
  );
  TestValidator.equals("null clip: no weights", rest.weights.size, 0);
  TestValidator.equals("null clip: no violations", rest.violations.length, 0);

  // 2-5. resolve the animated frame
  const out = resolveFrame({ nodes, clip, limits, seconds: 1 });

  // 3. translation clamped to 50 and surfaced as one violation
  TestValidator.predicate(
    "translation clamped into the world matrix",
    nclose(tx(out.world.get("trs")!), 50),
  );
  TestValidator.equals(
    "one violation, tagged with the channel",
    out.violations,
    [
      {
        channel: "node:trs:translation",
        component: 0,
        bound: "max",
        limit: 50,
        actual: 100,
      },
    ],
  );

  // 2. scale-only node animates scale, keeps rest translation/rotation
  TestValidator.predicate(
    "scale node scaled to 2 on the diagonal",
    nclose(out.world.get("scl")![0]!, 2),
  );
  // rotation-only node animates rotation, keeps rest translation
  TestValidator.predicate(
    "rotation-only node keeps rest translation",
    nclose(tx(out.world.get("rot")!), 0),
  );
  // static node keeps rest transform
  TestValidator.predicate(
    "static node stays at rest",
    nclose(tx(out.world.get("static")!), 0),
  );

  // 5. weights map carries the morph node only
  TestValidator.equals("morph weights captured", out.weights.get("morph"), [1]);
  TestValidator.equals(
    "trs node not in weights",
    out.weights.has("trs"),
    false,
  );
  TestValidator.equals(
    "static node not in weights",
    out.weights.has("static"),
    false,
  );

  const ghostClip: IAutoMovieClip = {
    ...clip,
    tracks: [
      track(nodeChannel("ghost", "translation"), [0, 1], [0, 0, 0, 1, 0, 0]),
    ],
  };
  TestValidator.predicate(
    "clip channel rejects missing resolve node",
    throwsError(
      () => resolveFrame({ nodes, clip: ghostClip, limits: [], seconds: 0 }),
      ['sampled channel "node:ghost:translation"', 'missing node "ghost"'],
    ),
  );

  // a driven output onto a node channel rejects as NON-SCALAR before the
  // missing-node check can even see it (#1055) — the ghost-node validator
  // keeps its own pin through the clip-track path above
  const ghostOutput: IAutoMovieDrivenDriver = {
    type: "driven",
    source: { kind: "pointer", pointer: "/input", valueType: "scalar" },
    output: nodeChannel("ghost", "translation"),
    inRange: [0, 1],
    outRange: [0, 1],
    clamp: false,
  };
  TestValidator.predicate(
    "driver output rejects a node channel as non-scalar",
    throwsError(
      () =>
        resolveFrame({
          nodes,
          clip: null,
          limits: [],
          drivers: [ghostOutput],
          seconds: 0,
        }),
      ["driven driver output", "scalar", 'node "ghost"'],
    ),
  );

  const pointerOutput: IAutoMovieDrivenDriver = {
    ...ghostOutput,
    output: { kind: "pointer", pointer: "/scratch", valueType: "scalar" },
  };
  const pointerOut = resolveFrame({
    nodes,
    clip: null,
    limits: [],
    drivers: [pointerOutput],
    seconds: 0,
  });
  TestValidator.equals(
    "pointer driver output does not require a scene node",
    pointerOut.violations.length,
    0,
  );
};
