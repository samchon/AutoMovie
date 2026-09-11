import {
  IAutoMovieCompiledShotSource,
  IAutoMovieDiagnostic,
  IAutoMovieShotContract,
} from "@automovie/interface";

import { compareCodeUnits } from "../../../production/src/production/contentIdentity";
import { engineDiagnostic } from "./productionValidationDiagnostics";

/**
 * Validate shot-local effect cues against builder-owned streams and events.
 *
 * @author Samchon
 * @evidence requirements/effects-and-simulation/scope-and-simulation-tiers.md#effects-story-binding Requires every effect cue to name a registered world zone and recipe within its shot's time, so an effect is bound to an authored event rather than to a floating preset.
 */
export const validateAutoMovieEffects = (
  contract: IAutoMovieShotContract,
  value: IAutoMovieCompiledShotSource,
): IAutoMovieDiagnostic[] => {
  const diagnostics: IAutoMovieDiagnostic[] = [];
  const fail = (field: string, expectation: string): void => {
    diagnostics.push(engineDiagnostic(contract.id, field, expectation));
  };
  const cues = value.effectCues ?? [];
  if (cues.length > 128)
    fail("effectCues", "must contain at most 128 bounded zone activations");
  const ids = new Set<string>();
  const priorByZone = new Map<string, (typeof cues)[number]>();
  const events = new Map(contract.events.map((event) => [event.id, event]));
  const samples = new Map(
    value.eventSamples.map((sample) => [sample.id, sample.time]),
  );
  for (const cue of [...cues].sort(
    (left, right) =>
      compareCodeUnits(left.zone, right.zone) ||
      left.start - right.start ||
      compareCodeUnits(left.id, right.id),
  )) {
    const field = `effectCue:${cue.id || "(blank)"}`;
    if (cue.id.trim().length === 0 || ids.has(cue.id))
      fail(field, "must have one non-blank id unique inside the shot");
    ids.add(cue.id);
    const compiled = value.effects.find((effect) => effect.id === cue.id);
    if (compiled === undefined || compiled.zone !== cue.zone)
      fail(
        `${field}.zone`,
        `must reference one current builder-materialized world zone "${cue.zone}"`,
      );
    if (
      Number.isFinite(cue.start) === false ||
      Number.isFinite(cue.end) === false ||
      cue.start < 0 ||
      cue.end <= cue.start ||
      cue.end > contract.durationSeconds
    )
      fail(
        `${field}.time`,
        `must be one positive interval inside 0..${contract.durationSeconds}s`,
      );
    if (
      [cue.intensity.from, cue.intensity.to].some(
        (intensity) =>
          Number.isFinite(intensity) === false ||
          intensity < 0 ||
          intensity > 1,
      )
    )
      fail(`${field}.intensity`, "must stay inside the bounded 0..1 envelope");
    if (cue.event !== undefined) {
      const event = events.get(cue.event);
      const sample = samples.get(cue.event);
      if (
        event === undefined ||
        sample === undefined ||
        sample < cue.start ||
        sample >= cue.end
      )
        fail(
          `${field}.event`,
          `must name one compiled event realized inside [${cue.start}, ${cue.end})`,
        );
    }
    const prior = priorByZone.get(cue.zone);
    if (prior !== undefined && cue.start < prior.end)
      fail(
        `${field}.start`,
        `must not overlap prior zone cue "${prior.id}" ending at ${prior.end}s`,
      );
    priorByZone.set(cue.zone, cue);
  }
  if (
    value.effects.length !== cues.length ||
    value.effects.some((effect) => ids.has(effect.id) === false)
  )
    fail(
      "effects",
      "must contain exactly one builder-owned stream for every source cue",
    );
  return diagnostics;
};
