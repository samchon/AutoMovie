/**
 * What one read-only source gate run read that no input fingerprint carries.
 *
 * Screenplay and determinism validation read author-owned documents, and a
 * camera clearance evaluation reads the project revision into the report it
 * keeps. A later check that wants to reuse the answer must read exactly those
 * documents again and must know whether the revision number itself became part
 * of the answer, so the builder fills one trace while the gate runs.
 *
 * @author Samchon
 */
export interface IAutoMovieProductionSourceGateTrace {
  /**
   * Every author-owned document the gate read, in read order, with the text it
   * saw or `null` when the document was absent. A repeated read is kept.
   */
  documents: Array<{
    /** Project-relative document path. */
    path: string;

    /** Text the gate read, or `null` when the document was absent. */
    content: string | null;
  }>;

  /** Whether a clearance evaluation read the project revision. */
  revisionBound: boolean;
}
