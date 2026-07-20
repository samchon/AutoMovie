import { resolveFrame } from "@automovie/engine";
import {
  IAutoMovieChannel,
  IAutoMovieClip,
  IAutoMovieNode,
  IAutoMovieProfile,
  IAutoMovieProfileBinding,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

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

const translation = (id: string): IAutoMovieChannel => ({
  kind: "node",
  node: id,
  path: "translation",
});

const clipTo = (x: number): IAutoMovieClip => ({
  id: "clip",
  name: null,
  duration: 1,
  loop: false,
  tracks: [
    {
      channel: translation("slider"),
      times: [0],
      values: [x, 0, 0],
      interpolation: "linear",
    },
  ],
});

const PROFILE: IAutoMovieProfile = {
  id: "slider-profile",
  name: "slider",
  controls: [],
  drivers: [],
  limits: [
    {
      channel: translation("knob"),
      min: [0, null, null],
      max: [50, null, null],
    },
  ],
};

const BINDING: IAutoMovieProfileBinding = {
  profile: "slider-profile",
  root: "slider",
  instanceName: null,
  boneMap: { knob: "slider" },
};

const tx = (m: number[]): number => m[12]!;

/**
 * Profile-declared limits actually constrain in resolveFrame's CONSTRAIN stage:
 * a bound limit clamps the sampled channel, its violation is tagged with the
 * sourcing profile id, and the caller's directly-passed limit clamps last: the
 * direct bound is the final word.
 *
 * Scenarios:
 *
 * 1. An overshooting sample (x=100) against the profile's bound limit ([0, 50])
 *    clamps to 50 in the composed world matrix, reporting exactly one violation
 *    tagged `profile: "slider-profile"`.
 * 2. An in-range sample (x=25) passes: no violations, world untouched by the clamp
 *    (the negative twin).
 * 3. A direct limit ([0, 30]) alongside the profile's ([0, 50]) on the same
 *    channel: the value clamps through both (profile first, direct last) to 30,
 *    with two violations in order: the profile-tagged one, then the direct one
 *    carrying no profile tag.
 * 4. Byte-compat: `profiles: []` resolves identically to omitting the field.
 */
export const test_resolve_frame_profile_limits = (): void => {
  const clamped = resolveFrame({
    nodes: [node("slider")],
    clip: clipTo(100),
    limits: [],
    profiles: [{ profile: PROFILE, binding: BINDING }],
    seconds: 0,
  });
  TestValidator.equals("one violation", clamped.violations.length, 1);
  TestValidator.equals(
    "violation tagged with profile id",
    clamped.violations[0]!.profile,
    "slider-profile",
  );
  TestValidator.predicate(
    "world clamped to the profile bound",
    nclose(tx(clamped.world.get("slider")!), 50),
  );

  const inRange = resolveFrame({
    nodes: [node("slider")],
    clip: clipTo(25),
    limits: [],
    profiles: [{ profile: PROFILE, binding: BINDING }],
    seconds: 0,
  });
  TestValidator.equals("in-range sample passes", inRange.violations.length, 0);
  TestValidator.predicate(
    "in-range world unclamped",
    nclose(tx(inRange.world.get("slider")!), 25),
  );

  const layered = resolveFrame({
    nodes: [node("slider")],
    clip: clipTo(100),
    limits: [
      {
        channel: translation("slider"),
        min: [0, null, null],
        max: [30, null, null],
      },
    ],
    profiles: [{ profile: PROFILE, binding: BINDING }],
    seconds: 0,
  });
  TestValidator.equals("both limits fire", layered.violations.length, 2);
  TestValidator.equals(
    "profile-bound limit fires first",
    layered.violations[0]!.profile,
    "slider-profile",
  );
  TestValidator.equals(
    "direct limit carries no profile tag",
    layered.violations[1]!.profile,
    undefined,
  );
  TestValidator.predicate(
    "direct limit clamps last (final bound 30)",
    nclose(tx(layered.world.get("slider")!), 30),
  );

  const explicit = resolveFrame({
    nodes: [node("slider")],
    clip: clipTo(100),
    limits: [],
    profiles: [],
    seconds: 0,
  });
  const omitted = resolveFrame({
    nodes: [node("slider")],
    clip: clipTo(100),
    limits: [],
    seconds: 0,
  });
  TestValidator.equals(
    "empty profiles === omitted (violations)",
    explicit.violations,
    omitted.violations,
  );
  TestValidator.predicate(
    "empty profiles === omitted (world)",
    nclose(tx(explicit.world.get("slider")!), tx(omitted.world.get("slider")!)),
  );
};
