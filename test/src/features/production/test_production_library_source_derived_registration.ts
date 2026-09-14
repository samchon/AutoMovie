import type { IAutoMovieProductionEvidenceSourceOwnerBinding } from "@automovie/evidence";
import type {
  AutoMovieContentDigest,
  IAutoMovieDerivedArtifactSource,
  IAutoMovieLibraryBuildContext,
} from "@automovie/interface";
import {
  autoMovieLibraryContributionDiagnostics,
  collectLibrarySourceRegistrations,
  resolveAutoMovieSourceOwnerBinding,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";

interface IOwner {
  branch: string;
  document: string;
  anchor: string;
}

const SOURCE = "src/libraries/lantern.ts";
const SOURCE_DIGEST: AutoMovieContentDigest = `sha256:${"0".repeat(64)}`;
const ARTIFACT = "automovie/derived/lantern-contribution.json";
const NOTES = "automovie/derived/lantern-notes.txt";
const SETTINGS: IOwner = {
  branch: "productionSources",
  document: "docs/settings/delivery.md",
  anchor: "delivery",
};
const MODELS: IOwner = {
  branch: "models",
  document: "docs/models/lantern.md",
  anchor: "lantern",
};

const address = (owner: IOwner): string => `${owner.document}#${owner.anchor}`;

const artifact = (text: string): IAutoMovieDerivedArtifactSource => ({
  digest: `sha256:${createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex")}`,
  encoding: "utf8",
  content: text,
});

const binding = (
  owner: IOwner,
  exportName: string,
): IAutoMovieProductionEvidenceSourceOwnerBinding => ({
  branch: owner.branch,
  stage: "source",
  enforced: true,
  relationship: "lineage",
  sourcePath: SOURCE,
  exportName,
  symbolKind: "property",
  sourceDigest: SOURCE_DIGEST,
  targetPath: owner.document,
  targetAnchor: owner.anchor,
  reviewed: false,
});

const collect = (
  owner: IOwner,
  exports: Record<string, unknown>,
  derivedArtifacts: Record<string, IAutoMovieDerivedArtifactSource>,
) =>
  collectLibrarySourceRegistrations({
    path: SOURCE,
    load: () => exports,
    context: (design): IAutoMovieLibraryBuildContext | null =>
      design === address(owner)
        ? {
            production: "plaza",
            branch: owner.branch,
            design: owner.document,
            anchor: owner.anchor,
            derivedArtifacts,
          }
        : null,
    admit: (exportName, design) =>
      resolveAutoMovieSourceOwnerBinding({
        bindings: [binding(owner, exportName)],
        branch: owner.branch,
        sourcePath: SOURCE,
        exportName,
        owner: design,
        sourceDigest: SOURCE_DIGEST,
        requireReviewed: false,
      }),
  });

const derivedOwner = (owner: IOwner) => ({
  lantern: { design: address(owner), derivedArtifact: ARTIFACT },
});

/**
 * A library compile's derived owner reaches the shared duplicate-aware JSON
 * ingress, and every refusal it earns names the artifact whose generator has to
 * change.
 *
 * A declarative owner selects a precomputed contribution instead of returning
 * one, so a host parser that keeps the last of two same-named members would
 * turn an ambiguous artifact into an accepted one, and a schema or branch
 * refusal that told the author to fix a returned value would send them to a
 * source file that returned nothing. An executed owner is the twin: its value
 * never passes through JSON admission, a plain text artifact reaches it
 * verbatim, and its refusals keep pointing at its own source.
 *
 * Scenarios:
 *
 * 1. A derived owner whose artifact repeats `models` registers nothing and is
 *    refused once at the artifact path by the ingress's duplicate stage; the
 *    same owner over unique members registers the exact contribution.
 * 2. An executed owner registers the same contribution and reads a text
 *    artifact whose content only looks like JSON with duplicate members,
 *    unparsed.
 * 3. Declaring `build` beside `derivedArtifact` is refused at the source path,
 *    because the choice of form is the source's mistake.
 * 4. A schema-invalid derived contribution is refused at the artifact path with
 *    a generator correction, while the same invalid value returned by `build` is
 *    refused at the source path with the returned-value correction.
 * 5. A branch rule refusal for a models owner passes the contract's message
 *    through unchanged at the source path for an executed owner, and at the
 *    artifact path with the generator correction appended for a derived one.
 */
export const test_production_library_source_derived_registration = (): void => {
  const empty = { environments: [], models: [] };
  const registered = [
    {
      export: "lantern",
      design: address(SETTINGS),
      contribution: { environments: [], models: [], contexts: [] },
    },
  ];

  // 1. Duplicate members are refused through the shared ingress.
  const duplicate = collect(SETTINGS, derivedOwner(SETTINGS), {
    [ARTIFACT]: artifact('{"environments":[],"models":[],"models":[]}'),
  });
  TestValidator.equals(
    "a repeated member never reaches contribution validation",
    {
      registrations: duplicate.registrations,
      refusals: duplicate.diagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        path: diagnostic.path,
        duplicateStage:
          diagnostic.message.includes("failed duplicate admission") &&
          diagnostic.message.includes('duplicate member "models"'),
      })),
    },
    {
      registrations: [],
      refusals: [
        {
          code: "source-export-invalid",
          path: ARTIFACT,
          duplicateStage: true,
        },
      ],
    },
  );
  TestValidator.equals(
    "unique members register the selected contribution",
    collect(SETTINGS, derivedOwner(SETTINGS), {
      [ARTIFACT]: artifact(JSON.stringify(empty)),
    }),
    { registrations: registered, diagnostics: [] },
  );

  // 2. An executed owner reads a text artifact verbatim.
  const notes = '# lantern notes {"a":1,"a":2}\n';
  const observed: { text: string | null } = { text: null };
  const built = collect(
    SETTINGS,
    {
      lantern: {
        design: address(SETTINGS),
        build: (context: IAutoMovieLibraryBuildContext) => {
          observed.text = context.derivedArtifacts[NOTES]?.content ?? null;
          return empty;
        },
      },
    },
    { [NOTES]: artifact(notes) },
  );
  TestValidator.equals(
    "an executed owner and its plain text input are unchanged",
    { ...built, seen: observed.text },
    { registrations: registered, diagnostics: [], seen: notes },
  );

  // 3. Declaring both forms is the source's mistake.
  const both = collect(
    SETTINGS,
    {
      lantern: {
        design: address(SETTINGS),
        derivedArtifact: ARTIFACT,
        build: () => empty,
      },
    },
    { [ARTIFACT]: artifact(JSON.stringify(empty)) },
  );
  TestValidator.equals(
    "both forms are refused at the source",
    both.diagnostics.map((diagnostic) => [diagnostic.code, diagnostic.path]),
    [["source-export-invalid", SOURCE]],
  );

  // 4. Schema refusals name what has to change.
  const invalid = { environments: [], models: "lantern" };
  const derivedSchema = collect(SETTINGS, derivedOwner(SETTINGS), {
    [ARTIFACT]: artifact(JSON.stringify(invalid)),
  });
  const builtSchema = collect(
    SETTINGS,
    { lantern: { design: address(SETTINGS), build: () => invalid } },
    {},
  );
  TestValidator.predicate(
    "a derived schema refusal names the artifact and its generator",
    derivedSchema.registrations.length === 0 &&
      derivedSchema.diagnostics.length !== 0 &&
      derivedSchema.diagnostics.every(
        (diagnostic) =>
          diagnostic.path === ARTIFACT &&
          diagnostic.message.includes(
            `generator of derived artifact "${ARTIFACT}"`,
          ) &&
          diagnostic.message.includes("returned library contribution") ===
            false,
      ),
  );
  TestValidator.predicate(
    "an executed schema refusal still names the returned value in its source",
    builtSchema.registrations.length === 0 &&
      builtSchema.diagnostics.length !== 0 &&
      builtSchema.diagnostics.every(
        (diagnostic) =>
          diagnostic.path === SOURCE &&
          diagnostic.message.endsWith(
            `Fix the returned library contribution in ${SOURCE}.`,
          ),
      ),
  );

  // 5. Branch rules keep their message and gain the right attribution.
  const rule = autoMovieLibraryContributionDiagnostics("models", {
    ...empty,
    contexts: [],
  });
  TestValidator.predicate(
    "an empty models contribution violates the models branch rule",
    rule.length !== 0,
  );
  const derivedBranch = collect(MODELS, derivedOwner(MODELS), {
    [ARTIFACT]: artifact(JSON.stringify(empty)),
  });
  const builtBranch = collect(
    MODELS,
    { lantern: { design: address(MODELS), build: () => empty } },
    {},
  );
  TestValidator.equals(
    "an executed owner receives the branch rule unchanged at its source",
    builtBranch.diagnostics.map((diagnostic) => [
      diagnostic.path,
      diagnostic.message,
    ]),
    rule.map((message) => [SOURCE, message]),
  );
  TestValidator.equals(
    "a derived owner receives the branch rule at its artifact with the generator correction",
    derivedBranch.diagnostics.map((diagnostic, index) => [
      diagnostic.path,
      diagnostic.message.startsWith(`${rule[index]} `),
      diagnostic.message.includes(
        `generator of derived artifact "${ARTIFACT}"`,
      ) && diagnostic.message.includes("generation command"),
    ]),
    rule.map(() => [ARTIFACT, true, true]),
  );
  TestValidator.equals(
    "branch refusals register nothing",
    [derivedBranch.registrations, builtBranch.registrations],
    [[], []],
  );
};
