import {
  IAutoMovieBuiltEnvironment,
  IAutoMovieFluidDomain,
  IAutoMoviePlantingArrangement,
  IAutoMoviePlantingCluster,
  IAutoMoviePlantingDomain,
  IAutoMoviePlantingInstallation,
  IAutoMoviePlantingPlacement,
  IAutoMoviePlantingState,
  IAutoMovieSoftAnalysis,
  IAutoMovieValidation,
  IAutoMovieVector3,
} from "@automovie/interface";

import { builtEnvironmentContainsPoint } from "../architecture/builtEnvironment";
import { ViolationCollector } from "../validation/violation";
import { arrangePlantingCluster, growPlanting } from "./planting";
import {
  validatePlantingCluster,
  validatePlantingDomain,
} from "./validatePlantingDomain";

const INSTALLATION_KINDS = new Set([
  "potted",
  "planter",
  "green-wall",
  "aquatic",
  "other",
]);
const IRRIGATION_MEDIA = new Set(["potable", "reclaimed", "rainwater", "pond"]);

/**
 * Validate the bindings that make independent planting clusters a building's
 * planting.
 *
 * This is the seam, and it is deliberately one-directional: the architecture
 * record knows nothing about plants, and the planting records know nothing
 * about architecture. The installation is the only place the names meet, so
 * this is the only place their agreement can be checked — that the cited space
 * is a real logical space of the cited environment, that the support really is
 * the surface, element or boundary it claims, that the irrigation port resolves
 * to an element, that a `green-wall` is trained against something vertical
 * rather than resting on a floor patch, that an `aquatic` planting actually
 * stands in a fluid domain and that a dry one does not pretend to, and that
 * every generated member lands inside the room instead of through its wall.
 *
 * A room declared as a purely semantic container (a logical space with no
 * convex cells) is not geometrically checked: there is no volume to check
 * against, and inventing one would be the design deciding a fact the author did
 * not state.
 *
 * @author Samchon
 */
export const validatePlantingInstallations = (props: {
  environment: IAutoMovieBuiltEnvironment;
  installations: IAutoMoviePlantingInstallation[];
  clusters: IAutoMoviePlantingCluster[];
  domains: IAutoMoviePlantingDomain[];
  /** Fluid domains available for aquatic planting; empty when there are none. */
  fluidDomains?: IAutoMovieFluidDomain[];
}): IAutoMovieValidation => {
  const { environment, installations, clusters, domains } = props;
  const out = new ViolationCollector();
  const root = "$input";

  const spaces = new Map(environment.spaces.map((space) => [space.id, space]));
  const elements = new Set(environment.elements.map((element) => element.id));
  const boundaries = new Set(
    environment.boundaries.map((boundary) => boundary.id),
  );
  const surfaces = new Set(
    environment.surfaces.map((surface) => surface.surface.id),
  );
  const byCluster = new Map(clusters.map((cluster) => [cluster.id, cluster]));
  const byDomain = new Map(domains.map((domain) => [domain.id, domain]));
  const byFluid = new Map(
    (props.fluidDomains ?? []).map((domain) => [domain.id, domain]),
  );

  const seenDomains = new Set<string>();
  domains.forEach((domain, index) => {
    if (seenDomains.has(domain.id))
      out.push(
        "type",
        `${root}.domains[${index}].id`,
        `planting recipe id "${domain.id}" is duplicated`,
        domain.id,
      );
    seenDomains.add(domain.id);
    repath(
      out,
      `${root}.domains[${index}]`,
      validatePlantingDomain({ domain }),
    );
  });

  const seenClusters = new Set<string>();
  clusters.forEach((cluster, index) => {
    const path = `${root}.clusters[${index}]`;
    if (seenClusters.has(cluster.id))
      out.push(
        "type",
        `${path}.id`,
        `planting cluster id "${cluster.id}" is duplicated`,
        cluster.id,
      );
    seenClusters.add(cluster.id);
    repath(out, path, validatePlantingCluster({ cluster }));
    if (!byDomain.has(cluster.domain))
      out.push(
        "type",
        `${path}.domain`,
        `planting recipe "${cluster.domain}" was not supplied with this binding`,
        cluster.domain,
      );
  });

  const seenInstallations = new Set<string>();
  installations.forEach((installation, index) => {
    const path = `${root}.installations[${index}]`;
    if (installation.id.trim().length === 0)
      out.push(
        "type",
        `${path}.id`,
        "planting installation id must be non-empty",
        installation.id,
      );
    else if (seenInstallations.has(installation.id))
      out.push(
        "type",
        `${path}.id`,
        `planting installation id "${installation.id}" is duplicated`,
        installation.id,
      );
    seenInstallations.add(installation.id);

    if (!INSTALLATION_KINDS.has(installation.kind))
      out.push(
        "type",
        `${path}.kind`,
        `planting installation kind must be one of ${[...INSTALLATION_KINDS].join(", ")}`,
        installation.kind,
      );
    if (installation.environment !== environment.id)
      out.push(
        "type",
        `${path}.environment`,
        `planting installation must cite its owning built environment "${environment.id}"`,
        installation.environment,
      );

    const space = spaces.get(installation.space);
    if (space === undefined)
      out.push(
        "type",
        `${path}.space`,
        `logical space "${installation.space}" does not resolve in built environment "${environment.id}"`,
        installation.space,
      );

    const support = installation.support;
    if (support.kind === "surface" && !surfaces.has(support.surface))
      out.push(
        "type",
        `${path}.support.surface`,
        `support patch "${support.surface}" does not resolve in built environment "${environment.id}"`,
        support.surface,
      );
    if (support.kind === "element" && !elements.has(support.element))
      out.push(
        "type",
        `${path}.support.element`,
        `support element "${support.element}" does not resolve in built environment "${environment.id}"`,
        support.element,
      );
    if (support.kind === "boundary" && !boundaries.has(support.boundary))
      out.push(
        "type",
        `${path}.support.boundary`,
        `support boundary "${support.boundary}" does not resolve in built environment "${environment.id}"`,
        support.boundary,
      );
    // A green wall is trained against something upright. A floor patch is a
    // support for a pot, never for a wall of planting, and accepting one would
    // let a facade garden be authored lying on the ground.
    if (installation.kind === "green-wall" && support.kind === "surface")
      out.push(
        "type",
        `${path}.support`,
        "a green wall must be trained against a boundary or an element, not carried by a floor patch",
        support.kind,
      );

    const irrigation = installation.irrigation;
    if (irrigation !== null) {
      if (!elements.has(irrigation.port))
        out.push(
          "type",
          `${path}.irrigation.port`,
          `irrigation port "${irrigation.port}" does not resolve in built environment "${environment.id}"`,
          irrigation.port,
        );
      if (
        !Number.isFinite(irrigation.demandLitresPerDay) ||
        irrigation.demandLitresPerDay <= 0
      )
        out.push(
          "range",
          `${path}.irrigation.demandLitresPerDay`,
          "irrigation demand must be finite and strictly positive",
          irrigation.demandLitresPerDay,
        );
      if (!IRRIGATION_MEDIA.has(irrigation.medium))
        out.push(
          "type",
          `${path}.irrigation.medium`,
          `irrigation medium must be one of ${[...IRRIGATION_MEDIA].join(", ")}`,
          irrigation.medium,
        );
    }
    const aquatic = installation.kind === "aquatic";
    const submerged = irrigation === null ? null : irrigation.fluidDomain;
    if (aquatic && submerged === null)
      out.push(
        "type",
        `${path}.irrigation`,
        "aquatic planting must cite the fluid domain its roots stand in",
        irrigation,
      );
    if (aquatic === false && submerged !== null)
      out.push(
        "type",
        `${path}.irrigation.fluidDomain`,
        "only aquatic planting may cite a fluid domain",
        submerged,
      );
    const water = submerged === null ? undefined : byFluid.get(submerged);
    if (submerged !== null && water === undefined)
      out.push(
        "type",
        `${path}.irrigation.fluidDomain`,
        `fluid domain "${submerged}" was not supplied with this binding`,
        submerged,
      );

    const cluster = byCluster.get(installation.cluster);
    if (cluster === undefined) {
      out.push(
        "type",
        `${path}.cluster`,
        `planting cluster "${installation.cluster}" was not supplied with this binding`,
        installation.cluster,
      );
      return;
    }
    if (validatePlantingCluster({ cluster }).success === false) return;
    const arrangement = arrangePlantingCluster(cluster);
    // The canopy is checked, not only the rooting point. A bed whose members
    // all stand inside the room while their crowns grow through its wall is
    // exactly the collision this binding exists to catch, and testing one point
    // per member would report it clean. The recipe is derived once and its
    // corner box is carried through each member's own transform.
    const recipe = byDomain.get(cluster.domain);
    const canopy =
      recipe !== undefined &&
      validatePlantingDomain({ domain: recipe }).success === true
        ? (growPlanting(recipe).bounds ?? null)
        : null;
    for (const placement of arrangement.placements) {
      const outside =
        space !== undefined && space.cells.length > 0
          ? [
              placement.translation,
              ...(canopy === null ? [] : corners(canopy, placement)),
            ].find(
              (point) =>
                builtEnvironmentContainsPoint(
                  environment,
                  installation.space,
                  point,
                ) === false,
            )
          : undefined;
      if (outside !== undefined) {
        out.push(
          "type",
          `${path}.cluster`,
          `member "${placement.id}" reaches outside space "${installation.space}"`,
          outside,
        );
        break;
      }
      if (water === undefined) continue;
      const level = freeSurfaceAt(water, placement.translation);
      if (level === null) {
        out.push(
          "type",
          `${path}.irrigation.fluidDomain`,
          `fluid domain "${water.id}" states no free surface under member "${placement.id}"`,
          placement.translation,
        );
        break;
      }
      if (placement.translation.y > level) {
        out.push(
          "range",
          `${path}.irrigation.fluidDomain`,
          `aquatic member "${placement.id}" is rooted above the free surface of "${water.id}" at ${level}`,
          placement.translation.y,
          placement.translation.y - level,
        );
        break;
      }
    }
  });

  return out.toValidation();
};

/** One installation's derived planting, beside an honest account of it. */
export interface IAutoMoviePlantingFrame {
  /** Identity of the installation the frame belongs to. */
  installation: string;

  /** What the derivation actually did, including anything it declined. */
  analysis: IAutoMovieSoftAnalysis;

  /** The prototype structure every member instances, or `null` when not run. */
  plant: IAutoMoviePlantingState | null;

  /** The deterministic member arrangement, or `null` when not run. */
  arrangement: IAutoMoviePlantingArrangement | null;
}

/**
 * Lower one bound installation to everything a renderer needs, beside an honest
 * account of what was derived.
 *
 * One structure is grown and every member instances it, which is what makes a
 * bed of forty ferns forty transforms rather than forty trees. A recipe that
 * does not validate, a cluster that does not validate, and a cluster paired
 * with a recipe it does not cite each produce `not-run` with a reason and no
 * geometry at all: a plant nobody could derive must never arrive looking like a
 * plant somebody did.
 *
 * @author Samchon
 */
export const lowerPlantingInstallation = (props: {
  installation: IAutoMoviePlantingInstallation;
  cluster: IAutoMoviePlantingCluster;
  domain: IAutoMoviePlantingDomain;
}): IAutoMoviePlantingFrame => {
  const { installation, cluster, domain } = props;
  const analysis = (
    status: IAutoMovieSoftAnalysis["status"],
    reason: string | null,
  ): IAutoMovieSoftAnalysis => ({
    domain: domain.id,
    kind: "planting",
    status,
    reason,
    unsupported: [],
  });
  if (validatePlantingDomain({ domain }).success === false)
    return {
      installation: installation.id,
      analysis: analysis(
        "not-run",
        `planting recipe "${domain.id}" did not validate, so nothing was grown`,
      ),
      plant: null,
      arrangement: null,
    };
  if (validatePlantingCluster({ cluster }).success === false)
    return {
      installation: installation.id,
      analysis: analysis(
        "not-run",
        `planting cluster "${cluster.id}" did not validate, so nothing was arranged`,
      ),
      plant: null,
      arrangement: null,
    };
  // The two records arrive separately, so the pairing is checked rather than
  // trusted: arranging one recipe by another's seed would produce a bed that
  // looks derived and answers for nothing that was authored.
  if (cluster.domain !== domain.id)
    return {
      installation: installation.id,
      analysis: analysis(
        "not-run",
        `planting cluster "${cluster.id}" grows recipe "${cluster.domain}", not the supplied "${domain.id}"`,
      ),
      plant: null,
      arrangement: null,
    };
  return {
    installation: installation.id,
    analysis: analysis("derived", null),
    plant: growPlanting(domain),
    arrangement: arrangePlantingCluster(cluster),
  };
};

/** Re-path one nested validation onto the address the binding knows it by. */
const repath = (
  out: ViolationCollector,
  path: string,
  validation: IAutoMovieValidation,
): void => {
  if (validation.success === true) return;
  for (const item of validation.violations)
    out.items.push({ ...item, path: item.path.replace("$input", path) });
};

/**
 * The eight corners of one derived canopy, carried into world space by one
 * member's own transform.
 *
 * The recipe's bounds are in the recipe's frame with the trunk's base at the
 * origin, so every corner is rotated by the member's unit quaternion, scaled
 * per axis, and translated. A rotated box therefore widens rather than being
 * silently re-fitted, exactly as a staged prop's clearance volume does.
 */
const corners = (
  bounds: { min: IAutoMovieVector3; max: IAutoMovieVector3 },
  placement: IAutoMoviePlantingPlacement,
): IAutoMovieVector3[] => {
  const { x: qx, y: qy, z: qz, w: qw } = placement.rotation;
  const out: IAutoMovieVector3[] = [];
  for (const x of [bounds.min.x, bounds.max.x])
    for (const y of [bounds.min.y, bounds.max.y])
      for (const z of [bounds.min.z, bounds.max.z]) {
        const sx = x * placement.scale.x;
        const sy = y * placement.scale.y;
        const sz = z * placement.scale.z;
        // q * v * q⁻¹, written as the cross-product form so no matrix has to be
        // built for eight points.
        const tx = 2 * (qy * sz - qz * sy);
        const ty = 2 * (qz * sx - qx * sz);
        const tz = 2 * (qx * sy - qy * sx);
        out.push({
          x: placement.translation.x + sx + qw * tx + qy * tz - qz * ty,
          y: placement.translation.y + sy + qw * ty + qz * tx - qx * tz,
          z: placement.translation.z + sz + qw * tz + qx * ty - qy * tx,
        });
      }
  return out;
};

/**
 * The free-surface elevation of one fluid domain under a world point, or `null`
 * when that domain cannot answer for the point at all.
 *
 * Read from the authored bed and depth rather than from a solve: a binding is a
 * statement about the design, and integrating a pond to decide whether a reed
 * is planted in it would make the answer depend on a shot second nobody named.
 *
 * `null` covers both ways the question can be unanswerable — a point outside
 * the lattice, and a lattice whose bed or depth array does not reach the cell —
 * because a fluid domain arrives here from another binding's validation and
 * this one must not read past the end of an array and compare against `NaN`. A
 * comparison against `NaN` is false, which would make a malformed pond report
 * every reed as properly planted.
 */
const freeSurfaceAt = (
  domain: IAutoMovieFluidDomain,
  point: { x: number; y: number; z: number },
): number | null => {
  const column = Math.floor(
    (point.x - domain.grid.origin.x) / domain.grid.cellX,
  );
  const row = Math.floor((point.z - domain.grid.origin.z) / domain.grid.cellZ);
  if (column < 0 || column >= domain.grid.columns) return null;
  if (row < 0 || row >= domain.grid.rows) return null;
  const cell = row * domain.grid.columns + column;
  const level = domain.grid.origin.y + domain.bed[cell] + domain.depth[cell];
  return Number.isFinite(level) ? level : null;
};
