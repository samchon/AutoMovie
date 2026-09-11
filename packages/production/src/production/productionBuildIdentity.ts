import type { IAutoMovieProductionEvidence } from "@automovie/evidence";
import {
  AutoMovieContentDigest,
  IAutoMovieBuildProjectInput,
} from "@automovie/interface";

import {
  AutoMovieProductionProject,
  IAutoMovieProductionContentInput,
} from "./AutoMovieProductionProject";
import {
  AUTOMOVIE_BUILD_FINGERPRINT_PROTOCOL,
  IAutoMovieFingerprintField,
  canonicalAutoMovieJsonBytes,
  fingerprintAutoMovieFields,
  normalizeAutoMovieSource,
} from "./contentIdentity";
import { inspectAutoMovieDerivedArtifacts } from "./derivedArtifacts";
import { isTypeScriptSourcePath } from "./productionBuildDiagnostics";
import {
  AUTOMOVIE_PRODUCTION_BUILD_PROTOCOL,
  AUTOMOVIE_PRODUCTION_BUILD_VERSION,
} from "./productionBuildProtocol";
import { FILM_SOURCE_PATH } from "./productionFilmAssembly";

export const contentFingerprintFields = (
  inputs: readonly IAutoMovieProductionContentInput[],
): IAutoMovieFingerprintField[] =>
  inputs.map((content) => ({
    role: `content:${content.path}`,
    kind: content.bytes === null ? "absent" : "file",
    payload:
      content.bytes === null
        ? new Uint8Array()
        : content.source && isTypeScriptSourcePath(content.path)
          ? normalizeAutoMovieSource(content.bytes)
          : content.bytes,
  }));

export const productionBuildInputFingerprint = (
  productionId: string,
  graph: ReturnType<AutoMovieProductionProject["graph"]>,
  sourceFields: readonly IAutoMovieFingerprintField[],
  contentFields: readonly IAutoMovieFingerprintField[],
): AutoMovieContentDigest =>
  fingerprintAutoMovieFields([
    {
      role: "protocol",
      kind: "compile-input",
      payload: Buffer.from(
        `${AUTOMOVIE_BUILD_FINGERPRINT_PROTOCOL}\0${AUTOMOVIE_PRODUCTION_BUILD_PROTOCOL}\0${AUTOMOVIE_PRODUCTION_BUILD_VERSION}`,
        "utf8",
      ),
    },
    {
      role: "production",
      kind: "namespace",
      payload: Buffer.from(productionId, "utf8"),
    },
    ...designFingerprintFields(graph),
    ...sourceFields,
    ...contentFields,
  ]);

/**
 * Re-derive the current builder-input identity without compiling or writing.
 *
 * Callers without authoring evidence use this project-only projection. The
 * builder feeds its initial and freshly read evidence through the companion
 * below, so guarded publication compares the same owner-binding field on both
 * sides of the commit lock.
 *
 * @author Samchon
 * @evidence specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-choice-determinism-invariant Turns every authoring choice into a new input identity so alternatives stay comparable without forcing one result.
 */
export const currentAutoMovieProductionBuildInputFingerprint = (
  project: AutoMovieProductionProject,
  scope: IAutoMovieBuildProjectInput["scope"],
): AutoMovieContentDigest | null =>
  currentAutoMovieProductionBuildInputFingerprintWithEvidence(
    project,
    scope,
    undefined,
  );

/** Re-derive a builder identity with the authoring evidence it consumed. */
export const currentAutoMovieProductionBuildInputFingerprintWithEvidence = (
  project: AutoMovieProductionProject,
  scope: IAutoMovieBuildProjectInput["scope"],
  authoringEvidence: IAutoMovieProductionEvidence | undefined,
): AutoMovieContentDigest | null => {
  try {
    const graph = project.graph();
    const sourceFields: IAutoMovieFingerprintField[] = [
      ...authoringEvidenceFingerprintFields(authoringEvidence),
    ];
    for (const [id, contract] of graph.shots) {
      if (scope === "design") {
        sourceFields.push({
          role: `source:${id}`,
          kind: "not-inspected",
          payload: new Uint8Array(),
        });
        continue;
      }
      try {
        sourceFields.push({
          role: `source:${id}`,
          kind: "typescript",
          payload: normalizeAutoMovieSource(
            project.readSource(contract.source.module),
          ),
        });
      } catch {
        sourceFields.push({
          role: `source:${id}`,
          kind: "absent",
          payload: new Uint8Array(),
        });
      }
    }
    if (scope === "design")
      sourceFields.push({
        role: "source:film",
        kind: "not-inspected",
        payload: new Uint8Array(),
      });
    else
      try {
        sourceFields.push({
          role: "source:film",
          kind: "typescript",
          payload: normalizeAutoMovieSource(
            project.readSource(FILM_SOURCE_PATH),
          ),
        });
      } catch {
        sourceFields.push({
          role: "source:film",
          kind: "absent",
          payload: new Uint8Array(),
        });
      }
    const contentFields: IAutoMovieFingerprintField[] = [];
    if (scope !== "design")
      try {
        contentFields.push(
          ...contentFingerprintFields(project.contentInputs()),
        );
      } catch {
        contentFields.push({
          role: "content:inventory",
          kind: "unsafe",
          payload: new Uint8Array(),
        });
      }
    if (scope !== "design")
      contentFields.push(
        ...inspectAutoMovieDerivedArtifacts({
          root: project.root,
          manifestPath: project.manifest().derivedArtifactManifest,
        }).fingerprintFields,
      );
    return productionBuildInputFingerprint(
      project.productionId,
      graph,
      sourceFields,
      contentFields,
    );
  } catch {
    return null;
  }
};

/** Bind a compile snapshot to the exact graph-selected source-owner edges. */
export const authoringEvidenceFingerprintFields = (
  evidence: IAutoMovieProductionEvidence | undefined,
): IAutoMovieFingerprintField[] =>
  evidence === undefined
    ? []
    : [
        {
          role: "source:owner-bindings",
          kind: "application/json",
          payload: canonicalAutoMovieJsonBytes(evidence.sourceOwners ?? []),
        },
      ];

const designFingerprintFields = (
  graph: ReturnType<AutoMovieProductionProject["graph"]>,
): IAutoMovieFingerprintField[] => {
  const fields: IAutoMovieFingerprintField[] = [];
  const add = (role: string, value: unknown): void => {
    fields.push({
      role,
      kind: value === null ? "absent" : "canonical-json",
      payload:
        value === null ? new Uint8Array() : canonicalAutoMovieJsonBytes(value),
    });
  };
  add("design:production", graph.production);
  for (const [id, value] of graph.models) add(`design:model:${id}`, value);
  add("design:world", graph.world);
  for (const [id, value] of graph.formations)
    add(`design:formation:${id}`, value);
  for (const [id, value] of graph.shots) add(`design:shot:${id}`, value);
  for (const [id, value] of graph.acceptance)
    add(`design:acceptance:${id}`, value);
  return fields;
};
