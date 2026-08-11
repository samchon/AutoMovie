import { IAutoMovieProfile, IAutoMovieValidation } from "@automovie/interface";

import { ViolationCollector } from "./violation";

/**
 * Validate the typed semantic capability data carried by model profiles.
 *
 * Locomotion remains proven by the profile's existing `gaits` field. This
 * validator owns the additional mountable and destructible traits so direct
 * engine consumers and production design lint enforce one contract.
 *
 * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-path-and-scope `validateProfileCapabilities` reports malformed mountable or destructible capability fields at their exact model-profile member paths.
 * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-path-scope `validateProfileCapabilities` retains the observed capability value and semantic bound without inferring support from an unrelated gait field.
 */
export const validateProfileCapabilities = (props: {
  /** Profiles attached to one runtime model or model recipe. */
  profiles: readonly IAutoMovieProfile[];
}): IAutoMovieValidation => {
  const collector = new ViolationCollector();
  const profileIds = new Set<string>();
  for (const [profileIndex, profile] of props.profiles.entries()) {
    const path = `$input.profiles[${profileIndex}]`;
    nonBlank(profile.id, `${path}.id`, "profile id", collector);
    nonBlank(profile.name, `${path}.name`, "profile name", collector);
    unique(profileIds, profile.id, `${path}.id`, "profile id", collector);
    const traitKinds = new Set<string>();
    for (const [traitIndex, trait] of (profile.traits ?? []).entries()) {
      const traitPath = `${path}.traits[${traitIndex}]`;
      unique(
        traitKinds,
        trait.kind,
        `${traitPath}.kind`,
        "profile trait kind",
        collector,
      );
      if (trait.kind === "mountable") {
        integer(
          trait.seats,
          1,
          1_024,
          `${traitPath}.seats`,
          "mountable seats",
          collector,
        );
        positive(
          trait.payloadMass,
          `${traitPath}.payloadMass`,
          "mountable payload mass",
          collector,
        );
        continue;
      }
      positive(
        trait.durability,
        `${traitPath}.durability`,
        "destructible durability",
        collector,
      );
      positive(
        trait.impactBody.mass,
        `${traitPath}.impactBody.mass`,
        "impact body mass",
        collector,
      );
      bounded(
        trait.impactBody.restitution,
        0,
        1,
        `${traitPath}.impactBody.restitution`,
        "impact body restitution",
        collector,
      );
      positive(
        trait.impactBody.hardness,
        `${traitPath}.impactBody.hardness`,
        "impact body hardness",
        collector,
      );
      positive(
        trait.impactBody.penetrability,
        `${traitPath}.impactBody.penetrability`,
        "impact body penetrability",
        collector,
      );
    }
  }
  return collector.toValidation();
};

const nonBlank = (
  value: string,
  path: string,
  label: string,
  collector: ViolationCollector,
): void => {
  if (value.trim().length === 0)
    collector.push("type", path, `${label} must be non-blank`, value);
};

const unique = (
  seen: Set<string>,
  value: string,
  path: string,
  label: string,
  collector: ViolationCollector,
): void => {
  if (seen.has(value))
    collector.push("type", path, `${label} must be unique`, value);
  seen.add(value);
};

const positive = (
  value: number,
  path: string,
  label: string,
  collector: ViolationCollector,
): void => {
  if (Number.isFinite(value) === false || value <= 0)
    collector.push(
      "range",
      path,
      `${label} must be finite and positive`,
      value,
    );
};

const bounded = (
  value: number,
  min: number,
  max: number,
  path: string,
  label: string,
  collector: ViolationCollector,
): void => collector.range(path, value, min, max, label);

const integer = (
  value: number,
  min: number,
  max: number,
  path: string,
  label: string,
  collector: ViolationCollector,
): void => {
  if (Number.isInteger(value) === false || value < min || value > max)
    collector.push(
      "range",
      path,
      `${label} must be an integer within [${min}, ${max}]`,
      value,
    );
};
