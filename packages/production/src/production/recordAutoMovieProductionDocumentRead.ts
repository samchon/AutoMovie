import type { IAutoMovieProductionSourceGateTrace } from "./IAutoMovieProductionSourceGateTrace";

/**
 * Wrap one author-owned document reader so every read lands in the gate trace.
 *
 * A builder that hands this one reader to every validation that reads prose gets
 * a trace holding each path in the order it was read with the exact text that
 * validation saw, a repeated read included. A read that throws records nothing
 * and propagates, because the gate run it belongs to fails with it. Without a
 * trace the reader is returned as it was, so an ordinary compile or lint pays
 * nothing for it.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Records the exact document text a gate answer was judged from.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Captures the document part of the snapshot a gate answer referenced.
 */
export const recordAutoMovieProductionDocumentRead = (props: {
  /** Trace of the running gate, or `undefined` when nothing records. */
  trace: IAutoMovieProductionSourceGateTrace | undefined;

  /** Reader the validation would otherwise call directly. */
  read: (relativePath: string) => string | null;
}): ((relativePath: string) => string | null) => {
  const trace = props.trace;
  if (trace === undefined) return props.read;
  return (relativePath) => {
    const content = props.read(relativePath);
    trace.documents.push({ path: relativePath, content });
    return content;
  };
};
