import {
  IAutoFilmGait,
  IAutoFilmGaitLimb,
  IAutoFilmKeyframe,
  IAutoFilmMotion,
  IAutoFilmProfile,
} from "@autofilm/interface";

/** Wrap a cycle position into `[0, 1)`. */
const wrap01 = (x: number): number => ((x % 1) + 1) % 1;

/**
 * One limb's flexion (degrees) at cycle time `t`. Over its **stance** fraction
 * (`duty`) the limb sweeps from `+amplitude` (forward-planted) to `−amplitude`
 * (pushed back), driving the body; over the remaining **swing** fraction it
 * lifts and recovers from `−amplitude` back to `+amplitude`. The `phase` offset
 * slides the whole cycle so limbs fall in sequence, and the swing is centered
 * on the limb's `neutral` (default 0) so a one-way joint like a knee stays on
 * its anatomical side of zero.
 *
 * @author Samchon
 */
export const gaitLimbFlexion = (
  limb: IAutoFilmGaitLimb,
  t: number,
  period: number,
): number => {
  const u = wrap01(t / period + limb.phase);
  const a = limb.amplitude;
  const swing =
    u < limb.duty
      ? a * (1 - (2 * u) / limb.duty) // stance: +a → −a
      : -a + (2 * a * (u - limb.duty)) / (1 - limb.duty); // swing: −a → +a
  return (limb.neutral ?? 0) + swing;
};

/**
 * Synthesise a **declarative gait** ({@link IAutoFilmGait}) into a looping
 * {@link IAutoFilmMotion} — the engine fattening a creature's characteristic
 * locomotion (per-limb phase / duty / amplitude) into per-frame flexion. The
 * result is an ordinary one-cycle clip (sampled at `samples` even steps, the
 * closing keyframe repeating the first for a seamless loop) that
 * `locomoteMotion` / `travelMotion` can drive across the floor.
 *
 * The same synthesiser produces a human walk, a horse's lateral-sequence walk,
 * a cat's stalk — the difference lives entirely in the gait data, not the
 * code.
 *
 * @author Samchon
 */
export const gaitMotion = (
  id: string,
  skeleton: string,
  gait: IAutoFilmGait,
  samples: number,
): IAutoFilmMotion => {
  const keyframes: IAutoFilmKeyframe[] = [];
  for (let i = 0; i <= samples; ++i) {
    const time = (i / samples) * gait.period;
    keyframes.push({
      time,
      pose: {
        skeleton,
        root: null,
        joints: gait.limbs.map((limb) => ({
          bone: limb.bone,
          flexion: gaitLimbFlexion(limb, time, gait.period),
          abduction: null,
          twist: null,
        })),
      },
      expression: null,
      easing: "linear",
      bezier: null,
    });
  }
  return { id, skeleton, duration: gait.period, loop: true, keyframes };
};

/**
 * Bind a profile's gait set ({@link IAutoFilmProfile.gaits}) onto a concrete
 * skeleton — synthesising each named gait into a clip for **this** body. The
 * point of a profile binding: the _same_ profile applied to a horse skeleton
 * and a pony skeleton yields each its own gait clips, so one declarative gait
 * set drives many bodies. Returns the clips keyed by gait name (empty when the
 * profile declares no gaits).
 *
 * @author Samchon
 */
export const bindProfileGaits = (
  profile: IAutoFilmProfile,
  skeleton: string,
  samples: number,
): Record<string, IAutoFilmMotion> => {
  const clips: Record<string, IAutoFilmMotion> = {};
  for (const gait of profile.gaits ?? [])
    clips[gait.name] = gaitMotion(
      `${profile.id}:${gait.name}`,
      skeleton,
      gait,
      samples,
    );
  return clips;
};
