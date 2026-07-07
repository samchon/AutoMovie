import {
  IAutoMovieChannel,
  IAutoMovieChannelLimit,
  IAutoMovieDriver,
  IAutoMovieProfile,
  IAutoMovieProfileBinding,
} from "@automovie/interface";

/**
 * One application of a profile onto a concrete subtree: the reusable profile
 * data, the binding that maps its semantic keys onto real node ids, and the
 * optional placement prefix a bridged actor's nodes carry
 * (`sceneToNodes`/`motionToClip` naming — `"actor/"` turns `hips` into
 * `actor/hips`).
 */
export interface IAutoMovieProfileApplication {
  /** The profile being applied. */
  profile: IAutoMovieProfile;

  /** Where it lives this time (`boneMap`: semantic key → concrete node id). */
  binding: IAutoMovieProfileBinding;

  /**
   * Placement prefix prepended to every mapped node id, matching the
   * `nodePrefix` the scene bridge lowered the subtree with. Defaults to `""`.
   */
  nodePrefix?: string;
}

/** A profile's declared limits/drivers, resolved onto concrete node ids. */
export interface IAutoMovieBoundProfile {
  /** The profile's limits with every node reference made concrete. */
  limits: IAutoMovieChannelLimit[];

  /** The profile's drivers with every node reference made concrete. */
  drivers: IAutoMovieDriver[];
}

/**
 * Bind a profile onto a concrete subtree: resolve every semantic node reference
 * in the profile's declared `limits` and `drivers` through the binding's
 * `boneMap` (then the placement `nodePrefix`), yielding limits and drivers
 * `resolveFrame` can consume directly. This is what makes "profiles are data,
 * not code" executable — a door profile's hinge limit or a humanoid profile's
 * eye aim becomes a live constraint/driver on the bound nodes.
 *
 * Node channels and driver node fields go through the map; **pointer channels
 * pass through untouched** (an RFC-6901 pointer addresses a global property,
 * not a subtree node). A semantic key missing from `boneMap` — or mapping to an
 * empty id — **throws**: a binding that silently dropped a declared constraint
 * would un-constrain the rig without a trace, the exact silent drop the engine
 * refuses everywhere else ({@link motionToClip}, sampled channel validation).
 *
 * @author Samchon
 */
export const bindProfile = (
  application: IAutoMovieProfileApplication,
): IAutoMovieBoundProfile => {
  const { profile, binding } = application;
  const prefix = application.nodePrefix ?? "";
  if (binding.profile !== profile.id)
    throw new Error(
      `binding targets profile "${binding.profile}" but was applied to "${profile.id}"`,
    );

  const mapNode = (key: string): string => {
    const mapped = binding.boneMap[key];
    if (mapped === undefined)
      throw new Error(
        `profile "${profile.id}" binding has no boneMap entry for "${key}"`,
      );
    if (mapped.trim().length === 0)
      throw new Error(
        `profile "${profile.id}" binding maps "${key}" to an empty node id`,
      );
    return `${prefix}${mapped}`;
  };

  const mapChannel = (channel: IAutoMovieChannel): IAutoMovieChannel =>
    channel.kind === "node"
      ? { ...channel, node: mapNode(channel.node) }
      : channel;

  const limits = profile.limits.map(
    (limit): IAutoMovieChannelLimit => ({
      ...limit,
      channel: mapChannel(limit.channel),
    }),
  );
  const drivers = profile.drivers.map((driver) =>
    mapDriver(driver, mapNode, mapChannel),
  );
  return { limits, drivers };
};

/** Remap every node reference one driver carries, exhaustively by type. */
const mapDriver = (
  driver: IAutoMovieDriver,
  mapNode: (key: string) => string,
  mapChannel: (channel: IAutoMovieChannel) => IAutoMovieChannel,
): IAutoMovieDriver => {
  switch (driver.type) {
    case "copy":
      return {
        ...driver,
        owner: mapNode(driver.owner),
        source: mapNode(driver.source),
      };
    case "aim":
      return {
        ...driver,
        owner: mapNode(driver.owner),
        target: mapNode(driver.target),
      };
    case "ik":
      return {
        ...driver,
        chain: driver.chain.map(mapNode),
        goal: mapNode(driver.goal),
        pole:
          driver.pole === null
            ? null
            : {
                ...driver.pole,
                node:
                  driver.pole.node === null ? null : mapNode(driver.pole.node),
              },
      };
    case "parent":
      return {
        ...driver,
        owner: mapNode(driver.owner),
        parent: mapNode(driver.parent),
      };
    case "driven":
      return {
        ...driver,
        output: mapChannel(driver.output),
        source: mapChannel(driver.source),
      };
    case "spring":
      return {
        ...driver,
        chain: driver.chain.map(mapNode),
        center: driver.center === null ? null : mapNode(driver.center),
      };
    default: {
      const unknown = driver as { type?: unknown };
      throw new Error(`unknown driver type "${String(unknown.type)}"`);
    }
  }
};

/**
 * Every semantic node key a profile references — the exact set of `boneMap`
 * entries {@link bindProfile} will demand. Walks the same references
 * `mapDriver`/`mapChannel` remap (limit node channels; each driver's node
 * fields; pointer channels excluded), deduplicated in first-reference order, so
 * a gate (forgeProp) can report **every** missing mapping in one correction
 * round instead of surfacing bindProfile's first throw at a time.
 */
export const profileSemanticKeys = (profile: IAutoMovieProfile): string[] => {
  const keys: string[] = [];
  const seen = new Set<string>();
  const add = (key: string): void => {
    if (seen.has(key)) return;
    seen.add(key);
    keys.push(key);
  };
  const addChannel = (channel: IAutoMovieChannel): void => {
    if (channel.kind === "node") add(channel.node);
  };

  for (const limit of profile.limits) addChannel(limit.channel);
  for (const driver of profile.drivers)
    switch (driver.type) {
      case "copy":
        add(driver.owner);
        add(driver.source);
        break;
      case "aim":
        add(driver.owner);
        add(driver.target);
        break;
      case "ik":
        driver.chain.forEach(add);
        add(driver.goal);
        if (driver.pole !== null && driver.pole.node !== null)
          add(driver.pole.node);
        break;
      case "parent":
        add(driver.owner);
        add(driver.parent);
        break;
      case "driven":
        addChannel(driver.output);
        addChannel(driver.source);
        break;
      case "spring":
        driver.chain.forEach(add);
        if (driver.center !== null) add(driver.center);
        break;
      default: {
        const unknown = driver as { type?: unknown };
        throw new Error(`unknown driver type "${String(unknown.type)}"`);
      }
    }
  return keys;
};
