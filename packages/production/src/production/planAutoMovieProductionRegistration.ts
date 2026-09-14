import { compareCodeUnits } from "./contentIdentity";

/**
 * Settle how one project open treats a production's tracked registration and
 * this checkout's incarnation of it.
 *
 * The registry, `automovie/productions.json`, is portable identity. It names
 * the productions a project registered and the design layout they use, it is
 * tracked beside the design records it names, and every checkout of the same
 * history reads the same record, so a new clone opens the production its
 * origin checkout registered. The plan publishes only that portable record and
 * only when an open changes it: reopening a registered production leaves the
 * tracked bytes alone, and a record that still carries the retired inline
 * `incarnations` member is rewritten once without it.
 *
 * A production incarnation is not identity. It is the generation of one
 * checkout's local namespace for that production, resident in the ignored
 * `automovie/productions/<production>/incarnation.json`, and an open project
 * handle compares it to refuse a namespace that was deleted and registered
 * again under the same id. Each checkout therefore issues its own. A record the
 * registry does not name belongs to a namespace that ended, so it is discarded
 * before the registration is published and a new generation is issued after,
 * which leaves no instant at which the registry names a production beside a
 * generation from its previous life. The record lives and ends with the local
 * namespace rather than in tracked history, so restoring an older registry
 * from version control cannot bring an old generation back.
 *
 * A read-only open neither registers nor issues. It refuses a production the
 * registry does not name and a registered production this checkout holds no
 * incarnation of, and names the build that initializes both.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Keeps the production namespace a result preserves in the tracked registration every checkout reads, never in state one checkout issued.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Publishes only the portable registration a new checkout takes as its namespace input and keeps each checkout's incarnation out of it.
 * @evidence requirements/operations-and-recovery/concurrent-runs-and-locking.md#operations-late-writer-fencing Issues a new generation whenever an id is registered again, so a handle from the deleted namespace cannot write into its successor.
 * @evidence specifications/execution-and-recovery/concurrent-ownership-and-locking.md#execution-fencing-late-writer Discards an ended namespace's generation before registration and never adopts it, so the expected target generation a stale handle holds no longer matches.
 */
export const planAutoMovieProductionRegistration = (props: {
  /** Resident registry after validation, or `null` when this checkout has none. */
  registry: {
    /** Registered production ids. */
    productions: readonly string[];
    /** Design layout version the resident record declares. */
    layoutVersion: number;
    /** Whether the resident record still carries the retired inline `incarnations` member. */
    retiredLineage: boolean;
  } | null;
  /** Selected production id, already validated by the project store. */
  productionId: string;
  /** Whether this checkout holds an incarnation record for that production. */
  incarnationPresent: boolean;
  /** Whether this open may write project state. */
  mutable: boolean;
}): {
  /** Portable registry to publish, or `null` to leave the resident bytes untouched. */
  publish: {
    /** Registry record version. */
    version: 1;
    /** Design layout version, carried over from the resident record. */
    layoutVersion: number;
    /** Registered production ids in code-unit order. */
    productions: string[];
  } | null;
  /** Remove the resident incarnation record before anything is published. */
  discard: boolean;
  /** Issue a new incarnation after publishing instead of adopting the resident one. */
  issue: boolean;
} => {
  const registry = props.registry;
  const registered =
    registry !== null && registry.productions.includes(props.productionId);
  if (props.mutable === false) {
    if (registered === false)
      throw new Error(
        `Read-only verification cannot register missing production "${props.productionId}". Run npm run build once to initialize it.`,
      );
    if (props.incarnationPresent === false)
      throw new Error(
        `Read-only verification requires this checkout's incarnation of production "${props.productionId}". Run npm run build once to initialize it.`,
      );
    return { publish: null, discard: false, issue: false };
  }
  if (registry !== null && registered)
    return {
      publish: registry.retiredLineage
        ? {
            version: 1,
            layoutVersion: registry.layoutVersion,
            productions: [...registry.productions].sort(compareCodeUnits),
          }
        : null,
      discard: false,
      issue: props.incarnationPresent === false,
    };
  return {
    publish: {
      version: 1,
      layoutVersion: registry?.layoutVersion ?? 0,
      productions: [...(registry?.productions ?? []), props.productionId].sort(
        compareCodeUnits,
      ),
    },
    discard: props.incarnationPresent,
    issue: true,
  };
};
