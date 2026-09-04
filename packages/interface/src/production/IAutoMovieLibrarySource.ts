import { IAutoMovieEnvironmentContext } from "../analysis/IAutoMovieEnvironmentContext";
import { IAutoMovieBuiltEnvironment } from "../architecture/IAutoMovieBuiltEnvironment";
import { IAutoMovieModel } from "../model/IAutoMovieModel";
import { AutoMovieContentDigest } from "./IAutoMovieProductionDesign";

/**
 * What one library source module is told about the owner it is building.
 *
 * A library has no shot, so a library owner receives no scene, no clock, and no
 * staged world. What it receives is its own address, because the module has to
 * be able to state which reviewed decision it is realizing without reading a
 * file. Everything else a deterministic builder needs is either arithmetic it
 * does itself or a named import from the sandbox engine surface.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Carries the exact owner address a materialized library artifact is traced back through.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Types the declared input a library derivation attempt receives.
 * @author Samchon
 */
export interface IAutoMovieLibraryBuildContext {
  /** Production namespace this library is compiled under. */
  production: string;
  /** Active design branch the owner belongs to, such as `spaces`. */
  branch: string;
  /** Project-relative POSIX path of the reviewed design document. */
  design: string;
  /** Exact H2 anchor of the reviewed decision this owner realizes. */
  anchor: string;
}

/**
 * What one library source owner hands back to the compiler.
 *
 * Every payload is one a consumer already reads. A built environment becomes
 * the compiled topology the required observation population is derived from, a
 * model becomes the compiled recipe a canonical turntable is judged against,
 * and an adopted environment context becomes the world a map owner is measured
 * against. Completion is branch-specific: a map owner returns at least one
 * context, a model owner at least one model, and a space owner at least one
 * environment, without borrowing another branch's carrier. Material, instance,
 * motion, and system sources remain valid authoring populations, but cannot be
 * materialized as standalone library results until their own public carrier
 * exists.
 *
 * `contexts` is optional where the other two are required, and the asymmetry is
 * the upgrade rather than a preference: every library source written before it
 * existed returns the two, and a project that has not been touched since is not
 * in error. An absent list and an empty one say the same thing here -- this
 * owner adopted no world at the DTO boundary. The compiler nevertheless
 * refuses an empty map-owner completion, because absence is not delivery.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Fixes the exact result a library source revision is allowed to produce.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types the derived library state one executed source revision is allowed to produce.
 * @author Samchon
 */
export interface IAutoMovieLibraryContribution {
  /** Structured built environments a `spaces` owner publishes, in author order. */
  environments: IAutoMovieBuiltEnvironment[];
  /** Reusable models a `models` owner publishes, in author order. */
  models: IAutoMovieModel[];
  /**
   * Adopted environment contexts this owner publishes, in author order.
   *
   * A map owner adopts the world its work is designed against -- the north it
   * is oriented to, the ground its elevations are measured from, and the
   * instants it is answered at. Until this existed the production design
   * carried exactly one context for the whole production and no owner
   * contributed it, so no map owner could be measured against anything: the
   * derived population was empty and an empty population passes every check
   * that compares against it.
   * Only a `maps` owner may use this carrier as its completed result.
   */
  contexts?: IAutoMovieEnvironmentContext[];
}

/**
 * One named export a library source module registers as a design owner.
 *
 * The registration names the reviewed H2 it realizes, which is what lets a
 * compiled artifact be attributed to a design decision without a second table
 * mapping files to documents. A module may export several of these, and a
 * module may export none when it is a helper the owners import.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Binds one executed source export to the exact reviewed owner its output realizes.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types the source-side registration the derived library state is produced from.
 * @author Samchon
 */
export interface IAutoMovieLibrarySourceOwner {
  /**
   * Exact `docs/<branch>/<document>.md#<anchor>` address this export realizes.
   *
   * The address is the registration. A spelling that is not an active design
   * owner unit is refused by name rather than ignored, because a module that
   * builds a building nobody asked for publishes an artifact no review owes an
   * observation on.
   */
  design: string;
  /** Build this owner's contribution deterministically from its own address. */
  build(context: IAutoMovieLibraryBuildContext): IAutoMovieLibraryContribution;
}

/**
 * What one design owner's executed source published on this compile.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Records which source export and revision each library artifact came from.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types the per-owner derived state one executed source export produced.
 * @author Samchon
 */
export interface IAutoMovieMaterializedLibraryOwner {
  /** Active manifest-derived design branch. */
  branch: string;
  /** Exact design-document and H2 address the artifacts realize. */
  owner: string;
  /** Project-relative source file whose export produced them. */
  source: string;
  /** Named export inside that file. */
  export: string;
  /** Digest of the normalized source bytes that were executed. */
  sourceDigest: AutoMovieContentDigest;
  /** Ids of the built environments this owner published, in code-unit order. */
  environments: string[];
  /** Ids of the models this owner published, in code-unit order. */
  models: string[];
  /**
   * Ids of the environment contexts this owner published, in code-unit order.
   *
   * Optional for the reader's sake, not the writer's. Every compile writes it,
   * so a current index always carries it; but the index is validated exactly,
   * and an index written before this field existed would fail that validation
   * as a whole -- taking the environments down with it and handing
   * `building:report` and `library:review` an empty population, silently, which
   * is the exact failure this field was added to end.
   */
  contexts?: string[];
}

/**
 * The compiler-owned index of everything a library compile materialized.
 *
 * A film reads its own generated output through the shot and model manifests it
 * already publishes. A library has neither, so this index is how a later
 * process -- an offline observation command, a viewer, a second compile --
 * answers which design owner a published building or model belongs to without
 * re-executing source.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Lets every published library artifact be traced to its owner, source, and compile identity.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types the derived index that carries target identity, source snapshot, and output paths.
 * @author Samchon
 */
export interface IAutoMovieMaterializedLibrary {
  /** Closed schema version. */
  version: 1;
  /** Compiler protocol that produced this index. */
  compiler: string;
  /** Production namespace this library was compiled under. */
  production: string;
  /** Compiler input identity this index was derived at. */
  inputFingerprint: AutoMovieContentDigest;
  /** Executed owners in stable branch-and-address order. */
  owners: IAutoMovieMaterializedLibraryOwner[];
}
