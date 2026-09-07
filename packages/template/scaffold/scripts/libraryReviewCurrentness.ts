import type {
  AutoMovieContentDigest,
  IAutoMovieCompileProjectOutput,
} from "@automovie/interface";
import { isDeepStrictEqual } from "node:util";

/** Recheck library admission whenever the live authoring reader is reopened. */
export const readLibraryReviewAuthoring = <
  Authoring extends { manifest: { kind: unknown } },
>(
  read: () => Authoring,
): Authoring => {
  const authoring = read();
  if (authoring.manifest.kind !== "library")
    throw new Error(
      `Library review commands require production kind "library", not ${JSON.stringify(authoring.manifest.kind)}.`,
    );
  return authoring;
};

/** Keep source refusal ahead of any observation of compiler-owned topology. */
export const readCurrentLibraryReview = <Authoring, Population>(props: {
  readAuthoring: () => Authoring;
  compile: (
    authoring: Authoring,
    currentAuthoring: () => Authoring,
  ) => IAutoMovieCompileProjectOutput;
  population: (
    authoring: Authoring,
    fingerprint: AutoMovieContentDigest,
  ) => Population;
}) => {
  const authoring = props.readAuthoring();
  const compilation = props.compile(authoring, props.readAuthoring);
  if (compilation.success === false)
    throw new Error(
      `Library review requires a successful current source compile: ${JSON.stringify(compilation.diagnostics)}`,
    );
  const population = props.population(
    authoring,
    compilation.compiler.inputFingerprint,
  );
  if (isDeepStrictEqual(authoring, props.readAuthoring()) === false)
    throw new Error(
      "Library authoring changed while reading review requirements.",
    );
  return { compilation, population };
};

/** Reopen the same source and observation basis before publishing a receipt. */
export const assertCurrentLibraryReview = <Population>(props: {
  expected: {
    compilation: IAutoMovieCompileProjectOutput;
    population: Population;
  };
  read: () => {
    compilation: IAutoMovieCompileProjectOutput;
    population: Population;
  };
}): void => {
  const current = props.read();
  if (
    current.compilation.compiler.inputFingerprint !==
      props.expected.compilation.compiler.inputFingerprint ||
    isDeepStrictEqual(current.population, props.expected.population) === false
  )
    throw new Error(
      "Library source, generated output, or observation plan changed before publication.",
    );
};
