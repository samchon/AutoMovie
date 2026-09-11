import {
  validateAutoMovieSoftFurnishingDomainOwnership,
  validateFluidDomain,
  validatePlantingDomain,
  validatePlantingInstallations,
  validateServiceNetwork,
  validateSoftBodyDomain,
  validateSoftFurnishings,
  validateWaterFeatures,
  validateWetZones,
} from "@automovie/engine";
import {
  IAutoMovieProductionShotProgram,
  IAutoMovieShotSourceOutput,
  IAutoMovieValidation,
} from "@automovie/interface";

import {
  IAutoMovieSourceContentFinding,
  autoMovieSourceContentFinding,
  autoMovieValidationFindings,
} from "./sourceContentDiagnostics";

/**
 * How one fold's validator paths are read as addresses in the program.
 *
 * Two shapes exist because the validators take two shapes of input, and a fold
 * has to say which one it handed over. A validator given several lists roots its
 * paths at those lists (`$input.features[0]`), and one given a single record
 * roots them at the record's own fields (`$input.zones[0]`, `$input.id`), where
 * the same text means something entirely different.
 */
interface IBindingAddress {
  /** `$input` is one record of this program list, so every path hangs under it. */
  root?: { key: string; index: number };

  /** `$input.<name>[i]` addresses this program list at the mapped position. */
  fields?: Readonly<
    Record<string, { key: string; indices: readonly number[] }>
  >;
}

/**
 * One binding's own address inside the program that declared it.
 *
 * A fold's validator is handed the records for one building, so its violation
 * paths count within that filtered list. An author reads the program, not the
 * filter, so each local index is mapped back to the position the record
 * actually occupies.
 *
 * A single-record fold needs the other direction. Its validator was handed the
 * record itself, so `$input.zones[0]` means the zones of that record and not a
 * program field called `zones`; without the record's own address in front, the
 * author is handed a path to a field the program does not have. Three of the four
 * folds here were reported that way, which is how a service network's finding
 * arrived as `$program.penetrations[0]`.
 */
const rewriteBindingPath = (path: string, address: IBindingAddress): string => {
  const inside = path.slice("$input".length);
  if (address.root !== undefined)
    return `$program.${address.root.key}[${address.root.index}]${inside}`;
  const matched = /^\$input\.([A-Za-z]+)\[(\d+)\]/u.exec(path);
  if (matched === null) return `$program${inside}`;
  const field = address.fields?.[matched[1]!];
  if (field === undefined) return `$program${inside}`;
  const local = Number(matched[2]);
  return `$program.${field.key}[${field.indices[local] ?? local}]${path.slice(matched[0].length)}`;
};

/** Records of one fold that name a building, kept with where they were written. */
const bindingsOfEnvironment = <T extends { environment: string }>(
  items: readonly T[],
  environment: string,
): { items: T[]; indices: number[] } => {
  const kept: T[] = [];
  const indices: number[] = [];
  items.forEach((item, index) => {
    if (item.environment !== environment) return;
    kept.push(item);
    indices.push(index);
  });
  return { items: kept, indices };
};

/**
 * Refuse every fold that binds itself to a building this shot does not stage.
 *
 * Water, cloth, planting and building services are independent domains that
 * become architecture only through a binding, and each binding names the
 * building it belongs to. An unresolved name is the one failure none of those
 * folds can see for itself: each validator is handed one building and answers
 * about that one, so a record pointing at a building nobody staged would simply
 * never be checked by anyone.
 */
export const buildingBoundDiagnostics = (
  program: IAutoMovieProductionShotProgram,
): IAutoMovieSourceContentFinding[] => {
  const messages: IAutoMovieSourceContentFinding[] = [];
  const environments = program.builtEnvironments ?? [];
  const known = new Set(environments.map((environment) => environment.id));
  const waterFeatures = program.waterFeatures ?? [];
  const softFurnishings = program.softFurnishings ?? [];
  const plantingInstallations = program.plantingInstallations ?? [];
  const serviceNetworks = program.serviceNetworks ?? [];
  const unresolved = (
    key: string,
    items: readonly { environment: string }[],
  ): void => {
    items.forEach((item, index) => {
      if (known.has(item.environment)) return;
      // A name that resolves to nothing is the record's own content, so it takes
      // the same identity a validator's `type` violation would.
      messages.push({
        kind: "type",
        severity: "error",
        message: `$program.${key}[${index}].environment "${item.environment}" does not resolve to a building this shot stages. Declare that building, or bind the record to one the shot already carries.`,
      });
    });
  };
  unresolved("waterFeatures", waterFeatures);
  unresolved("softFurnishings", softFurnishings);
  unresolved("plantingInstallations", plantingInstallations);
  unresolved("serviceNetworks", serviceNetworks);

  const fluidDomains = program.fluidDomains ?? [];
  const softBodyDomains = program.softBodyDomains ?? [];
  const plantingDomains = program.plantingDomains ?? [];
  const plantingClusters = program.plantingClusters ?? [];
  const allOf = (items: readonly unknown[]): number[] =>
    items.map((_, index) => index);
  // Both branches of the validation are read. A fold that produced only warnings
  // succeeds, and reading the failure branch alone is how an uncited penetration
  // never reached the author at all while the same warning beside an error
  // reached them as a refusal.
  const say = (
    validation: IAutoMovieValidation,
    address: IBindingAddress,
    remedy: string,
  ): void => {
    for (const violation of autoMovieValidationFindings(validation))
      messages.push(
        autoMovieSourceContentFinding(
          violation,
          `${rewriteBindingPath(violation.path, address)} ${violation.expected}. ${remedy}`,
        ),
      );
  };

  say(
    validateAutoMovieSoftFurnishingDomainOwnership(softFurnishings),
    {
      fields: {
        furnishings: {
          key: "softFurnishings",
          indices: allOf(softFurnishings),
        },
      },
    },
    "Give each world-space soft-body domain exactly one furnishing owner before compiling the shot.",
  );

  for (const environment of environments) {
    const water = bindingsOfEnvironment(waterFeatures, environment.id);
    if (water.items.length !== 0)
      say(
        validateWaterFeatures({
          environment,
          features: water.items,
          domains: [...fluidDomains],
        }),
        {
          fields: {
            features: { key: "waterFeatures", indices: water.indices },
            domains: { key: "fluidDomains", indices: allOf(fluidDomains) },
          },
        },
        "Correct the water feature or the domain it binds before compiling the shot.",
      );
    const cloth = bindingsOfEnvironment(softFurnishings, environment.id);
    if (cloth.items.length !== 0)
      say(
        validateSoftFurnishings({
          environment,
          furnishings: cloth.items,
          domains: [...softBodyDomains],
          domainOwnership: "prevalidated",
        }),
        {
          fields: {
            furnishings: { key: "softFurnishings", indices: cloth.indices },
            domains: {
              key: "softBodyDomains",
              indices: allOf(softBodyDomains),
            },
          },
        },
        "Correct the soft furnishing or the domain it hangs before compiling the shot.",
      );
    const planting = bindingsOfEnvironment(
      plantingInstallations,
      environment.id,
    );
    if (planting.items.length !== 0)
      say(
        validatePlantingInstallations({
          environment,
          installations: planting.items,
          clusters: [...plantingClusters],
          domains: [...plantingDomains],
        }),
        {
          fields: {
            installations: {
              key: "plantingInstallations",
              indices: planting.indices,
            },
            clusters: {
              key: "plantingClusters",
              indices: allOf(plantingClusters),
            },
            domains: {
              key: "plantingDomains",
              indices: allOf(plantingDomains),
            },
          },
        },
        "Correct the planting installation, its cluster or its recipe before compiling the shot.",
      );
    serviceNetworks.forEach((network, index) => {
      if (network.environment !== environment.id) return;
      const address = { root: { key: "serviceNetworks", index } };
      say(
        validateServiceNetwork({ network, environment }),
        address,
        "Correct the port network before compiling the shot.",
      );
      say(
        validateWetZones({ network, environment }),
        address,
        "Correct the wet zone before compiling the shot.",
      );
    });
  }

  // A domain nobody bound is still a domain the production declared, and an
  // unsound one no feature happens to cite is exactly the record an author is
  // about to bind. It answers for itself here rather than staying unchecked
  // until the binding exists.
  const boundFluid = new Set(waterFeatures.map((feature) => feature.domain));
  fluidDomains.forEach((domain, index) => {
    if (boundFluid.has(domain.id)) return;
    say(
      validateFluidDomain({ domain }),
      { root: { key: "fluidDomains", index } },
      "Correct the fluid domain before compiling the shot.",
    );
  });
  const boundCloth = new Set(
    softFurnishings.map((furnishing) => furnishing.domain),
  );
  softBodyDomains.forEach((domain, index) => {
    if (boundCloth.has(domain.id)) return;
    say(
      validateSoftBodyDomain({ domain }),
      { root: { key: "softBodyDomains", index } },
      "Correct the soft body domain before compiling the shot.",
    );
  });
  const boundPlanting = new Set(
    plantingClusters.map((cluster) => cluster.domain),
  );
  plantingDomains.forEach((domain, index) => {
    if (boundPlanting.has(domain.id)) return;
    say(
      validatePlantingDomain({ domain }),
      { root: { key: "plantingDomains", index } },
      "Correct the planting recipe before compiling the shot.",
    );
  });
  return messages;
};

/** The building-bound folds a program declared, absent when it declared none. */
export const boundFolds = (
  program: IAutoMovieProductionShotProgram,
): Partial<IAutoMovieShotSourceOutput> => {
  const carried: Record<string, unknown> = {};
  for (const key of [
    "designReferences",
    "designEvidence",
    "designLineages",
    "fluidDomains",
    "waterFeatures",
    "softBodyDomains",
    "softFurnishings",
    "plantingDomains",
    "plantingClusters",
    "plantingInstallations",
    "serviceNetworks",
  ] as const) {
    const records = program[key];
    if (records === undefined || records.length === 0) continue;
    carried[key] = structuredClone(records);
  }
  return carried as Partial<IAutoMovieShotSourceOutput>;
};
