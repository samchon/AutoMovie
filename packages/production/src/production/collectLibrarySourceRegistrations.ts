import type {
  IAutoMovieDiagnostic,
  IAutoMovieLibraryBuildContext,
  IAutoMovieLibraryContribution,
} from "@automovie/interface";
import typia from "typia";

import { admitAutoMovieLibraryDerivedContribution } from "./admitAutoMovieLibraryDerivedContribution";
import { compareCodeUnits } from "./contentIdentity";
import { autoMovieLibraryContributionDiagnostics } from "./libraryContributionContract";
import type { ICompiledLibraryOwnerRegistration } from "./productionSourceBuild";
import type { resolveAutoMovieSourceOwnerBinding } from "./sourceOwnerBinding";

/**
 * Collect the owner registrations one evaluated library module carries.
 *
 * Module evaluation is the only step that needs Node's loader, so it arrives as
 * `load` and runs inside the same failure boundary as every build call. What
 * this owns is everything after evaluation: discovering each export that names
 * a `design`, refusing an address the authoring declaration does not own,
 * admitting the exact graph-selected owner edge before anything runs, and
 * obtaining the contribution either from `build(context)` or, for a
 * precomputed owner, from its selected derived artifact through the shared
 * structured JSON ingress. Both forms then meet the same contribution schema
 * and branch rules.
 *
 * A refusal names the input that has to change. An executed owner's schema or
 * branch refusal points at its source file. A precomputed owner's points at the
 * derived artifact, because the correction belongs to that artifact's generator
 * rather than to anything the source returned.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Registers each contribution under the exact source path, export and design address whose owner edge was admitted, and attributes each refusal to that export or to the artifact it selected.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-derivation-output-lineage Admits the graph-selected path, export and Markdown target as one owner edge before invoking build or reading a derived contribution, and refuses an export whose runtime claim names another owner.
 * @author Samchon
 */
export const collectLibrarySourceRegistrations = (props: {
  /** Project-relative source path selected by a reviewed source binding. */
  path: string;
  /** Evaluate the selected module and return its named exports. */
  load: () => Readonly<Record<string, unknown>>;
  /** Build context for an address the active authoring population owns. */
  context: (design: string) => IAutoMovieLibraryBuildContext | null;
  /** Admit the exact graph-selected owner edge before invoking build(). */
  admit: (
    exportName: string,
    design: string,
  ) => ReturnType<typeof resolveAutoMovieSourceOwnerBinding>;
}): {
  registrations: ICompiledLibraryOwnerRegistration[];
  diagnostics: IAutoMovieDiagnostic[];
} => {
  const target = `library-source:${props.path}`;
  const diagnostics: IAutoMovieDiagnostic[] = [];
  const registrations: ICompiledLibraryOwnerRegistration[] = [];
  let current = "the module";
  try {
    const exports = props.load();
    const discovered = Object.keys(exports)
      .sort(compareCodeUnits)
      .flatMap((name) => {
        const value = exports[name];
        if (
          value === null ||
          typeof value !== "object" ||
          !("design" in value) ||
          typeof value.design !== "string"
        )
          return [];
        const build =
          "build" in value && typeof value.build === "function"
            ? (value.build as (
                context: IAutoMovieLibraryBuildContext,
              ) => unknown)
            : undefined;
        if (build === undefined && !("derivedArtifact" in value)) return [];
        return [
          {
            name,
            design: value.design,
            derived: "derivedArtifact" in value,
            artifact:
              "derivedArtifact" in value &&
              typeof value.derivedArtifact === "string"
                ? value.derivedArtifact
                : null,
            build,
          },
        ];
      });
    for (const entry of discovered) {
      current = `export "${entry.name}"`;
      const context = props.context(entry.design);
      if (context === null) {
        diagnostics.push({
          code: "source-registration-mismatch",
          category: "error",
          phase: "source",
          target: `${target}:${entry.name}`,
          path: props.path,
          message: `Library source export "${entry.name}" registers design owner ${JSON.stringify(entry.design)}, which is not an exact active design document and H2 anchor in this project's authoring declaration. Register one "docs/<branch>/<document>.md#<anchor>" address the graph already selects, or remove the export.`,
        });
        continue;
      }
      const admission = props.admit(entry.name, entry.design);
      if (admission.success === false) {
        diagnostics.push({
          code: "source-owner-mismatch",
          category: "error",
          phase: "source",
          target: `${target}:${entry.name}`,
          path: props.path,
          message: admission.message,
        });
        continue;
      }
      let value: unknown;
      // The derived artifact a precomputed owner selected, which is where its
      // schema and branch refusals send the author; null for an executed owner.
      let artifact: string | null = null;
      if (entry.derived) {
        const admitted = admitAutoMovieLibraryDerivedContribution({
          source: props.path,
          exportName: entry.name,
          derivedArtifact: entry.artifact,
          build: entry.build !== undefined,
          derivedArtifacts: context.derivedArtifacts,
        });
        if (admitted.success === false) {
          diagnostics.push(admitted.diagnostic);
          continue;
        }
        value = admitted.value;
        // Admission resolves only an own current path, so a string was named.
        artifact = entry.artifact!;
      } else {
        value = entry.build!(structuredClone(context));
        if (
          value !== null &&
          typeof value === "object" &&
          "then" in value &&
          typeof value.then === "function"
        ) {
          diagnostics.push({
            code: "source-export-invalid",
            category: "error",
            phase: "source",
            target: `${target}:${entry.name}`,
            path: props.path,
            message: `Library owner export "${entry.name}" returned a Promise. Return a synchronous deterministic library contribution from ${props.path}.`,
          });
          continue;
        }
      }
      const generatorCorrection =
        artifact === null
          ? null
          : `Correct the generator of derived artifact "${artifact}" selected by export "${entry.name}" in ${props.path}, run the explicit generation command, and compile again.`;
      const validation =
        typia.validateEquals<IAutoMovieLibraryContribution>(value);
      if (validation.success === false) {
        for (const error of validation.errors)
          diagnostics.push({
            code: "source-export-invalid",
            category: "error",
            phase: "source",
            target: `${target}:${entry.name}`,
            path: artifact ?? props.path,
            message: `${error.path} expects ${error.expected}. ${generatorCorrection ?? `Fix the returned library contribution in ${props.path}.`}`,
          });
        continue;
      }
      const contribution = {
        ...validation.data,
        contexts: validation.data.contexts ?? [],
      };
      const contributionDiagnostics =
        context.branch === "productionSources"
          ? []
          : autoMovieLibraryContributionDiagnostics(
              context.branch,
              contribution,
            );
      for (const message of contributionDiagnostics)
        diagnostics.push({
          code: "source-export-invalid",
          category: "error",
          phase: "source",
          target: `${target}:${entry.name}`,
          path: artifact ?? props.path,
          message:
            generatorCorrection === null
              ? message
              : `${message} ${generatorCorrection}`,
        });
      if (contributionDiagnostics.length !== 0) continue;
      registrations.push({
        export: entry.name,
        design: entry.design,
        // Normalized once, here, where every executed owner passes. `contexts`
        // is optional on the contract so a library source written before it
        // existed still satisfies the shape; every reader after this point is
        // owed a list, and three of them were each deciding that for
        // themselves.
        contribution,
      });
    }
  } catch (error) {
    const message =
      typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);
    return {
      registrations: [],
      diagnostics: [
        ...diagnostics,
        {
          code: "source-execution-failed",
          category: "error",
          phase: "source",
          target,
          path: props.path,
          message: `Library source ${current} in ${props.path} failed while building its contribution: ${message}. No generated artifact was published. Correct the operation or precondition named by this fact, then rerun the same compile scope.`,
        },
      ],
    };
  }
  return { registrations, diagnostics };
};
