import { IAutoMovieClip, IAutoMovieLight } from "@automovie/interface";

import {
  IAutoMovieLightOverride,
  LIGHT_CHANNEL_PROPERTIES,
  applyLightOverride,
  parseLightPointer,
} from "./lightChannel";
import { sampleClip } from "./sampleClip";

/**
 * What {@link resolveShotLighting} evaluates: the staged lights and the clips
 * changing them.
 */
export interface IAutoMovieShotLightingInput {
  /** The scene's staged lights, in staging order. */
  lights: readonly IAutoMovieLight[];

  /** The shot's light-motion clips (`IAutoMovieShot.lightMotions`). */
  clips: readonly IAutoMovieClip[];

  /** The instant to evaluate, in shot-local seconds. */
  seconds: number;
}

/**
 * The APPLY pass for light animation: evaluate a shot's `lightMotions` at
 * `seconds` and return the scene's lights carrying their values at that
 * instant.
 *
 * This is the consumer that makes the light-time axis real (#1348). A shot may
 * state that a candle burns at 1.4 candela until 1.55s and 0.04 after it, and
 * anything reading only the committed artifacts (`scene.json` for the lights,
 * `shots/<beat>.json` for the clips) evaluates that statement to a number at
 * any frame, deterministically: the same inputs always yield the same lights,
 * exactly as `resolveFrame` does for node transforms.
 *
 * A light no clip touches is returned **by identity**, so a film that never
 * changes its light produces the same lights it produced before this pass
 * existed.
 *
 * Malformed input throws rather than resolving to something plausible, the same
 * contract `resolveFrame` holds for a clip naming a missing node: a light clip
 * reaching here has passed `validateShotArtifact`, so a track that addresses no
 * staged light, or a property the staged light's kind does not carry, is a
 * broken artifact and not a case to skip. Silently dropping it is the failure
 * #1349 named.
 *
 * @author Samchon
 */
export const resolveShotLighting = (
  input: IAutoMovieShotLightingInput,
): IAutoMovieLight[] => {
  const staged = new Map(input.lights.map((light) => [light.id, light]));
  const overrides = new Map<string, IAutoMovieLightOverride>();

  for (const clip of input.clips)
    for (const { channel, value } of sampleClip(clip, input.seconds).values()) {
      const target =
        channel.kind === "pointer" ? parseLightPointer(channel.pointer) : null;
      if (target === null)
        throw new Error(
          `light clip "${clip.id}" track must address /lights/<id>/<property>`,
        );
      const light = staged.get(target.light);
      if (light === undefined)
        throw new Error(
          `light clip "${clip.id}" addresses missing light "${target.light}"`,
        );
      const property = LIGHT_CHANNEL_PROPERTIES[target.property];
      if (!property.carries(light.type))
        throw new Error(
          `light clip "${clip.id}" addresses "${target.property}", which a ${light.type} light does not carry`,
        );
      const carried = overrides.get(target.light);
      const override = carried ?? {};
      if (carried === undefined) overrides.set(target.light, override);
      property.write(override, value);
    }

  return input.lights.map((light) => {
    const override = overrides.get(light.id);
    return override === undefined ? light : applyLightOverride(light, override);
  });
};
