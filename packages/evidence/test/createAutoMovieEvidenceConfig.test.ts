import { createAutoMovieEvidenceConfig } from "@automovie/evidence";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

type Graph = Parameters<typeof createAutoMovieEvidenceConfig>[0];
type Claim = NonNullable<Graph["claims"]>[number];

const scaffold = path.resolve(
  import.meta.dirname,
  "..",
  "..",
  "cli",
  "scaffold",
);
const roots: string[] = [];

const root = (): string => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-graph-"));
  roots.push(directory);
  fs.cpSync(
    path.join(scaffold, "docs", "principles"),
    path.join(directory, "docs", "principles"),
    { recursive: true },
  );
  fs.cpSync(
    path.join(scaffold, "docs", "obligations"),
    path.join(directory, "docs", "obligations"),
    { recursive: true },
  );
  return directory;
};

const write = (location: string, relative: string, content: string): void => {
  const file = path.join(location, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

const target = (title: string, anchor: string): string =>
  `# ${title} contract\n\nThis production-only target states one bounded rule for its selected hosts.\n\n<!--\n### A commented heading is not a target.\n-->\n\n\`\`\`md\n### A fenced heading is not a target.\n\`\`\`\n\n## ${title} {#${anchor}}\n\nSelected hosts preserve the production-owned ${title.toLowerCase()} decision without replacing shared law.\n\nReview question: does the selected host preserve this exact production-owned decision?\n\nSources: production decision recorded by the owning project.\n`;

const disabled = (location: string): Graph => ({
  location,
  kind: null,
  settings: "disabled",
  research: "disabled",
  models: "disabled",
  spaces: "disabled",
  materials: "disabled",
  instances: "disabled",
  motions: "disabled",
  systems: "disabled",
  storylines: "disabled",
  scenarios: "disabled",
  script: "disabled",
  briefs: "disabled",
  modelSources: "disabled",
  spaceSources: "disabled",
  materialSources: "disabled",
  instanceSources: "disabled",
  motionSources: "disabled",
  systemSources: "disabled",
  shots: "disabled",
  productionSources: "disabled",
  filmSources: "disabled",
  claims: [],
});

const throws = (task: () => unknown, fragment: string): boolean => {
  try {
    task();
    return false;
  } catch (error) {
    return error instanceof Error && error.message.includes(fragment);
  }
};

const referencesOf = (claim: Claim | undefined) =>
  claim === undefined
    ? []
    : Array.isArray(claim.reference)
      ? claim.reference
      : [claim.reference];

const referenceTo = (claim: Claim | undefined, file: string) =>
  referencesOf(claim).find(
    (reference) =>
      reference.type === "markdown" && reference.files.includes(file),
  );

try {
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled("relative-production"),
          location: 42,
        } as unknown as Graph),
      "location must be an absolute string; received 42",
    ),
    true,
  );

  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled("relative-production"),
          location: "relative-production",
        }),
      "location must be an absolute string",
    ),
    true,
  );

  const missingLocationRoot = root();
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig(
          disabled(path.join(missingLocationRoot, "missing")),
        ),
      "location does not exist",
    ),
    true,
  );

  const fileLocationRoot = root();
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig(
          disabled(
            path.join(fileLocationRoot, "docs", "principles", "common.md"),
          ),
        ),
      "location is not a directory",
    ),
    true,
  );

  const invalidKind = root();
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(invalidKind),
          kind: "feature",
        } as unknown as Graph),
      "Unsupported production kind",
    ),
    true,
  );

  const invalidStage = root();
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(invalidStage),
          settings: "complete",
        } as unknown as Graph),
      "settings has unsupported evidence stage",
    ),
    true,
  );

  const invalidClaims = root();
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(invalidClaims),
          claims: null,
        } as unknown as Graph),
      "claims must be an array",
    ),
    true,
  );

  const empty = root();
  const graph = createAutoMovieEvidenceConfig(disabled(empty));
  assert.equal(
    graph.claims.length,
    50,
    "the disabled graph keeps every shared claim instead of silently dropping an empty population",
  );
  assert.equal(
    new Set(graph.claims.map((claim) => claim.name)).size,
    graph.claims.length,
    "every shared claim has one stable diagnostic identity",
  );
  for (const claim of graph.claims) {
    assert.ok(
      claim.files.some((file) => file.startsWith("!") === false),
      `${claim.name} lost its prewired positive host glob`,
    );
    assert.ok(
      referencesOf(claim).length > 0,
      `${claim.name} lost its prewired reference population`,
    );
  }
  assert.ok(
    graph.claims.some(
      (claim) =>
        claim.name ===
        "the reserved evidence-lint canary proves the generated graph is running",
    ),
    "the permanent evidence-lint canary was removed",
  );
  for (const layer of [
    "models",
    "spaces",
    "materials",
    "instances",
    "motions",
    "systems",
  ]) {
    assert.ok(
      graph.claims.some(
        (claim) =>
          claim.name ===
            `${layer} files answer their complete principle checklists` &&
          claim.disabled === true,
      ),
      `disabled shared claims omitted docs/${layer}`,
    );
    assert.ok(
      graph.claims.some(
        (claim) =>
          claim.name ===
            `${layer.slice(0, -1)}Sources owners each answer exactly one ${layer} design file` &&
          claim.disabled === true,
      ),
      `disabled shared claims omitted src/${layer}`,
    );
  }

  const additive = root();
  write(
    additive,
    "docs/production-principles/tone.md",
    target("Local tone", "local-tone"),
  );
  const productionOwnedClaim: Claim = {
    name: "production-only tone remains additive",
    type: "markdown",
    root: "docs",
    files: ["settings/**/*.md"],
    symbol: "file",
    disabled: true,
    reference: {
      type: "markdown",
      root: "docs",
      files: ["production-principles/tone.md"],
      symbol: "h2",
      checklist: true,
      noEvidenceExclude: true,
    },
  };
  const extended = createAutoMovieEvidenceConfig({
    ...disabled(additive),
    claims: [productionOwnedClaim],
  });
  assert.equal(
    extended.claims.at(-1),
    productionOwnedClaim,
    "production claims must append after, not replace, the shared graph",
  );

  const unselected = root();
  write(unselected, "docs/settings/production.md", "## Scope {#scope}\n");
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(unselected),
          settings: "draft",
        }),
      "Select film, brief, or library",
    ),
    true,
  );

  const hiddenSettingsSubheading = root();
  write(
    hiddenSettingsSubheading,
    "docs/settings/production.md",
    "## Scope {#scope}\n### Hidden decision {#hidden-decision}\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(hiddenSettingsSubheading),
          kind: "library",
          settings: "draft",
        }),
      "uses H3 outside the configured H2 authored-unit topology",
    ),
    true,
  );

  const h3BeforeH2 = root();
  write(h3BeforeH2, "docs/settings/production.md", "## Scope {#scope}\n");
  write(
    h3BeforeH2,
    "docs/storylines/001.md",
    "### Scene {#scene}\n#### Beat {#beat}\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(h3BeforeH2),
          kind: "film",
          settings: "review",
          storylines: "draft",
        }),
      "has an H3 before an H2",
    ),
    true,
  );

  const h4BeforeH3 = root();
  write(h4BeforeH3, "docs/settings/production.md", "## Scope {#scope}\n");
  write(
    h4BeforeH3,
    "docs/storylines/001.md",
    "## Sequence {#sequence}\n#### Beat {#beat}\n### Scene {#scene}\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(h4BeforeH3),
          kind: "film",
          settings: "review",
          storylines: "draft",
        }),
      "has an H4 before its H2/H3 parents",
    ),
    true,
  );

  const hiddenNarrativeSubheading = root();
  write(
    hiddenNarrativeSubheading,
    "docs/settings/production.md",
    "## Scope {#scope}\n",
  );
  write(
    hiddenNarrativeSubheading,
    "docs/storylines/001.md",
    "## Sequence {#sequence}\n### Scene {#scene}\n#### Beat {#beat}\n##### Hidden note {#hidden-note}\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(hiddenNarrativeSubheading),
          kind: "film",
          settings: "review",
          storylines: "draft",
        }),
      "uses H5 outside the configured H2/H3/H4 authored-unit topology",
    ),
    true,
  );

  const missingBeat = root();
  write(missingBeat, "docs/settings/production.md", "## Scope {#scope}\n");
  write(
    missingBeat,
    "docs/storylines/001.md",
    "## Sequence {#sequence}\n### Scene {#scene}\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(missingBeat),
          kind: "film",
          settings: "review",
          storylines: "draft",
        }),
      "has no H4 unit",
    ),
    true,
  );

  const repeatedLayerAnchor = root();
  write(repeatedLayerAnchor, "docs/settings/first.md", "## First {#shared}\n");
  write(
    repeatedLayerAnchor,
    "docs/settings/second.md",
    "## Second {#shared}\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(repeatedLayerAnchor),
          kind: "library",
          settings: "draft",
        }),
      "settings repeats #shared",
    ),
    true,
  );

  const mismatchedIdentity = root();
  write(
    mismatchedIdentity,
    "docs/settings/production.md",
    "## Scope {#scope}\n",
  );
  write(
    mismatchedIdentity,
    "docs/storylines/001.md",
    "## Sequence {#sequence}\n### Scene {#scene}\n#### Beat {#beat}\n",
  );
  write(
    mismatchedIdentity,
    "docs/scenarios/001.md",
    "## Sequence {#sequence}\n### Scene {#scene}\n#### Other beat {#other-beat}\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(mismatchedIdentity),
          kind: "film",
          settings: "review",
          storylines: "review",
          scenarios: "draft",
        }),
      "must exactly preserve storylines identity, nesting, and order",
    ),
    true,
  );

  const kindWithoutBeginning = root();
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(kindWithoutBeginning),
          kind: "library",
        }),
      "must begin with research or an active settings layer",
    ),
    true,
  );

  const filmWithBrief = root();
  write(filmWithBrief, "docs/settings/production.md", "## Scope {#scope}\n");
  write(
    filmWithBrief,
    "docs/briefs/delivery.md",
    "## Delivery {#delivery}\n### Shot {#shot}\n#### Observation {#observation}\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(filmWithBrief),
          kind: "film",
          settings: "review",
          briefs: "draft",
        }),
      "film cannot activate the direct-brief layer",
    ),
    true,
  );

  const unreviewedResearch = root();
  write(unreviewedResearch, "docs/research/source.md", "## Source {#source}\n");
  write(
    unreviewedResearch,
    "docs/settings/production.md",
    "## Scope {#scope}\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(unreviewedResearch),
          kind: "film",
          research: "draft",
          settings: "draft",
        }),
      "settings cannot enter draft before research is in review",
    ),
    true,
  );

  const researchOnly = root();
  write(researchOnly, "docs/research/source.md", "## Source {#source}\n");
  assert.doesNotThrow(() =>
    createAutoMovieEvidenceConfig({
      ...disabled(researchOnly),
      kind: "library",
      research: "evidence",
    }),
  );

  const interpretedResearch = root();
  write(
    interpretedResearch,
    "docs/research/source.md",
    "## Source {#source}\n",
  );
  write(
    interpretedResearch,
    "docs/settings/production.md",
    "## Scope {#scope}\n",
  );
  const researchEvidenceGraph = createAutoMovieEvidenceConfig({
    ...disabled(interpretedResearch),
    kind: "library",
    research: "review",
    settings: "evidence",
  });
  const researchEvidenceClaim = researchEvidenceGraph.claims.find(
    (claim) =>
      claim.name ===
      "reviewed research records support the settings decisions that interpret them",
  );
  assert.deepEqual(researchEvidenceClaim?.files, ["settings/**/*.md"]);
  assert.equal(
    referenceTo(researchEvidenceClaim, "research/**/*.md")?.requireReview,
    false,
    "an evidence-stage settings host must not owe a review fingerprint early",
  );
  const researchReviewClaim = createAutoMovieEvidenceConfig({
    ...disabled(interpretedResearch),
    kind: "library",
    research: "review",
    settings: "review",
  }).claims.find(
    (claim) =>
      claim.name ===
      "reviewed research records support the settings decisions that interpret them",
  );
  assert.equal(
    referenceTo(researchReviewClaim, "research/**/*.md")?.requireReview,
    true,
    "research-consumption reviews begin with the consuming settings stage",
  );

  const sourceResidue = root();
  write(sourceResidue, "docs/settings/production.md", "## Scope {#scope}\n");
  write(sourceResidue, "src/models/residue.ts", "export class Residue {}\n");
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(sourceResidue),
          kind: "library",
          settings: "draft",
        }),
      "modelSources is disabled but governed hosts remain",
    ),
    true,
  );

  const emptySource = root();
  write(emptySource, "docs/settings/production.md", "## Scope {#scope}\n");
  write(emptySource, "docs/models/subject.md", "## Subject {#subject}\n");
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(emptySource),
          kind: "library",
          settings: "review",
          models: "review",
          modelSources: "draft",
        }),
      "modelSources cannot enter draft without a TypeScript host",
    ),
    true,
  );

  const prematureSource = root();
  write(prematureSource, "docs/settings/production.md", "## Scope {#scope}\n");
  write(prematureSource, "docs/models/subject.md", "## Subject {#subject}\n");
  write(
    prematureSource,
    "src/models/subject.ts",
    "/** @evidence models/subject.md premature */\nexport class Subject {}\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(prematureSource),
          kind: "library",
          settings: "review",
          models: "review",
          modelSources: "draft",
        }),
      "draft and must be completed before evidence tags",
    ),
    true,
  );

  const emptyActive = root();
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(emptyActive),
          kind: "film",
          settings: "draft",
        }),
      "without a Markdown host",
    ),
    true,
  );

  const residue = root();
  write(residue, "docs/settings/production.md", "## Scope {#scope}\n");
  write(residue, "docs/models/residue.md", "## Shape {#shape}\n");
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(residue),
          kind: "library",
          settings: "draft",
        }),
      "models is disabled but governed hosts remain",
    ),
    true,
  );

  const premature = root();
  write(
    premature,
    "docs/settings/production.md",
    "## Scope {#scope}\n\n<!-- @evidence principles/common.md#purpose-fit premature -->\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(premature),
          kind: "brief",
          settings: "draft",
        }),
      "draft and must be completed before evidence tags",
    ),
    true,
  );

  const ownerless = root();
  write(ownerless, "docs/settings/production.md", "## Scope {#scope}\n");
  write(ownerless, "docs/models/subject.md", "## Shape {#shape}\n");
  write(ownerless, "src/models/subject.ts", "const hidden = 1;\n");
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(ownerless),
          kind: "library",
          settings: "review",
          models: "review",
          modelSources: "draft",
        }),
      "no named exported owner",
    ),
    true,
  );

  const wrongModelOwner = root();
  write(wrongModelOwner, "docs/settings/production.md", "## Scope {#scope}\n");
  write(wrongModelOwner, "docs/models/subject.md", "## Shape {#shape}\n");
  write(
    wrongModelOwner,
    "src/models/subject.ts",
    "export function createSubject(): object { return {}; }\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(wrongModelOwner),
          kind: "library",
          settings: "review",
          models: "review",
          modelSources: "draft",
        }),
      "required kind (class)",
    ),
    true,
  );

  const abstractModelOwner = root();
  write(
    abstractModelOwner,
    "docs/settings/production.md",
    "## Scope {#scope}\n",
  );
  write(abstractModelOwner, "docs/models/subject.md", "## Shape {#shape}\n");
  write(
    abstractModelOwner,
    "src/models/subject.ts",
    "export abstract class Subject {}\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(abstractModelOwner),
          kind: "library",
          settings: "review",
          models: "review",
          modelSources: "draft",
        }),
      "required kind (class)",
    ),
    true,
  );

  const declaredModelOwner = root();
  write(
    declaredModelOwner,
    "docs/settings/production.md",
    "## Scope {#scope}\n",
  );
  write(declaredModelOwner, "docs/models/subject.md", "## Shape {#shape}\n");
  write(
    declaredModelOwner,
    "src/models/subject.ts",
    "export declare class Subject {}\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(declaredModelOwner),
          kind: "library",
          settings: "review",
          models: "review",
          modelSources: "draft",
        }),
      "required kind (class)",
    ),
    true,
  );

  for (const declaration of [
    "export declare function move(): void;\n",
    "export function move(): void;\n",
    "export declare const move: () => void;\n",
    "export const move: (() => void) | undefined;\n",
  ]) {
    const declaredMotionOwner = root();
    write(
      declaredMotionOwner,
      "docs/settings/production.md",
      "## Scope {#scope}\n",
    );
    write(declaredMotionOwner, "docs/motions/move.md", "## Move {#move}\n");
    write(declaredMotionOwner, "src/motions/move.ts", declaration);
    assert.equal(
      throws(
        () =>
          createAutoMovieEvidenceConfig({
            ...disabled(declaredMotionOwner),
            kind: "library",
            settings: "review",
            motions: "review",
            motionSources: "draft",
          }),
        "required kind (property, function)",
      ),
      true,
    );
  }

  const parsedModelOwner = root();
  write(parsedModelOwner, "docs/settings/production.md", "## Scope {#scope}\n");
  write(parsedModelOwner, "docs/models/subject.md", "## Shape {#shape}\n");
  write(
    parsedModelOwner,
    "src/models/subject.ts",
    [
      "// export class LineCommentDecoy {}",
      "/* export class BlockCommentDecoy {} */",
      'const doubleDecoy = "export class DoubleDecoy {}";',
      "const singleDecoy = 'export class SingleDecoy {}';",
      "const templateDecoy = `export class TemplateDecoy {}`;",
      'const escapedDecoy = "\\\"export class EscapedDecoy {}";',
      "const url = /https?:\\/\\//;",
      "const quotePattern = /['\"]/;",
      "export class 영화Owner {}",
      "void doubleDecoy; void singleDecoy; void templateDecoy; void escapedDecoy; void url; void quotePattern;",
      "",
    ].join("\n"),
  );
  assert.doesNotThrow(
    () =>
      createAutoMovieEvidenceConfig({
        ...disabled(parsedModelOwner),
        kind: "library",
        settings: "review",
        models: "review",
        modelSources: "draft",
      }),
    "owner detection must recognize a legal exported Unicode owner without confusing a preceding regular expression",
  );

  for (const declaration of [
    "class Subject {}\nexport { Subject };\n",
    "const move = (): void => {};\nexport { move as publicMove };\n",
    "function move(): void {}\nexport { move as publicMove };\n",
  ]) {
    const localExportOwner = root();
    write(
      localExportOwner,
      "docs/settings/production.md",
      "## Scope {#scope}\n",
    );
    const model = declaration.startsWith("class");
    write(
      localExportOwner,
      model ? "docs/models/subject.md" : "docs/motions/move.md",
      model ? "## Shape {#shape}\n" : "## Move {#move}\n",
    );
    write(
      localExportOwner,
      model ? "src/models/subject.ts" : "src/motions/move.ts",
      declaration,
    );
    assert.doesNotThrow(() =>
      createAutoMovieEvidenceConfig({
        ...disabled(localExportOwner),
        kind: "library",
        settings: "review",
        ...(model
          ? { models: "review" as const, modelSources: "draft" as const }
          : { motions: "review" as const, motionSources: "draft" as const }),
      }),
    );
  }

  const typeOnlyLocalExport = root();
  write(
    typeOnlyLocalExport,
    "docs/settings/production.md",
    "## Scope {#scope}\n",
  );
  write(typeOnlyLocalExport, "docs/models/subject.md", "## Shape {#shape}\n");
  write(
    typeOnlyLocalExport,
    "src/models/subject.ts",
    "class Subject {}\nexport type { Subject };\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(typeOnlyLocalExport),
          kind: "library",
          settings: "review",
          models: "review",
          modelSources: "draft",
        }),
      "required kind (class)",
    ),
    true,
  );

  const uninitializedLocalExport = root();
  write(
    uninitializedLocalExport,
    "docs/settings/production.md",
    "## Scope {#scope}\n",
  );
  write(uninitializedLocalExport, "docs/motions/move.md", "## Move {#move}\n");
  write(
    uninitializedLocalExport,
    "src/motions/move.ts",
    "let move: (() => void) | undefined, hidden = (): void => {};\nexport { move };\nvoid hidden;\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(uninitializedLocalExport),
          kind: "library",
          settings: "review",
          motions: "review",
          motionSources: "draft",
        }),
      "required kind (property, function)",
    ),
    true,
  );

  const mismatch = root();
  write(mismatch, "docs/settings/production.md", "## Scope {#scope}\n");
  write(
    mismatch,
    "docs/storylines/001-opening.md",
    "## Sequence {#sequence}\n### Scene {#scene}\n#### Beat {#beat}\n",
  );
  write(
    mismatch,
    "docs/scenarios/002-renamed.md",
    "## Sequence {#sequence}\n### Scene {#scene}\n#### Beat {#beat}\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(mismatch),
          kind: "film",
          settings: "review",
          storylines: "review",
          scenarios: "draft",
        }),
      "filenames must exactly preserve",
    ),
    true,
  );

  const briefWithNarrative = root();
  write(
    briefWithNarrative,
    "docs/settings/production.md",
    "## Scope {#scope}\n",
  );
  write(
    briefWithNarrative,
    "docs/storylines/001.md",
    "## Sequence {#sequence}\n### Scene {#scene}\n#### Beat {#beat}\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(briefWithNarrative),
          kind: "brief",
          settings: "review",
          storylines: "draft",
        }),
      "cannot activate storylines",
    ),
    true,
  );

  const libraryWithShot = root();
  write(libraryWithShot, "docs/settings/production.md", "## Scope {#scope}\n");
  write(libraryWithShot, "src/shots/shot.ts", "export const shot = 1;\n");
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(libraryWithShot),
          kind: "library",
          settings: "review",
          shots: "draft",
        }),
      "cannot activate narrative, brief, shot",
    ),
    true,
  );

  const branches = root();
  write(branches, "docs/settings/production.md", "## Scope {#scope}\n");
  for (const name of [
    "models",
    "spaces",
    "materials",
    "instances",
    "motions",
    "systems",
  ])
    write(
      branches,
      `docs/${name}/owner.md`,
      `## ${name} owner {#${name}-owner}\n`,
    );
  write(branches, "src/models/owner.ts", "export class ModelOwner {}\n");
  for (const name of ["spaces", "materials", "instances", "motions", "systems"])
    write(branches, `src/${name}/owner.ts`, `export const ${name}Owner = 1;\n`);
  write(branches, "src/production.ts", "export const production = 1;\n");
  const branchGraph = createAutoMovieEvidenceConfig({
    ...disabled(branches),
    kind: "library",
    settings: "review",
    models: "review",
    spaces: "review",
    materials: "review",
    instances: "review",
    motions: "review",
    systems: "review",
    modelSources: "review",
    spaceSources: "review",
    materialSources: "review",
    instanceSources: "review",
    motionSources: "review",
    systemSources: "review",
    productionSources: "review",
  });
  assert.ok(
    branchGraph.claims.some((claim) => claim.name?.includes("systemSources")),
    "the system source branch is not wired",
  );
  const systemObligation = branchGraph.claims.find((claim) =>
    claim.name?.includes("systems H2 units preserve"),
  );
  assert.equal(
    referenceTo(systemObligation, "obligations/systems.md")?.noEvidenceExclude,
    true,
    "required non-motion layer obligations must refuse exclusions",
  );
  const motionObligation = branchGraph.claims.find((claim) =>
    claim.name?.includes("motions H2 units preserve"),
  );
  assert.equal(
    referenceTo(motionObligation, "obligations/motions.md")?.noEvidenceExclude,
    undefined,
    "the population-wide motion-role obligation must retain conditional exclusions",
  );
  for (const foundation of [
    "models",
    "spaces",
    "materials",
    "instances",
    "systems",
  ])
    assert.ok(
      referenceTo(motionObligation, `${foundation}/owner.md`),
      `motion units omitted the active ${foundation} foundation`,
    );
  for (const [host, foundations] of Object.entries({
    models: ["spaces"],
    materials: ["models", "spaces"],
    instances: ["models", "spaces", "materials"],
    systems: ["models", "spaces", "materials", "instances", "motions"],
  })) {
    const hostClaim = branchGraph.claims.find((claim) =>
      claim.name?.includes(`${host} H2 units preserve`),
    );
    for (const foundation of foundations)
      assert.ok(
        referenceTo(hostClaim, `${foundation}/owner.md`),
        `${host} units omitted the active ${foundation} foundation`,
      );
  }
  const exactOwner = branchGraph.claims.find((claim) =>
    claim.name?.includes("modelSources owners each answer exactly one"),
  );
  assert.ok(exactOwner, "the exact design-to-source owner claim is missing");
  const exactOwnerJson = JSON.stringify(exactOwner);
  assert.ok(
    exactOwnerJson.includes('"symbol":["type"]') &&
      exactOwnerJson.includes('"singleEvidencePerSymbol":true') &&
      !exactOwnerJson.includes('"uniqueEvidence":true'),
    "each exported model type must own one design file without forbidding peer types from sharing that design",
  );

  const film = root();
  write(film, "docs/settings/production.md", "## Scope {#scope}\n");
  const narrative =
    "## Sequence {#sequence}\n### Scene {#scene}\n#### Beat {#beat}\n";
  for (const layer of ["storylines", "scenarios", "script"])
    write(film, `docs/${layer}/001-sequence.md`, narrative);
  write(film, "src/shots/sequence.ts", "export const sequenceShot = 1;\n");
  write(film, "src/production.ts", "export const production = 1;\n");
  write(film, "src/film.ts", "export const assembledFilm = 1;\n");
  const filmGraph = createAutoMovieEvidenceConfig({
    ...disabled(film),
    kind: "film",
    settings: "review",
    storylines: "review",
    scenarios: "review",
    script: "review",
    shots: "review",
    productionSources: "review",
    filmSources: "review",
  });
  assert.ok(
    filmGraph.claims.some((claim) =>
      claim.name?.includes("film source assembles every screenplay sequence"),
    ),
    "the complete film ladder did not reach film source",
  );

  const filmWithoutModelSource = root();
  write(
    filmWithoutModelSource,
    "docs/settings/production.md",
    "## Scope {#scope}\n",
  );
  write(
    filmWithoutModelSource,
    "docs/models/subject.md",
    "## Subject {#subject}\n",
  );
  for (const layer of ["storylines", "scenarios", "script"])
    write(filmWithoutModelSource, `docs/${layer}/001-sequence.md`, narrative);
  write(
    filmWithoutModelSource,
    "src/shots/sequence.ts",
    "export const sequenceShot = 1;\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(filmWithoutModelSource),
          kind: "film",
          settings: "review",
          models: "review",
          storylines: "review",
          scenarios: "review",
          script: "review",
          shots: "draft",
        }),
      "shots cannot enter draft before modelSources is in review",
    ),
    true,
  );

  const brief = root();
  write(brief, "docs/settings/production.md", "## Scope {#scope}\n");
  write(
    brief,
    "docs/briefs/delivery.md",
    "## Delivery {#delivery}\n### Shot {#shot}\n#### Observation {#observation}\n",
  );
  write(brief, "src/shots/delivery.ts", "export const deliveryShot = 1;\n");
  write(brief, "src/production.ts", "export const production = 1;\n");
  write(brief, "src/film.ts", "export const assembledBrief = 1;\n");
  const briefGraph = createAutoMovieEvidenceConfig({
    ...disabled(brief),
    kind: "brief",
    settings: "review",
    briefs: "review",
    shots: "review",
    productionSources: "review",
    filmSources: "review",
  });
  assert.ok(
    JSON.stringify(briefGraph.claims).includes('"files":["briefs/**/*.md"]'),
    "the brief route did not bind shots and delivery to brief units",
  );

  const designedBrief = root();
  write(designedBrief, "docs/settings/production.md", "## Scope {#scope}\n");
  write(designedBrief, "docs/models/subject.md", "## Subject {#subject}\n");
  write(
    designedBrief,
    "docs/briefs/delivery.md",
    "## Delivery {#delivery}\n### Shot {#shot}\n#### Observation {#observation}\n",
  );
  const designedBriefGraph = createAutoMovieEvidenceConfig({
    ...disabled(designedBrief),
    kind: "brief",
    settings: "review",
    models: "review",
    briefs: "evidence",
  });
  const briefDelivery = designedBriefGraph.claims.find((claim) =>
    claim.name?.includes("briefs H2 units preserve"),
  );
  assert.ok(
    referenceTo(briefDelivery, "models/subject.md"),
    "brief deliveries must cite the reviewed design branches they use",
  );

  const malformedContract = root();
  fs.writeFileSync(
    path.join(malformedContract, "docs/principles/common.md"),
    fs
      .readFileSync(
        path.join(malformedContract, "docs/principles/common.md"),
        "utf8",
      )
      .replace("Review question:", "Unrouted question:"),
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(malformedContract)),
      "exactly one Review question and one Sources line",
    ),
    true,
  );

  const commentedReviewQuestion = root();
  const commentedCommon = path.join(
    commentedReviewQuestion,
    "docs/principles/common.md",
  );
  fs.writeFileSync(
    commentedCommon,
    fs
      .readFileSync(commentedCommon, "utf8")
      .replace(/^(Review question:.*)$/mu, "<!-- $1 -->"),
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(commentedReviewQuestion)),
      "exactly one Review question and one Sources line; received 0 and 1",
    ),
    true,
  );

  const fencedSources = root();
  const fencedCommon = path.join(fencedSources, "docs/principles/common.md");
  fs.writeFileSync(
    fencedCommon,
    fs
      .readFileSync(fencedCommon, "utf8")
      .replace(/^(Sources:.*)$/mu, "~~~text\n$1\n~~~"),
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(fencedSources)),
      "exactly one Review question and one Sources line; received 1 and 0",
    ),
    true,
  );

  const duplicateContractAnchor = root();
  fs.writeFileSync(
    path.join(duplicateContractAnchor, "docs/principles/settings.md"),
    fs
      .readFileSync(
        path.join(duplicateContractAnchor, "docs/principles/settings.md"),
        "utf8",
      )
      .replace("{#addressable-canon}", "{#purpose-fit}"),
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(duplicateContractAnchor)),
      "reuses shared H2 anchor",
    ),
    true,
  );

  const duplicateContractTitle = root();
  fs.writeFileSync(
    path.join(duplicateContractTitle, "docs/principles/settings.md"),
    fs
      .readFileSync(
        path.join(duplicateContractTitle, "docs/principles/settings.md"),
        "utf8",
      )
      .replace("## Addressable canon", "## Purpose fit"),
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(duplicateContractTitle)),
      "repeats shared H2 title",
    ),
    true,
  );

  const trailingContractProse = root();
  fs.writeFileSync(
    path.join(trailingContractProse, "docs/principles/common.md"),
    fs
      .readFileSync(
        path.join(trailingContractProse, "docs/principles/common.md"),
        "utf8",
      )
      .replace(/^(Sources: .+)$/mu, "$1\n\nTrailing contract prose."),
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(trailingContractProse)),
      "must end with its Sources line",
    ),
    true,
  );

  const missingContractTitle = root();
  fs.writeFileSync(
    path.join(missingContractTitle, "docs/principles/common.md"),
    fs
      .readFileSync(
        path.join(missingContractTitle, "docs/principles/common.md"),
        "utf8",
      )
      .replace("# Common principles", "Common principles"),
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(missingContractTitle)),
      "must begin with exactly one H1",
    ),
    true,
  );

  const prefacedContractTarget = root();
  fs.writeFileSync(
    path.join(prefacedContractTarget, "docs/principles/common.md"),
    `Preamble outside the target.\n\n${fs.readFileSync(
      path.join(prefacedContractTarget, "docs/principles/common.md"),
      "utf8",
    )}`,
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(prefacedContractTarget)),
      "must begin with exactly one H1",
    ),
    true,
  );

  const nestedContractTarget = root();
  fs.writeFileSync(
    path.join(nestedContractTarget, "docs/principles/common.md"),
    fs
      .readFileSync(
        path.join(nestedContractTarget, "docs/principles/common.md"),
        "utf8",
      )
      .replace(
        "Review question: what later decision",
        "### Hidden subtarget\n\nReview question: what later decision",
      ),
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(nestedContractTarget)),
      "evidence targets use only H1 and anchored H2 units",
    ),
    true,
  );

  const unanchoredContractTarget = root();
  fs.writeFileSync(
    path.join(unanchoredContractTarget, "docs/principles/common.md"),
    fs
      .readFileSync(
        path.join(unanchoredContractTarget, "docs/principles/common.md"),
        "utf8",
      )
      .replace(" {#purpose-fit}", ""),
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(unanchoredContractTarget)),
      "without an explicit {#anchor}",
    ),
    true,
  );

  const duplicateContractUnitAnchor = root();
  fs.writeFileSync(
    path.join(duplicateContractUnitAnchor, "docs/principles/common.md"),
    fs
      .readFileSync(
        path.join(duplicateContractUnitAnchor, "docs/principles/common.md"),
        "utf8",
      )
      .replace("{#layer-boundary}", "{#purpose-fit}"),
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig(disabled(duplicateContractUnitAnchor)),
      "anchors are unique within one file",
    ),
    true,
  );

  const scopelessContractTarget = root();
  fs.writeFileSync(
    path.join(scopelessContractTarget, "docs/principles/common.md"),
    fs
      .readFileSync(
        path.join(scopelessContractTarget, "docs/principles/common.md"),
        "utf8",
      )
      .replace(/\n\nThese principles apply[^\n]+\n\n/u, "\n\n"),
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(scopelessContractTarget)),
      "must state its target scope",
    ),
    true,
  );

  for (const [name, falseScope] of [
    ["comment-only", "<!-- not a scope statement -->"],
    ["backtick-fence-only", "```text\nnot a scope statement\n```"],
    ["tilde-fence-only", "~~~text\nnot a scope statement\n~~~~"],
  ] as const) {
    const falseScopeTarget = root();
    const common = path.join(falseScopeTarget, "docs/principles/common.md");
    fs.writeFileSync(
      common,
      fs
        .readFileSync(common, "utf8")
        .replace(
          /\n\nThese principles apply[^\n]+\n\n/u,
          `\n\n${falseScope}\n\n`,
        ),
    );
    assert.equal(
      throws(
        () => createAutoMovieEvidenceConfig(disabled(falseScopeTarget)),
        "must state its target scope",
      ),
      true,
      name,
    );
  }

  const targetTag = root();
  fs.appendFileSync(
    path.join(targetTag, "docs/principles/common.md"),
    "\n<!-- @evidenceExcludeReview principles/common.md#purpose-fit #invalid recursive -->\n",
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(targetTag)),
      "shared target and must not carry host-side",
    ),
    true,
  );

  const unlistedTarget = root();
  write(
    unlistedTarget,
    "docs/principles/unwired.md",
    "## Unwired {#unwired}\n",
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(unlistedTarget)),
      "Shared contract inventory changed without graph wiring",
    ),
    true,
  );

  const addedContractUnit = root();
  fs.appendFileSync(
    path.join(addedContractUnit, "docs/principles/common.md"),
    "\n## Unexpected shared rule {#unexpected-shared-rule}\n\nThis rule was not added to the reusable graph inventory.\n\nReview question: was the shared graph deliberately rewired for this rule?\n\nSources: production contract inventory.\n",
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(addedContractUnit)),
      "H2 inventory changed without graph wiring",
    ),
    true,
  );

  const removedContractUnit = root();
  const removedCommon = path.join(
    removedContractUnit,
    "docs/principles/common.md",
  );
  fs.writeFileSync(
    removedCommon,
    fs
      .readFileSync(removedCommon, "utf8")
      .replace(
        /\n## Production language \{#production-language\}[\s\S]*$/u,
        "\n",
      ),
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(removedContractUnit)),
      "H2 inventory changed without graph wiring",
    ),
    true,
  );

  const renamedContractUnit = root();
  const renamedCommon = path.join(
    renamedContractUnit,
    "docs/principles/common.md",
  );
  fs.writeFileSync(
    renamedCommon,
    fs
      .readFileSync(renamedCommon, "utf8")
      .replace("{#production-language}", "{#renamed-production-language}"),
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(renamedContractUnit)),
      "H2 inventory changed without graph wiring",
    ),
    true,
  );

  const unwiredProductionTarget = root();
  write(
    unwiredProductionTarget,
    "docs/production-principles/unwired.md",
    target("Unwired", "unwired"),
  );
  assert.equal(
    throws(
      () => createAutoMovieEvidenceConfig(disabled(unwiredProductionTarget)),
      "production target with no additive claim reference",
    ),
    true,
  );

  const fileSelectedProductionTarget = root();
  write(
    fileSelectedProductionTarget,
    "docs/production-principles/file-selected.md",
    target("File-selected target", "file-selected-target"),
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(fileSelectedProductionTarget),
          claims: [
            {
              ...productionOwnedClaim,
              reference: {
                type: "markdown",
                root: "docs",
                files: ["production-principles/file-selected.md"],
                symbol: "file",
              },
            },
          ],
        }),
      "production target with no additive claim reference",
    ),
    true,
    "a file-level reference must not masquerade as wiring for H2 targets",
  );

  const duplicateProductionTargetAnchor = root();
  write(
    duplicateProductionTargetAnchor,
    "docs/production-principles/purpose.md",
    target("Production purpose", "purpose-fit"),
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(duplicateProductionTargetAnchor),
          claims: [
            {
              ...productionOwnedClaim,
              reference: {
                type: "markdown",
                root: "docs",
                files: ["production-principles/purpose.md"],
                symbol: "h2",
                checklist: true,
                noEvidenceExclude: true,
              },
            },
          ],
        }),
      "duplicates target anchor already owned by",
    ),
    true,
  );

  const duplicateProductionTargetTitle = root();
  write(
    duplicateProductionTargetTitle,
    "docs/production-principles/purpose.md",
    target("Purpose   FIT", "production-purpose-fit"),
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(duplicateProductionTargetTitle),
          claims: [
            {
              ...productionOwnedClaim,
              reference: {
                type: "markdown",
                root: "docs",
                files: ["production-principles/purpose.md"],
                symbol: "h2",
                checklist: true,
                noEvidenceExclude: true,
              },
            },
          ],
        }),
      "duplicates target title",
    ),
    true,
  );

  const negatedProductionTarget = root();
  write(
    negatedProductionTarget,
    "docs/production-principles/tone.md",
    target("Tone", "tone"),
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(negatedProductionTarget),
          claims: [
            {
              ...productionOwnedClaim,
              reference: {
                type: "markdown",
                root: "docs",
                files: [
                  "production-principles/t?ne.md",
                  "!production-principles/tone.md",
                ],
                symbol: "h2",
                checklist: true,
                noEvidenceExclude: true,
              },
            },
          ],
        }),
      "production target with no additive claim reference",
    ),
    true,
  );

  const malformedProductionTarget = root();
  write(
    malformedProductionTarget,
    "docs/production-principles/tone.md",
    target("Tone", "tone").replace("Review question:", "Unrouted question:"),
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(malformedProductionTarget),
          claims: [productionOwnedClaim],
        }),
      "exactly one Review question and one Sources line",
    ),
    true,
  );

  const taggedProductionTarget = root();
  write(
    taggedProductionTarget,
    "docs/production-principles/tagged.md",
    `<!-- @evidencePart principles/common.md#purpose-fit::fragment recursive -->\n${target("Tagged", "tagged")}`,
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(taggedProductionTarget),
          claims: [
            {
              ...productionOwnedClaim,
              reference: {
                type: "markdown",
                root: "docs",
                files: ["production-principles/tagged.md"],
                symbol: "h2",
                checklist: true,
                noEvidenceExclude: true,
              },
            },
          ],
        }),
      "production target and must not carry host-side",
    ),
    true,
  );

  const emptyProductionTargetPattern = root();
  write(
    emptyProductionTargetPattern,
    "docs/settings/production.md",
    "## Scope {#scope}\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(emptyProductionTargetPattern),
          kind: "brief",
          settings: "draft",
          claims: [
            {
              ...productionOwnedClaim,
              disabled: false,
              reference: {
                type: "markdown",
                root: "docs",
                files: ["production-principles/missing.md"],
                symbol: "h2",
                checklist: true,
                noEvidenceExclude: true,
              },
            },
          ],
        }),
      "empty reference population",
    ),
    true,
  );

  const emptyProductionHostPattern = root();
  write(
    emptyProductionHostPattern,
    "docs/production-principles/tone.md",
    target("Tone", "tone"),
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(emptyProductionHostPattern),
          claims: [
            {
              ...productionOwnedClaim,
              disabled: false,
            },
          ],
        }),
      "selects no host file",
    ),
    true,
  );

  const advancedClaims = root();
  write(
    advancedClaims,
    "docs/settings/production.md",
    "## Scope {#scope}\n\nSupporting detail.\n",
  );
  write(
    advancedClaims,
    "docs/production-principles/tone.md",
    target("Tone", "tone"),
  );
  write(advancedClaims, "support.ts", "export const support = true;\n");
  const advancedClaim: Claim = {
    name: "production target validation exercises every supported reference route",
    type: "markdown",
    root: "docs",
    files: ["settings/**/*.md"],
    symbol: "file",
    reference: [
      {
        type: "markdown",
        root: "docs",
        files: [
          "**/*.md",
          "**/**/absent.md",
          "production-principles/**",
          "!production-principles/other.md",
          "production-*/tone.md",
          "settings/**/*.md",
          "README.md",
        ],
        symbol: ["h1", "h2"],
      },
      {
        type: "markdown",
        root: "docs/production-principles",
        files: ["tone.md"],
        symbol: "h2",
      },
      {
        type: "typescript",
        files: ["support.ts"],
        symbol: "property",
      },
      {
        type: "typescript",
        package: "@automovie/interface",
      },
      {
        type: "swagger",
        file: "https://example.invalid/openapi.json",
      },
    ],
  };
  const activeTypeScriptClaim: Claim = {
    name: "local TypeScript claim validation",
    type: "typescript",
    files: ["support.ts"],
    symbol: "property",
    reference: {
      type: "markdown",
      root: "docs",
      files: ["production-principles/tone.md"],
      symbol: "h2",
    },
  };
  const activePrismaClaim = {
    name: "non-file-validator claim kinds remain the evidence plugin's owner",
    type: "prisma",
    files: ["schema.prisma"],
    symbol: "model",
    reference: {
      type: "markdown",
      root: "docs",
      files: ["production-principles/tone.md"],
      symbol: "h2",
    },
  } as unknown as Claim;
  assert.doesNotThrow(() =>
    createAutoMovieEvidenceConfig({
      ...disabled(advancedClaims),
      kind: "library",
      settings: "draft",
      claims: [advancedClaim, activeTypeScriptClaim, activePrismaClaim],
    }),
  );

  const projectRootTarget = root();
  write(
    projectRootTarget,
    "docs/production-principles/rooted.md",
    target("Project-rooted target", "project-rooted-target"),
  );
  assert.doesNotThrow(() =>
    createAutoMovieEvidenceConfig({
      ...disabled(projectRootTarget),
      claims: [
        {
          ...productionOwnedClaim,
          reference: {
            type: "markdown",
            root: ".",
            files: ["docs/production-principles/rooted.md"],
            symbol: "h2",
            checklist: true,
            noEvidenceExclude: true,
          },
        },
      ],
    }),
  );

  for (const pattern of [
    "./production-principles/rooted.md",
    "production-principles\\rooted.md",
    "production-principles/rooted.md/",
  ])
    assert.doesNotThrow(() =>
      createAutoMovieEvidenceConfig({
        ...disabled(projectRootTarget),
        claims: [
          {
            ...productionOwnedClaim,
            reference: {
              type: "markdown",
              root: "docs",
              files: [pattern],
              symbol: "h2",
              checklist: true,
              noEvidenceExclude: true,
            },
          },
        ],
      }),
    );

  const embeddedDoubleStar = root();
  write(
    embeddedDoubleStar,
    "docs/production-principles/t/o/ne.md",
    target("Embedded double-star boundary", "embedded-double-star-boundary"),
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(embeddedDoubleStar),
          claims: [
            {
              ...productionOwnedClaim,
              reference: {
                type: "markdown",
                root: "docs",
                files: ["production-principles/t**ne.md"],
                symbol: "h2",
                checklist: true,
                noEvidenceExclude: true,
              },
            },
          ],
        }),
      "production target with no additive claim reference",
    ),
    true,
  );

  const outsideReference = root();
  const outsideClaim = {
    name: "an external target is not mistaken for a production-local target",
    type: "prisma",
    root: ".",
    files: ["schema.prisma"],
    symbol: "model",
    disabled: true,
    reference: {
      type: "markdown",
      files: ["principle.md"],
      symbol: "h2",
    },
  } as unknown as Claim;
  assert.doesNotThrow(() =>
    createAutoMovieEvidenceConfig({
      ...disabled(outsideReference),
      claims: [outsideClaim],
    }),
  );

  const emptyReferences = root();
  write(emptyReferences, "docs/settings/production.md", "## Scope {#scope}\n");
  const referenceLess = {
    ...productionOwnedClaim,
    disabled: false,
    reference: [],
  } as Claim;
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(emptyReferences),
          kind: "library",
          settings: "draft",
          claims: [referenceLess],
        }),
      "selects no reference population",
    ),
    true,
  );

  const wrongExtensionReference = root();
  write(
    wrongExtensionReference,
    "docs/settings/production.md",
    "## Scope {#scope}\n",
  );
  write(
    wrongExtensionReference,
    "support.ts",
    "export const support = true;\n",
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(wrongExtensionReference),
          kind: "library",
          settings: "draft",
          claims: [
            {
              ...productionOwnedClaim,
              disabled: false,
              reference: {
                type: "markdown",
                root: "support.ts",
                files: [""],
                symbol: "h2",
              },
            },
          ],
        }),
      "empty reference population",
    ),
    true,
  );

  const missingLocalTypeScriptFiles = root();
  write(
    missingLocalTypeScriptFiles,
    "docs/settings/production.md",
    "## Scope {#scope}\n",
  );
  const filelessReference = {
    ...productionOwnedClaim,
    disabled: false,
    reference: {
      type: "typescript",
      symbol: "property",
    },
  } as Claim;
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(missingLocalTypeScriptFiles),
          kind: "library",
          settings: "draft",
          claims: [filelessReference],
        }),
      "empty reference population",
    ),
    true,
  );

  const partiallyEmptyTargets = root();
  write(
    partiallyEmptyTargets,
    "docs/settings/production.md",
    "## Scope {#scope}\n",
  );
  write(
    partiallyEmptyTargets,
    "docs/production-principles/tone.md",
    target("Tone", "tone"),
  );
  assert.equal(
    throws(
      () =>
        createAutoMovieEvidenceConfig({
          ...disabled(partiallyEmptyTargets),
          kind: "library",
          settings: "draft",
          claims: [
            {
              ...productionOwnedClaim,
              disabled: false,
              reference: {
                type: "markdown",
                root: "docs",
                files: [
                  "production-principles/tone.md",
                  "production-principles/missing.md",
                ],
                symbol: "h2",
              },
            },
          ],
        }),
      "production-principles/missing.md selects no Markdown target",
    ),
    true,
  );

  const { claims: omittedClaims, ...withoutClaims } = disabled(root());
  void omittedClaims;
  assert.doesNotThrow(() => createAutoMovieEvidenceConfig(withoutClaims));

  process.stdout.write("production evidence graph canaries passed\n");
} finally {
  for (const directory of roots)
    fs.rmSync(directory, { force: true, recursive: true });
}
