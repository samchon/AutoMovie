import { IAutoMovieProfile, IAutoMovieValidation } from "@automovie/interface";

import { ViolationCollector } from "./violation";

/**
 * Validate the typed semantic capability data carried by model profiles.
 *
 * Locomotion remains proven by the profile's existing `gaits` field. This
 * validator owns the additional shooter, mountable, and destructible traits so
 * direct engine consumers and production design lint enforce one contract.
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
      if (trait.kind === "destructible") {
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
        continue;
      }
      if (trait.weapons.length === 0)
        collector.push(
          "type",
          `${traitPath}.weapons`,
          "a shooter trait must declare at least one typed weapon",
          trait.weapons,
        );
      const weaponIds = new Set<string>();
      for (const [weaponIndex, weapon] of trait.weapons.entries()) {
        const weaponPath = `${traitPath}.weapons[${weaponIndex}]`;
        nonBlank(weapon.id, `${weaponPath}.id`, "weapon id", collector);
        unique(
          weaponIds,
          weapon.id,
          `${weaponPath}.id`,
          "shooter weapon id",
          collector,
        );
        if (weapon.kind === "melee") {
          positive(
            weapon.reach,
            `${weaponPath}.reach`,
            "melee reach",
            collector,
          );
          positive(
            weapon.recoverySeconds,
            `${weaponPath}.recoverySeconds`,
            "melee recovery seconds",
            collector,
          );
          positive(
            weapon.impact,
            `${weaponPath}.impact`,
            "melee impact",
            collector,
          );
          continue;
        }
        positive(
          weapon.reloadSeconds,
          `${weaponPath}.reloadSeconds`,
          "weapon reload seconds",
          collector,
        );
        positive(
          weapon.effectiveRange,
          `${weaponPath}.effectiveRange`,
          "weapon effective range",
          collector,
        );
        positive(
          weapon.muzzleVelocity,
          `${weaponPath}.muzzleVelocity`,
          "weapon muzzle velocity",
          collector,
        );
        if (weapon.kind === "firearm") {
          bounded(
            weapon.misfireProbability,
            0,
            1,
            `${weaponPath}.misfireProbability`,
            "firearm misfire probability",
            collector,
          );
          if (weapon.accuracy.length === 0)
            collector.push(
              "type",
              `${weaponPath}.accuracy`,
              "a firearm requires at least one distance/accuracy point",
              weapon.accuracy,
            );
          let priorDistance = -1;
          for (const [pointIndex, point] of weapon.accuracy.entries()) {
            const pointPath = `${weaponPath}.accuracy[${pointIndex}]`;
            if (
              Number.isFinite(point.distance) === false ||
              point.distance < 0 ||
              point.distance <= priorDistance
            )
              collector.push(
                "range",
                `${pointPath}.distance`,
                "firearm accuracy distance must be finite, non-negative, and strictly above the prior point",
                point.distance,
              );
            bounded(
              point.probability,
              0,
              1,
              `${pointPath}.probability`,
              "firearm hit probability",
              collector,
            );
            priorDistance = point.distance;
          }
          continue;
        }
        if (weapon.ammunition.length === 0)
          collector.push(
            "type",
            `${weaponPath}.ammunition`,
            "a cannon requires at least one typed ammunition payload",
            weapon.ammunition,
          );
        const ammunitionKinds = new Set<string>();
        for (const [
          ammunitionIndex,
          ammunition,
        ] of weapon.ammunition.entries()) {
          const ammunitionPath = `${weaponPath}.ammunition[${ammunitionIndex}]`;
          unique(
            ammunitionKinds,
            ammunition.kind,
            `${ammunitionPath}.kind`,
            "cannon ammunition kind",
            collector,
          );
          if (ammunition.kind === "round-shot") {
            positive(
              ammunition.mass,
              `${ammunitionPath}.mass`,
              "round-shot mass",
              collector,
            );
            integer(
              ammunition.maxRicochets,
              0,
              64,
              `${ammunitionPath}.maxRicochets`,
              "round-shot ricochet count",
              collector,
            );
            bounded(
              ammunition.ricochetRetention,
              0,
              1,
              `${ammunitionPath}.ricochetRetention`,
              "round-shot ricochet retention",
              collector,
            );
          } else {
            integer(
              ammunition.pellets,
              1,
              100_000,
              `${ammunitionPath}.pellets`,
              "canister pellet count",
              collector,
            );
            bounded(
              ammunition.spreadDegrees,
              Number.EPSILON,
              180,
              `${ammunitionPath}.spreadDegrees`,
              "canister spread",
              collector,
            );
            positive(
              ammunition.pelletMass,
              `${ammunitionPath}.pelletMass`,
              "canister pellet mass",
              collector,
            );
          }
        }
      }
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
