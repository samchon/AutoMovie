import {
  IAutoMovieChannel,
  IAutoMovieClip,
  IAutoMovieConstraintViolation,
  IAutoMoviePropSpec,
  IAutoMovieScene,
} from "@automovie/interface";

import { IAutoMovieProfileApplication } from "../resolve/bindProfile";
import { channelKey } from "../resolve/channel";
import { resolveFrame } from "../resolve/resolveFrame";
import { placementNodePrefix, sceneToNodes } from "../resolve/sceneToNodes";
import { pushViolation } from "../validation/artifactShape";
import {
  IAutoMovieNodeChannel,
  NODE_CHANNEL_PATHS,
} from "../validation/clipTrackShape";
import {
  IAutoMovieClipChannelGate,
  validateClipArtifact,
  validateHonorableChannel,
} from "../validation/validateShotArtifact";
import { ViolationCollector } from "../validation/violation";
import { forgeProp } from "./forgeProp";

/** What one shot's authored object clips are checked against. */
export interface IAutoMovieObjectMotionGate {
  /** The staged scene, for the placements a clip may address. */
  scene: IAutoMovieScene;

  /** The shot's prop registry, whose articulation lowers the joint ids. */
  props?: readonly IAutoMoviePropSpec[];

  /** The clips the source authored. */
  clips: readonly IAutoMovieClip[];

  /**
   * The object clips the engine baked for this shot (launched flights,
   * `attachTo` follows, staged mounts). Their ids and the channels they drive
   * are already spoken for.
   */
  baked: readonly IAutoMovieClip[];

  /** Scene nodes a compiled performance drives through the rig. */
  performed: ReadonlySet<string>;

  /** Shot length in seconds; a key outside it is never played. */
  duration: number;

  /** Authoring path the violations are reported against. */
  path: string;
}

/**
 * Gate the object clips a shot's source authored, so a moving thing that is not
 * a performer can reach a compiled shot at all.
 *
 * Everything on `objectMotions` used to be baked by the engine from a verb: a
 * launch's flight, a coupling's follow. Nothing else could get there, and two
 * separate contracts already promised that something would.
 * {@link builtOpeningPanelPlacements} says in as many words that a door which
 * swings on screen is an `objectMotions` clip over the panel node ids it
 * answers with, and {@link IAutoMoviePropArticulation} says a prop's hinge is a
 * lowered joint a clip drives. Both were true of the data and false of the
 * pipeline: no field carried such a clip, so every door in every production was
 * a configuration that could be authored open or shut and never seen to move.
 *
 * One channel serves both, because they are one thing: a node in the staged
 * graph, turned over the shot's own clock. A building's panel is a staged set
 * piece (`<environment>/<element>`) and a prop's leaf is a lowered articulation
 * joint (`<placement>/<joint>`), and admitting only one of them would leave the
 * other needing a second mechanism for the same sentence.
 *
 * What is refused, and why each refusal is not a preference:
 *
 * - **A node no shot staged**, or a joint no staged prop declares. A clip
 *   addressing nothing is written, validated, stored, and rendered as silence;
 *   this is the same drop the honorable-channel gate closed for pointer
 *   tracks.
 * - **A node a performance already drives.** A performer's motion comes off its
 *   rig, and a transform clip written over it would fight the pose every frame
 *   with the winner decided by producer order.
 * - **A channel a baked clip already drives**, and an id a baked clip already
 *   carries. One authority per channel, which is the grain the sampler resolves
 *   at, and `validateUniqueIds` refuses the shot outright on a duplicate id.
 * - **A key outside the shot's own clock.** A time past the end is data no frame
 *   reads, exactly as a launch landing past the end is refused rather than
 *   trimmed.
 * - **`cubicspline` interpolation.** The travel a prop declares is a bound this
 *   gate proves, and it proves it at the authored keys: between two bounded
 *   keys a `step` track never leaves the pair, and a `linear` one stays on the
 *   segment (a translation) or the arc (a rotation) between them, so neither
 *   can escape a componentwise bound its endpoints satisfy. A spline's tangents
 *   can overshoot both, and nothing downstream clamps an object clip: the
 *   viewer writes it onto the object verbatim. Refusing what cannot be bounded
 *   is the alternative to shipping a shot whose declared limit is decoration.
 *
 * The bound itself is measured rather than asserted: the clips resolve through
 * {@link resolveFrame} over the lowered graph with every staged prop's profile
 * bound at its own placement prefix, which is the same CONSTRAIN stage the
 * engine's own door round-trip is proved with. A clamp that fires is reported
 * with the profile that owns it, so a correction round reads "this travel, this
 * channel" instead of an anonymous number.
 */
export const gateAuthoredObjectMotions = (
  gate: IAutoMovieObjectMotionGate,
): IAutoMovieConstraintViolation[] => {
  const out = new ViolationCollector();
  if (gate.clips.length === 0) return out.items;

  // Only a prop the forge accepts contributes joints. Its own refusals belong
  // to `forgeProp` and to the placement gate that already ran; repeating them
  // here would answer for one fault twice, under two paths.
  const registry: Record<string, IAutoMoviePropSpec> = {};
  for (const spec of gate.props ?? [])
    if (registry[spec.node] === undefined && forgeProp(spec).success)
      registry[spec.node] = spec;

  const placements = new Set(gate.scene.nodes.map((node) => node.id));
  const staged = new Set([
    ...placements,
    ...gate.scene.cameras.map((camera) => camera.id),
    ...gate.scene.lights.map((light) => light.id),
  ]);
  const lowered = sceneToNodes({
    scene: gate.scene,
    props: registry,
    allowPartialModels: true,
  });
  const joints = lowered.map((node) => node.id).filter((id) => !staged.has(id));

  // A joint whose lowered id collides with something the scene already carries
  // has no single frame to be resolved in, and composing it would throw rather
  // than report. Named here, where the author can move the joint or the node.
  const seen = new Set<string>();
  const collided: string[] = [];
  for (const node of lowered) {
    if (seen.has(node.id)) collided.push(node.id);
    seen.add(node.id);
  }
  if (collided.length !== 0)
    out.push(
      "type",
      `${gate.path}`,
      `the lowered scene carries ${collided[0]!} twice, so no object clip over this shot can be resolved; rename the colliding scene node or prop joint`,
      collided,
    );

  const drivable = new Set(joints);
  for (const id of placements) if (!gate.performed.has(id)) drivable.add(id);
  // Keyed by CHANNEL rather than by node, because that is the grain the
  // sampler resolves at: a baked flight owning a projectile's translation
  // leaves its rotation free, and refusing the pair would refuse a spin nothing
  // contends for. `channelKey` is the sampler's own key function, so the two
  // cannot disagree about what "the same channel" means.
  const bakedChannels = new Set(
    gate.baked.flatMap((clip) =>
      clip.tracks.map((track) => channelKey(track.channel)),
    ),
  );
  const bakedIds = new Set(gate.baked.map((clip) => clip.id));

  // The transform-clip rule stands, and this adds the question only a shot can
  // answer: whether the node named is one this shot may drive with a clip.
  const channelGate: IAutoMovieClipChannelGate = (
    channel,
    channelPath,
    violations,
  ): void => {
    validateHonorableChannel(channel, channelPath, violations);
    const node = channel.node;
    if (channel.kind !== "node" || typeof node !== "string") return;
    if (!drivable.has(node)) {
      pushViolation(
        violations,
        "type",
        `${channelPath}.node`,
        gate.performed.has(node)
          ? `object motion node "${node}" is driven by this shot's performance; a performer moves off its rig, not off a transform clip`
          : `object motion node "${node}" is neither a staged scene node nor a lowered prop articulation joint of this shot`,
        node,
      );
      return;
    }
    // The path has already been refused by the rule above when it is not one
    // the pipeline writes, and an unknown one has no canonical key to compare.
    if (!NODE_CHANNEL_PATHS.has(channel.path as IAutoMovieNodeChannel["path"]))
      return;
    const key = channelKey(channel as unknown as IAutoMovieChannel);
    if (bakedChannels.has(key))
      pushViolation(
        violations,
        "type",
        channelPath,
        `object motion channel "${key}" is already driven by a clip this shot baked; one channel carries one authority`,
        key,
      );
  };

  const ids = new Map<string, number>();
  const times = new Set<number>([0]);
  gate.clips.forEach((clip, index) => {
    const path = `${gate.path}[${index}]`;
    validateClipArtifact(clip, path, out.items, channelGate);
    const first = ids.get(clip.id);
    if (first !== undefined)
      out.push(
        "type",
        `${path}.id`,
        `object motion clip id "${clip.id}" duplicates ${gate.path}[${first}].id`,
        clip.id,
      );
    else if (bakedIds.has(clip.id))
      out.push(
        "type",
        `${path}.id`,
        `object motion clip id "${clip.id}" collides with a clip this shot baked`,
        clip.id,
      );
    else ids.set(clip.id, index);

    clip.tracks.forEach((track, trackIndex) => {
      const trackPath = `${path}.tracks[${trackIndex}]`;
      if (track.interpolation === "cubicspline")
        out.push(
          "type",
          `${trackPath}.interpolation`,
          "an object motion track interpolates step or linear; a spline's tangents can leave a declared travel between two keys, and nothing clamps an object clip downstream",
          track.interpolation,
        );
      track.times.forEach((time, timeIndex) => {
        if (Number.isFinite(time) && time >= 0 && time <= gate.duration) {
          times.add(time);
          return;
        }
        out.push(
          "range",
          `${trackPath}.times[${timeIndex}]`,
          `object motion key must land inside the shot's own clock of 0..${gate.duration}s`,
          time,
        );
      });
    });
  });
  if (out.items.length > 0) return out.items;

  const profiles: IAutoMovieProfileApplication[] = gate.scene.nodes.flatMap(
    (placement) => {
      const spec = registry[placement.model];
      if (spec === undefined || spec.articulation === null) return [];
      return [
        {
          profile: spec.articulation.profile,
          binding: spec.articulation.binding,
          nodePrefix: placementNodePrefix(placement.id),
        },
      ];
    },
  );
  if (profiles.length === 0) return out.items;
  const reported = new Set<string>();
  for (const seconds of [...times].sort((left, right) => left - right))
    for (const violation of resolveFrame({
      nodes: lowered,
      clip: [...gate.clips],
      limits: [],
      profiles,
      seconds,
    }).violations) {
      // One channel, one refusal. A hinge held past its travel breaches at
      // every sampled key, and an author correcting it corrects one number.
      if (reported.has(violation.channel)) continue;
      reported.add(violation.channel);
      out.push(
        "range",
        `${gate.path}`,
        `object motion drives "${violation.channel}" past the travel profile "${violation.profile}" declares for it`,
        violation.channel,
      );
    }
  return out.items;
};
