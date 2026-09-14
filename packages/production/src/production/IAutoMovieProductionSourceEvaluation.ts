import type {
  AutoMovieContentDigest,
  IAutoMovieBuildProjectOutput,
} from "@automovie/interface";

/**
 * One run of the read-only source gate and the reads its answer rests on.
 *
 * The output is what every caller receives. The document reads and the
 * executed module closure are what a later caller needs to decide whether that
 * output still answers for the project without running the gate again. A
 * document is compared by the digest of the text the gate actually read. A
 * project module outside the fingerprinted content has no field that would see
 * its edit, so its presence alone keeps the answer from being reused.
 *
 * @author Samchon
 */
export interface IAutoMovieProductionSourceEvaluation {
  /** The gate's own answer, returned to the caller unchanged. */
  output: IAutoMovieBuildProjectOutput;

  /**
   * Every author-owned document the gate's validation read, in read order, with
   * the digest of the text it saw or `null` when the document was absent.
   */
  documents: Array<{
    /** Project-relative document path. */
    path: string;

    /** Digest of the text the gate read, or `null` when it was absent. */
    digest: AutoMovieContentDigest | null;
  }>;

  /**
   * Project modules the gate executed that no fingerprinted content input
   * covers, as project-relative paths in path order.
   */
  undeclaredModules: string[];

  /**
   * Whether the answer read the project revision into what it judged.
   *
   * A camera clearance report records the geometry revision it measured, so a
   * compiled take with one depends on the revision number itself. An answer that
   * never read it depends only on the observed inputs, and a write that moves no
   * input, such as a render commit, leaves it standing.
   */
  revisionBound: boolean;
}
