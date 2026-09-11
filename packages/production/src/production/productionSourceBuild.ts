import {
  IAutoMovieDefinedShotContract,
  IAutoMovieDiagnostic,
  IAutoMovieEnvironmentContext,
  IAutoMovieLibraryBuildContext,
  IAutoMovieLibraryContribution,
} from "@automovie/interface";
import { createRequire } from "node:module";
import path from "node:path";
import typia, { IValidation } from "typia";

import {
  canonicalAutoMovieJsonBytes,
  compareCodeUnits,
} from "./contentIdentity";
import { autoMovieLibraryContributionDiagnostics } from "./libraryContributionContract";
import { resolveAutoMovieSourceOwnerBinding } from "./sourceOwnerBinding";

interface ISourceBuildProps<T> {
  target: string;
  label: string;
  path: string;
  exportName: string;
  source: string;
  context: unknown;
  /** Reader for project source this module imports. */
  sourceRoot: string;
  /** Expected source-owned defineShot registration, for one shot module. */
  registration?: {
    id: string;
    contract: IAutoMovieDefinedShotContract;
  };
  validate(input: unknown): IValidation<T>;
}

/** A source result and diagnostics produced while reading its registration and output. */
export interface ISourceBuildResult<T> {
  /** The validated build value, or null when source execution failed. */
  value: T | null;
  /** Failures and warnings observed while loading and validating the source. */
  diagnostics: IAutoMovieDiagnostic[];
  /** Source-owned scene captured from a validated defineShot registration. */
  registrationScene?: string;
}

/** Load a project module through Node and validate its selected registration and build result.
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Loads project modules with ordinary Node execution and validates their results.
 */
export const buildSourceExport = <T>(
  props: ISourceBuildProps<T>,
): ISourceBuildResult<T> => {
  const diagnostics: IAutoMovieDiagnostic[] = [];
  let registrationScene: string | undefined;
  try {
    const require = createRequire(path.join(props.sourceRoot, "package.json"));
    const exports = require(
      path.resolve(props.sourceRoot, props.path),
    ) as Record<
      string,
      | {
          id?: unknown;
          scene?: unknown;
          contract?: unknown;
          build?: (context: unknown) => unknown;
        }
      | undefined
    >;
    const entry = exports[props.exportName];
    if (typeof entry?.build !== "function")
      return {
        value: null,
        diagnostics: [
          ...diagnostics,
          {
            code: "source-export-missing",
            category: "error",
            phase: "source",
            target: props.target,
            path: props.path,
            message: `Export "${props.exportName}" with a build(context) function was not found. Add that named export to ${props.path}.`,
          },
        ],
      };
    if (props.registration !== undefined) {
      const registration = typeof entry.id === "string" ? entry : null;
      const contractMatches =
        registration !== null &&
        typeof registration.contract === "object" &&
        registration.contract !== null &&
        Buffer.from(canonicalAutoMovieJsonBytes(registration.contract)).equals(
          Buffer.from(canonicalAutoMovieJsonBytes(props.registration.contract)),
        );
      if (
        registration === null ||
        registration.id !== props.registration.id ||
        typeof registration.scene !== "string" ||
        registration.scene.trim().length === 0 ||
        contractMatches === false
      )
        return {
          value: null,
          diagnostics: [
            ...diagnostics,
            {
              code: "source-registration-mismatch",
              category: "error",
              phase: "source",
              target: props.target,
              path: props.path,
              message:
                registration === null
                  ? `Contract id "${props.registration.id}" points to export "${props.exportName}" in ${props.path}, but that export is not a defineShot registration. Export defineShot("${props.registration.id}", { scene, contract, build }) so module path, named export, id, and measurable contract identify one artifact.`
                  : `Contract id "${props.registration.id}" points to export "${props.exportName}" in ${props.path}, but its registration has id ${JSON.stringify(registration.id)}, scene ${JSON.stringify(registration.scene)}, or a contract that differs from the design. Make the defineShot registration id and measurable contract exactly match the selected design contract, and keep scene non-blank.`,
            },
          ],
        };
      registrationScene = registration.scene;
    }
    const value = entry.build(props.context);
    if (
      value !== null &&
      typeof value === "object" &&
      "then" in value &&
      typeof value.then === "function"
    )
      return {
        value: null,
        diagnostics: [
          ...diagnostics,
          {
            code: "source-export-invalid",
            category: "error",
            phase: "source",
            target: props.target,
            path: props.path,
            message: `Export "${props.exportName}" returned a Promise. Return a synchronous deterministic ${props.label} from ${props.path}.`,
          },
        ],
      };
    const validation = props.validate(value);
    if (validation.success === false)
      return {
        value: null,
        diagnostics: [
          ...diagnostics,
          ...validation.errors.map(
            (error): IAutoMovieDiagnostic => ({
              code: "source-export-invalid",
              category: "error",
              phase: "source",
              target: props.target,
              path: props.path,
              message: `${error.path} expects ${error.expected}. Fix the returned ${props.label} in ${props.path}.`,
            }),
          ),
        ],
      };
    return { value: validation.data, diagnostics, registrationScene };
  } catch (error) {
    const message =
      typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);
    return {
      value: null,
      diagnostics: [
        ...diagnostics,
        {
          code: "source-execution-failed",
          category: "error",
          phase: "source",
          target: props.target,
          path: props.path,
          message: `Source export "${props.exportName}" in ${props.path} failed while building ${props.label}: ${message}. No generated artifact was published. Correct the operation or precondition named by this fact, then rerun the same compile scope.`,
        },
      ],
    };
  }
};

/**
 * Which generated file each executed library owner is answerable for.
 *
 * The film path reads its targets back out of the design graph, because a shot
 * file is named after the shot it compiles. A library artifact is named after
 * the environment or model inside it, so the index the same publication just
 * produced is what says whose it is; nothing has to be parsed out of a path.
 */
/** One owner registration a library source module exported and returned. */
export interface ICompiledLibraryOwnerRegistration {
  /** Named export the registration was found under. */
  export: string;
  /** Exact design-document and H2 address the export registered. */
  design: string;
  /**
   * Validated contribution the export's build function returned.
   *
   * `contexts` is definite here where the contract leaves it optional. The
   * contract is optional so a library source written before the field existed
   * still satisfies the shape; inside the compile every reader is owed a list,
   * and three of them were each deciding that for themselves.
   */
  contribution: IAutoMovieLibraryContribution & {
    contexts: IAutoMovieEnvironmentContext[];
  };
}

/**
 * Run one library source module and collect the owners it registers.
 *
 * The module graph is prepared exactly as a shot's is, so a library owner is
 * held to the same determinism rules and reaches the same engine surface. What
 * differs is only what happens after evaluation: instead of invoking one export
 * the builder already knew the name of, this discovers however many owner
 * registrations the module carries and invokes each against its own address.
 *
 * An address the active authoring declaration does not own is refused here
 * rather than silently skipped, because a module that builds a subject no
 * reviewed decision asked for would publish an artifact no review ever charges
 * an observation on.
 */
export const buildLibrarySource = (props: {
  /** Project-relative source path selected by a reviewed source binding. */
  path: string;
  /** Normalized source text of that file. */
  source: string;
  /** Reader for project source this module imports. */
  sourceRoot: string;
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
    const require = createRequire(path.join(props.sourceRoot, "package.json"));
    const exports = require(
      path.resolve(props.sourceRoot, props.path),
    ) as Record<string, unknown>;
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
      if (entry.derived) {
        const artifact =
          entry.artifact === null
            ? undefined
            : Object.hasOwn(context.derivedArtifacts, entry.artifact)
              ? context.derivedArtifacts[entry.artifact]
              : undefined;
        if (
          entry.build ||
          artifact === undefined ||
          artifact.encoding !== "utf8"
        ) {
          diagnostics.push({
            code: "source-export-invalid",
            category: "error",
            phase: "source",
            target: `${target}:${entry.name}`,
            path: props.path,
            message: `Library owner export "${entry.name}" must select exactly one current UTF-8 derived artifact and omit build(). Received ${JSON.stringify(entry.artifact)}. Generate the declared artifact explicitly before compiling.`,
          });
          continue;
        }
        value = JSON.parse(artifact.content) as unknown;
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
      const validation =
        typia.validateEquals<IAutoMovieLibraryContribution>(value);
      if (validation.success === false) {
        for (const error of validation.errors)
          diagnostics.push({
            code: "source-export-invalid",
            category: "error",
            phase: "source",
            target: `${target}:${entry.name}`,
            path: props.path,
            message: `${error.path} expects ${error.expected}. Fix the returned library contribution in ${props.path}.`,
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
          path: props.path,
          message,
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
