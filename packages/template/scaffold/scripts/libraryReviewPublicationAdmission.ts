import type { IAutoMovieLibraryReviewProjectReader } from "@automovie/interface";
import { isDeepStrictEqual } from "node:util";

import type {
  ILibraryReviewPublicationArtifact,
  ILibraryReviewPublicationFile,
  ILibraryReviewPublicationIO,
} from "./libraryReviewPublication";

/**
 * Reopen an in-flight publisher's approved predecessor for its final admission.
 * Only the exact held pending generation is hidden from this scoped reader;
 * ordinary inspect, review and final consumers keep their physical refusal.
 * The reader expires as soon as the predecessor or pending record changes.
 *
 * @author Samchon
 */
export const createLibraryReviewPublicationAdmissionReader = (props: {
  project: IAutoMovieLibraryReviewProjectReader;
  target: string;
  before: ILibraryReviewPublicationFile | null;
  pending: ILibraryReviewPublicationArtifact | null;
  io: ILibraryReviewPublicationIO;
}): IAutoMovieLibraryReviewProjectReader => {
  if (props.pending === null) return props.project;
  const pending = props.pending;
  if (pending.path !== `${props.target}.pending`)
    throw new Error("Library admission does not own this pending path.");
  const assertApproved = (): void => {
    props.io.assertBound();
    if (
      !isDeepStrictEqual(props.io.read(pending.path), pending.file) ||
      !isDeepStrictEqual(props.io.read(props.target), props.before)
    )
      throw new Error(
        "Library admission lost its exact pending record or approved predecessor.",
      );
  };
  assertApproved();
  return {
    root: props.project.root,
    proseDocumentExists: (relative) => {
      if (relative === pending.path) {
        assertApproved();
        return false;
      }
      return props.project.proseDocumentExists === undefined
        ? props.project.readProseDocument(relative) !== null
        : props.project.proseDocumentExists(relative);
    },
    readProseDocument: (relative) => {
      if (relative === pending.path || relative === props.target) {
        assertApproved();
        return relative === pending.path
          ? null
          : (props.before?.source ?? null);
      }
      return props.project.readProseDocument(relative);
    },
    readSource: (relative) => props.project.readSource(relative),
    readRenderFile: (relative) => props.project.readRenderFile(relative),
  };
};
