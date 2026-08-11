import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript-compiler";

interface IExampleClaim {
  /** Example source file, relative to `src/examples`. */
  file: string;
  /** Distinctive sentence from this symbol's own JSDoc. */
  probe: string;
  /** Directly exported symbol the prose teaches. */
  symbol: string;
}

type ExampleDeclarationKind =
  | "class"
  | "enum"
  | "function"
  | "interface"
  | "namespace"
  | "type"
  | "variable";

interface IExampleExport {
  /** Example source file, relative to `src/examples`. */
  file: string;
  /** Every JSDoc block attached directly to the declaration. */
  jsDoc: string;
  /** Declaration form carrying the exported symbol. */
  kind: ExampleDeclarationKind;
  /** Whether the declaration explicitly returns `void`. */
  returnsVoid: boolean;
  /** Directly exported symbol name. */
  symbol: string;
}

interface IExampleSourceScan {
  exports: IExampleExport[];
  violations: string[];
}

type ExampleExemptionReason = "self-check";

const ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const EXAMPLES_ROOT = path.join(ROOT, "packages/cli/scaffold/src/examples");
const MINIMUM_PROBE_LENGTH = 20;
const SENTENCE_END = /[.!?]$/u;

const CLAIMS: IExampleClaim[] = [
  {
    file: "buildings.ts",
    symbol: "ExampleBuilding",
    probe:
      "Everything repeated is written once: a storey's slab, its logical space, its room, its door, and the stair up to it are all derived from one index, so raising `storeys` cannot leave a copied record behind.",
  },
  {
    file: "designReferences.ts",
    symbol: "OBSERVED_PAVILION_PLAN",
    probe: "A plan image is never turned into a building.",
  },
  {
    file: "designReferences.ts",
    symbol: "PAVILION_DESIGN_EVIDENCE",
    probe:
      "The authored wall had to sit somewhere, so the author chose one and wrote down why — but the competing reading stays attached to the decision instead of disappearing the moment a wall existed.",
  },
  {
    file: "designReferences.ts",
    symbol: "readPavilionPlan",
    probe:
      "Out of three readings, exactly one becomes geometry; the two north candidates stay observations because they contradict each other, and two analyses report that they produced nothing.",
  },
  {
    file: "drawings.ts",
    symbol: "exampleFloorPlanView",
    probe:
      "A view is a **question asked of a design**, never a second copy of it.",
  },
  {
    file: "drawings.ts",
    symbol: "exampleFloorPlan",
    probe:
      "Keeping linework, regions, opening marks, dimensions, and notes behind this derivation prevents the plan from becoming a second authored geometry copy.",
  },
  {
    file: "drawings.ts",
    symbol: "exampleOpeningSchedule",
    probe:
      "`total` is the design's own opening count by construction, which is what makes the schedule and the sheet two readings rather than two documents.",
  },
  {
    file: "drawings.ts",
    symbol: "exampleQuantities",
    probe:
      "Every number is arithmetic over authored geometry — a footprint's area, a void's arc area, a route's polyline length, a cell's decomposition — so a quantity cannot fall out of date with the model it came from.",
  },
  {
    file: "drawings.ts",
    symbol: "exampleFloorPlanSheet",
    probe:
      "Every stroke carries the element it came from, the layer it belongs to and its relation to the cut plane; every region carries its space and cell; every gap the derivation declared is carried through as a marker.",
  },
  {
    file: "finishes.ts",
    symbol: "tiledTexture",
    probe: "A base-color or emissive image is a colour and is stored in sRGB.",
  },
  {
    file: "finishes.ts",
    symbol: "tiledFinish",
    probe:
      "The three images are the same pattern measured three ways, so they share the transform.",
  },
  {
    file: "finishes.ts",
    symbol: "cutoutFinish",
    probe:
      "`mask` is a hard test, not a blend, so it neither sorts nor costs order dependence; it is what a leaf, a grille, a perforated panel or a chain-link screen is for.",
  },
  {
    file: "finishes.ts",
    symbol: "transmissiveFinish",
    probe:
      "Transmission is a physical lobe and needs `opaque` alpha coverage: alpha blending would fade the surface out, which is the opposite of light passing THROUGH it and picking up its tint and thickness on the way.",
  },
  {
    file: "finishes.ts",
    symbol: "emissiveFinish",
    probe:
      "The emissive colour is what the surface RADIATES, which is why it is separate from a bright base colour: a white lamp shade and a lit lamp shade differ by this field alone.",
  },
  {
    file: "finishes.ts",
    symbol: "imageLitEnvironment",
    probe:
      "`image` is a registered equirectangular HDR and is what makes a physically-based interior read at all — it supplies the sky through a window, the bounce off a floor, and the reflections metal and glass in the shot are showing.",
  },
  {
    file: "furnishings.ts",
    symbol: "exampleCurtainDomain",
    probe:
      "A curtain is a particle lattice plus the boundary conditions its states move; a plant is a branching law plus how far along it has grown.",
  },
  {
    file: "furnishings.ts",
    symbol: "examplePlantingDomain",
    probe: "Pruning is not clipping in the renderer.",
  },
  {
    file: "furnishings.ts",
    symbol: "examplePlantingCluster",
    probe:
      "Repetition is generated rather than hand-duplicated, and a member that cannot honour the spacing within its attempts is refused and counted instead of squeezed in.",
  },
  {
    file: "instanceSets.ts",
    symbol: "onlookerScatter",
    probe:
      "An instance set is the other way to put many bodies on screen: unlike a formation it has no rows to keep, so it states a scatter and the per-member variation the compiler draws from its seed.",
  },
  {
    file: "instanceSets.ts",
    symbol: "treeScatter",
    probe:
      "The count, placement law, and bounded variation describe the whole planting, so adding members does not add scene records or platform-dependent choices.",
  },
  {
    file: "instanceSets.ts",
    symbol: "latticeRepeat",
    probe:
      "This is the layout to reach for whenever a placement is a regular repetition — panels on a ceiling, modules on a wall, bays down a length — because it states the rule instead of the result.",
  },
  {
    file: "instanceSets.ts",
    symbol: "slopedFacadeWindows",
    probe:
      "A rake is why a facade needs full three-dimensional placement rather than a ground grid with one shared heading: every opening is both moved back as it rises and tilted by the same angle, so its own rotation is part of its placement.",
  },
  {
    file: "instanceSets.ts",
    symbol: "explicitPlacementLaw",
    probe:
      "When the rule is the author's own — a helix here, but equally a vault rib, a catenary, a measured survey, or anything else a function can produce — this is how it is expressed without inventing new layout vocabulary: emit one exact translation, unit quaternion, and per-axis scale per slot, keep a stable id on each, and the whole block still compiles to bounded instance chunks.",
  },
  {
    file: "props.ts",
    symbol: "ExamplePiece",
    probe:
      "What a piece contributes does not depend on the shot it appears in, so it states that once through {@link contribute} and hands the same answer to whichever shot asks, exactly as `WorldPiece` does in `src/world`.",
  },
  {
    file: "props.ts",
    symbol: "ExampleRoomShell",
    probe:
      "A relation cites stable ids, so a room has to exist before a prop can claim to be inside it: one logical space with a convex extent, one boundary, one opening cut through that boundary, one floor patch, and the visible slabs that realize them.",
  },
  {
    file: "props.ts",
    symbol: "ExamplePlacedProp",
    probe: "Spec and staging are one decision, not two.",
  },
  {
    file: "props.ts",
    symbol: "ExampleOnSupportSurface",
    probe:
      "The prop cites the floor's stable id rather than a height, so a floor that moves carries whatever stands on it, and a prop placed off the patch is a refusal rather than something hovering in a frame nobody checked.",
  },
  {
    file: "props.ts",
    symbol: "ExampleOnPropAffordance",
    probe:
      "The support is an affordance id on the other prop's model, so the relation survives the host moving and refuses the moment the host stops declaring that contact.",
  },
  {
    file: "props.ts",
    symbol: "ExampleSocketedIntoProp",
    probe:
      "`attached` differs from `on-support` in what the engine will accept: a socket carries no supporting face, so citing a `stack-top` here is refused by kind rather than by geometry.",
  },
  {
    file: "props.ts",
    symbol: "ExampleFixedToElement",
    probe:
      "The element is cited by id, so the prop travels with the wall it is on rather than with a world coordinate somebody copied once.",
  },
  {
    file: "props.ts",
    symbol: "ExampleSuspendedFromElement",
    probe:
      "`suspended` reads the same as `attached` in the graph and differently in meaning, which is what lets a later pass ask what is overhead without inspecting geometry.",
  },
  {
    file: "props.ts",
    symbol: "ExampleAgainstBoundary",
    probe:
      "The sliding part is an articulation joint with a channel limit, so how far it can come out is data the engine clamps and reports against, and the volume it sweeps is a keep-out box.",
  },
  {
    file: "props.ts",
    symbol: "ExampleOpeningLeaf",
    probe:
      "The leaf is cut from the opening's own dimensions, so it fits the reveal by construction; the engine still checks it, because a source that computes the size from somewhere else is exactly the case worth refusing.",
  },
  {
    file: "props.ts",
    symbol: "ExamplePlacementSuite",
    probe:
      "Six props around the host are a count and a radius, not six records: each one derives its own angle from the declared seed and its own slot, so the ring reproduces byte for byte every run and adding a seventh is a changed number.",
  },
  {
    file: "renderBudgets.ts",
    symbol: "EXAMPLE_RENDER_TEXTURE",
    probe:
      "The subject binds it as a material's base colour and the target fingerprints its bytes, and nothing in the engine holds those two lists against each other: a report is measured against whatever target it was handed.",
  },
  {
    file: "renderBudgets.ts",
    symbol: "exampleRenderSubject",
    probe:
      "The water body has no priced solver and the bound texture has no supplied dimensions, so the report must answer `unsupported` and `not-run` rather than granting a false pass to work nobody measured.",
  },
  {
    file: "renderBudgets.ts",
    symbol: "EXAMPLE_RENDER_BUDGET",
    probe:
      "Limits are inclusive, and an omitted metric is unbudgeted rather than unlimited.",
  },
  {
    file: "renderBudgets.ts",
    symbol: "exampleRenderTarget",
    probe:
      "A budget verdict is only evidence while the thing it measured is still the thing that will be drawn.",
  },
  {
    file: "renderBudgets.ts",
    symbol: "exampleRenderReport",
    probe:
      "The mask and the inventory read the same subject, which is the only reason a colour in the mask and a cost in the report can name the same owner.",
  },
  {
    file: "renovation.ts",
    symbol: "EXAMPLE_RENOVATION",
    probe: "Lineage annotates identities; it never holds geometry.",
  },
  {
    file: "renovation.ts",
    symbol: "exampleBuildingIdentities",
    probe:
      "Lineage cannot see the graphs it annotates, so a renamed partition leaves a phase plan quietly talking about nothing.",
  },
  {
    file: "renovation.ts",
    symbol: "exampleRegisteredAssets",
    probe:
      "Lineage spans every graph a production publishes ids from, not only the building, so the roll-call it is checked against has to span them too.",
  },
  {
    file: "renovation.ts",
    symbol: "exampleRenovationPhases",
    probe: "Derive construction order from the prerequisite graph.",
  },
  {
    file: "renovation.ts",
    symbol: "exampleRenovationAt",
    probe:
      "A scene, a drawing, a schedule, and a render all read this one answer rather than each deciding for itself.",
  },
  {
    file: "renovation.ts",
    symbol: "exampleRenovationElementsAt",
    probe:
      "The filter is generic over anything carrying an id, which is the point: the same call phases set pieces, drawing rows, schedule lines, and draw calls.",
  },
  {
    file: "renovation.ts",
    symbol: "exampleRenovationAlternatives",
    probe: "Compare alternatives over the identities both schemes retain.",
  },
  {
    file: "renovation.ts",
    symbol: "exampleRenovationDoorImpact",
    probe:
      '"Everything is stale" is always correct and never useful, so the answer names the untouched outputs too.',
  },
  {
    file: "renovation.ts",
    symbol: "exampleRenovationViewDigest",
    probe:
      "The same alternative at the same phase digests identically on every run and every platform; a different alternative, a different phase, or an imported asset whose bytes moved all produce a different value.",
  },
  {
    file: "services.ts",
    symbol: "exampleServiceNetwork",
    probe:
      "So the fact worth authoring is not the pipe, it is the **graph**: equipment that owns typed ports, runs that join exactly two of them, and a system that says which end the medium is measured from.",
  },
  {
    file: "services.ts",
    symbol: "exampleServiceGeometry",
    probe:
      "The lowering is a derivation and nothing more: a regular section swept along the authored centre line, in world coordinates, with no fitting library and no per-discipline appearance.",
  },
  {
    file: "waterFeatures.ts",
    symbol: "exampleBasinDomain",
    probe: "The solver is not part of the building.",
  },
  {
    file: "waterFeatures.ts",
    symbol: "exampleBasinFeature",
    probe: "Nothing here restates geometry.",
  },
];

const compareCodeUnits = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const keyOf = (entry: { file: string; symbol: string }): string =>
  `${entry.file}#${entry.symbol}`;

const duplicateKeys = (keys: readonly string[]): string[] =>
  keys
    .filter((key, index) => keys.indexOf(key) !== index)
    .filter((key, index, all) => all.indexOf(key) === index)
    .sort(compareCodeUnits);

const bindingNames = (name: ts.BindingName): string[] =>
  ts.isIdentifier(name)
    ? [name.text]
    : name.elements.flatMap((element) =>
        ts.isOmittedExpression(element) ? [] : bindingNames(element.name),
      );

const declarationReturnsVoid = (node: ts.Node): boolean => {
  if (ts.isFunctionDeclaration(node))
    return node.type?.kind === ts.SyntaxKind.VoidKeyword;
  if (ts.isVariableDeclaration(node)) {
    const initializer = node.initializer;
    return (
      initializer !== undefined &&
      (ts.isArrowFunction(initializer) ||
        ts.isFunctionExpression(initializer)) &&
      initializer.type?.kind === ts.SyntaxKind.VoidKeyword
    );
  }
  return false;
};

const normalizeJsDoc = (text: string): string =>
  text
    .replace(/^\/\*\*/u, "")
    .replace(/\*\/$/u, "")
    .replace(/^\s*\*\s?/gmu, "")
    .replace(/\s+/gu, " ")
    .trim();

const jsDocOf = (node: ts.Node, source: ts.SourceFile): string => {
  const documented = node as ts.Node & {
    jsDoc?: readonly ts.JSDoc[];
  };
  return (documented.jsDoc ?? [])
    .map((comment) => normalizeJsDoc(comment.getText(source)))
    .join(" ");
};

const hasModifier = (node: ts.Node, kind: ts.SyntaxKind): boolean =>
  (ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined)?.some(
    (modifier) => modifier.kind === kind,
  ) === true;

const directNamedExport = (
  file: string,
  node: ts.Node,
  source: ts.SourceFile,
): IExampleExport[] | null => {
  const jsDoc = jsDocOf(node, source);
  const named = (
    symbol: string,
    kind: ExampleDeclarationKind,
    returnsVoid = false,
  ): IExampleExport[] => [{ file, jsDoc, kind, returnsVoid, symbol }];

  if (ts.isVariableStatement(node))
    return node.declarationList.declarations.flatMap((variable) =>
      bindingNames(variable.name).map((symbol) => ({
        file,
        jsDoc,
        kind: "variable" as const,
        returnsVoid: declarationReturnsVoid(variable),
        symbol,
      })),
    );
  if (ts.isClassDeclaration(node) && node.name !== undefined)
    return named(node.name.text, "class");
  if (ts.isFunctionDeclaration(node) && node.name !== undefined)
    return named(node.name.text, "function", declarationReturnsVoid(node));
  if (ts.isInterfaceDeclaration(node))
    return named(node.name.text, "interface");
  if (ts.isTypeAliasDeclaration(node)) return named(node.name.text, "type");
  if (ts.isEnumDeclaration(node)) return named(node.name.text, "enum");
  if (ts.isModuleDeclaration(node))
    return named(node.name.getText(source), "namespace");
  return null;
};

const scanExampleSource = (file: string, text: string): IExampleSourceScan => {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const barrel = path.basename(file) === "index.ts";
  const output: IExampleExport[] = [];
  const violations: string[] = [];

  for (const node of source.statements) {
    if (barrel) {
      if (
        ts.isExportDeclaration(node) ||
        ts.isImportDeclaration(node) ||
        ts.isEmptyStatement(node)
      )
        continue;
      violations.push(
        `${file}: index.ts may only contain imports and re-exports`,
      );
      continue;
    }
    if (ts.isExportDeclaration(node)) {
      violations.push(`${file}: re-export declarations belong in index.ts`);
      continue;
    }
    if (ts.isExportAssignment(node)) {
      violations.push(`${file}: export assignments have no stable symbol name`);
      continue;
    }
    if (hasModifier(node, ts.SyntaxKind.ExportKeyword) === false) continue;
    if (hasModifier(node, ts.SyntaxKind.DefaultKeyword)) {
      violations.push(`${file}: default exports have no stable example symbol`);
      continue;
    }
    const found = directNamedExport(file, node, source);
    if (found === null) {
      violations.push(
        `${file}: unsupported direct export ${ts.SyntaxKind[node.kind]}`,
      );
      continue;
    }
    output.push(...found);
  }
  return { exports: output, violations };
};

const exampleSources = (
  root: string,
  prefix = "",
): Array<{ file: string; text: string }> =>
  fs
    .readdirSync(root, { withFileTypes: true })
    .flatMap((entry) => {
      const relative = `${prefix}${entry.name}`;
      const absolute = path.join(root, entry.name);
      if (entry.isDirectory()) return exampleSources(absolute, `${relative}/`);
      return entry.name.endsWith(".ts")
        ? [{ file: relative, text: fs.readFileSync(absolute, "utf8") }]
        : [];
    })
    .sort((left, right) => compareCodeUnits(left.file, right.file));

const exemptionReason = (
  entry: IExampleExport,
): ExampleExemptionReason | null =>
  (entry.kind === "function" || entry.kind === "variable") &&
  /^checkExample[A-Z][A-Za-z0-9]*$/u.test(entry.symbol) &&
  entry.returnsVoid
    ? "self-check"
    : null;

const isExampleExemptionReason = (
  value: string,
): value is ExampleExemptionReason => value === "self-check";

const isSentenceProbe = (probe: string): boolean => SENTENCE_END.test(probe);

const probeProblems = (
  population: readonly IExampleExport[],
  claims: readonly IExampleClaim[],
): string[] => {
  const byKey = new Map(population.map((entry) => [keyOf(entry), entry]));
  return claims.flatMap((claim) => {
    const key = keyOf(claim);
    const entry = byKey.get(key);
    if (entry === undefined) return [`${key}: claim names no export`];
    const output: string[] = [];
    if (claim.probe.length < MINIMUM_PROBE_LENGTH)
      output.push(`${key}: probe is shorter than ${MINIMUM_PROBE_LENGTH}`);
    if (isSentenceProbe(claim.probe) === false)
      output.push(`${key}: probe is not a complete sentence`);
    const occurrences = entry.jsDoc.split(claim.probe).length - 1;
    if (occurrences !== 1)
      output.push(`${key}: own JSDoc contains the probe ${occurrences} times`);
    const elsewhere = population
      .filter(
        (candidate) =>
          keyOf(candidate) !== key && candidate.jsDoc.includes(claim.probe),
      )
      .map(keyOf)
      .sort(compareCodeUnits);
    if (elsewhere.length !== 0)
      output.push(`${key}: probe also occurs in ${elsewhere.join(", ")}`);
    return output;
  });
};

/**
 * Gate every exported scaffold example as one teaching claim or one closed
 * self-check exemption.
 *
 * The gate proves that a distinctive sentence exists in the exported symbol's
 * own JSDoc and nowhere else in the example population. It cannot judge whether
 * that sentence teaches a worthwhile universal technique or merely sounds as if
 * it does. Review owns prose quality and the capability-versus-content
 * decision.
 *
 * Scenarios:
 *
 * 1. The 58 current exports are classified exactly once as 52 claims and six
 *    explicitly void `checkExample*` self-checks.
 * 2. Every claim carries a sufficiently long complete-sentence probe occurring
 *    exactly once in its own JSDoc and in no other exported example's JSDoc.
 * 3. A synthetic unclaimed export remains unclassified, while duplicating one
 *    claim is reported by its stable file-and-symbol key.
 * 4. `self-check` is the only exemption reason: an arbitrary helper reason and a
 *    check-shaped function returning a value are both refused.
 * 5. Unexported helpers and class members stay outside the population, a barrel
 *    does not duplicate its source declarations, and a re-export outside an
 *    `index.ts` barrel is rejected.
 * 6. All twelve exports retained by the buildings and props audit remain claims
 *    rather than acquiring an exemption.
 * 7. Synthetic declaration, barrel, filesystem, and claim-error boundaries
 *    exercise every branch of the scanner instead of relying on today's files
 *    to retain a particular syntax shape.
 */
export const test_cli_scaffold_example_claims = (): void => {
  const scans = exampleSources(EXAMPLES_ROOT).map(({ file, text }) =>
    scanExampleSource(file, text),
  );
  const population = scans
    .flatMap((scan) => scan.exports)
    .sort((left, right) => compareCodeUnits(keyOf(left), keyOf(right)));
  TestValidator.equals(
    "every example source uses a classifiable export form",
    scans.flatMap((scan) => scan.violations),
    [],
  );

  const exemptions = population.filter(
    (entry) => exemptionReason(entry) === "self-check",
  );
  const claimKeys = CLAIMS.map(keyOf);
  const classified = [...claimKeys, ...exemptions.map(keyOf)].sort(
    compareCodeUnits,
  );
  const populationKeys = population.map(keyOf);
  TestValidator.equals(
    "every exported example is claimed or exempted exactly once",
    classified,
    populationKeys,
  );
  TestValidator.equals(
    "no example classification is duplicated",
    duplicateKeys([...claimKeys, ...exemptions.map(keyOf)]),
    [],
  );
  TestValidator.equals(
    "the current population holds 52 claims and 6 self-checks",
    {
      claims: CLAIMS.length,
      exemptions: exemptions.length,
      population: population.length,
    },
    { claims: 52, exemptions: 6, population: 58 },
  );

  TestValidator.equals(
    "every technique probe belongs to exactly one exported example",
    probeProblems(population, CLAIMS),
    [],
  );
  TestValidator.equals(
    "a sentence fragment cannot serve as technique evidence",
    isSentenceProbe("A distinctive sentence fragment"),
    false,
  );

  const unclaimed = scanExampleSource(
    "unclaimed.ts",
    "/** A new example with no recorded technique. */\nexport const unclaimed = true;",
  ).exports;
  const claimSet = new Set(claimKeys);
  TestValidator.equals(
    "an unclaimed export remains visible to the gate",
    unclaimed
      .filter(
        (entry) =>
          claimSet.has(keyOf(entry)) === false &&
          exemptionReason(entry) === null,
      )
      .map(keyOf),
    ["unclaimed.ts#unclaimed"],
  );
  TestValidator.equals(
    "a duplicate claim is reported by stable key",
    duplicateKeys([...claimKeys, claimKeys[0]!]),
    [claimKeys[0]!],
  );
  TestValidator.equals(
    "stable code-unit ordering covers both directions and equality",
    [
      compareCodeUnits("a", "b"),
      compareCodeUnits("b", "a"),
      compareCodeUnits("a", "a"),
    ],
    [-1, 1, 0],
  );

  TestValidator.equals(
    "the exemption reason vocabulary is closed",
    ["self-check", "shared-helper"].filter(isExampleExemptionReason),
    ["self-check"],
  );
  const valueCheck = scanExampleSource(
    "valueCheck.ts",
    "/** A check-shaped value producer. */\nexport const checkExampleValue = (): number => 1;",
  ).exports[0]!;
  TestValidator.equals(
    "a check-shaped value producer is not exempt",
    exemptionReason(valueCheck),
    null,
  );
  const untypedCheck = scanExampleSource(
    "untypedCheck.ts",
    "/** A check with no explicit void contract. */\nexport function checkExampleUntyped() {}",
  ).exports[0]!;
  TestValidator.equals(
    "an untyped check is not exempt",
    exemptionReason(untypedCheck),
    null,
  );
  const numberCheck = scanExampleSource(
    "numberCheck.ts",
    "/** A check with a non-void return contract. */\nexport function checkExampleNumber(): number { return 1; }",
  ).exports[0]!;
  TestValidator.equals(
    "a number-returning function declaration is not exempt",
    exemptionReason(numberCheck),
    null,
  );
  const functionExpressionCheck = scanExampleSource(
    "functionExpressionCheck.ts",
    "/** An explicitly void function expression. */\nexport const checkExampleExpression = function (): void {};",
  ).exports[0]!;
  TestValidator.equals(
    "an explicitly void function expression is a self-check",
    exemptionReason(functionExpressionCheck),
    "self-check",
  );

  const direct = scanExampleSource(
    "direct.ts",
    [
      "const helper = true;",
      "/** A directly exported technique. */",
      "export const technique = helper;",
      "/** A class is one export, not one export per member. */",
      "export class Example { public method(): void {} }",
    ].join("\n"),
  );
  TestValidator.equals(
    "unexported helpers and class members stay outside the population",
    direct.exports.map(keyOf),
    ["direct.ts#technique", "direct.ts#Example"],
  );
  const declarationForms = scanExampleSource(
    "declarationForms.ts",
    [
      "/** A destructured export. */",
      "export const [first, , third] = [1, 2, 3];",
      "/** A declaration without an initializer. */",
      "export declare const declared: boolean;",
      "/** An interface export. */",
      "export interface Contract {}",
      "/** A type export. */",
      "export type Choice = true;",
      "/** An enum export. */",
      "export enum Kind { One }",
      "/** A namespace export. */",
      "export namespace Scope {}",
    ].join("\n"),
  );
  TestValidator.equals(
    "all stable named declaration forms enter the population",
    declarationForms.exports.map((entry) => ({
      key: keyOf(entry),
      kind: entry.kind,
    })),
    [
      { key: "declarationForms.ts#first", kind: "variable" },
      { key: "declarationForms.ts#third", kind: "variable" },
      { key: "declarationForms.ts#declared", kind: "variable" },
      { key: "declarationForms.ts#Contract", kind: "interface" },
      { key: "declarationForms.ts#Choice", kind: "type" },
      { key: "declarationForms.ts#Kind", kind: "enum" },
      { key: "declarationForms.ts#Scope", kind: "namespace" },
    ],
  );
  const undocumented = scanExampleSource(
    "undocumented.ts",
    "export const undocumented = true;",
  ).exports[0]!;
  TestValidator.equals(
    "an undocumented export keeps an empty evidence surface",
    undocumented.jsDoc,
    "",
  );
  const classNode = ts.createSourceFile(
    "class.ts",
    "class Example {}",
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  ).statements[0]!;
  TestValidator.equals(
    "a non-callable declaration cannot return void",
    declarationReturnsVoid(classNode),
    false,
  );
  TestValidator.equals(
    "a source file cannot carry an export modifier",
    hasModifier(classNode.getSourceFile(), ts.SyntaxKind.ExportKeyword),
    false,
  );
  TestValidator.equals(
    "an index barrel does not duplicate source declarations",
    scanExampleSource("index.ts", 'export * from "./direct";'),
    { exports: [], violations: [] },
  );
  TestValidator.equals(
    "a barrel accepts imports and empty statements but no local declarations",
    scanExampleSource("index.ts", 'import "./direct";\n;\nconst local = true;')
      .violations,
    ["index.ts: index.ts may only contain imports and re-exports"],
  );
  TestValidator.equals(
    "a re-export outside an index barrel is refused",
    scanExampleSource("misplaced.ts", 'export { technique } from "./direct";')
      .violations,
    ["misplaced.ts: re-export declarations belong in index.ts"],
  );
  TestValidator.equals(
    "an export assignment is refused",
    scanExampleSource("assignment.ts", "const value = true; export = value;")
      .violations,
    ["assignment.ts: export assignments have no stable symbol name"],
  );
  TestValidator.equals(
    "a default export is refused",
    scanExampleSource("default.ts", "export default class Example {}")
      .violations,
    ["default.ts: default exports have no stable example symbol"],
  );
  TestValidator.equals(
    "an unsupported direct export is refused",
    scanExampleSource("alias.ts", 'export import Alias = require("./direct");')
      .violations,
    ["alias.ts: unsupported direct export ImportEqualsDeclaration"],
  );

  const discoveryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-example-claims-"),
  );
  try {
    fs.mkdirSync(path.join(discoveryRoot, "nested"));
    fs.writeFileSync(path.join(discoveryRoot, "root.ts"), "export {};", "utf8");
    fs.writeFileSync(
      path.join(discoveryRoot, "nested", "nested.ts"),
      "export {};",
      "utf8",
    );
    fs.writeFileSync(
      path.join(discoveryRoot, "nested", "ignored.txt"),
      "not TypeScript",
      "utf8",
    );
    TestValidator.equals(
      "source discovery recurses and ignores non-TypeScript files",
      exampleSources(discoveryRoot).map(({ file }) => file),
      ["nested/nested.ts", "root.ts"],
    );
  } finally {
    fs.rmSync(discoveryRoot, { recursive: true });
  }

  const repeatedProbe = "A repeated technique sentence.";
  const probePopulation = [
    ...scanExampleSource(
      "probe.ts",
      `/** ${repeatedProbe} ${repeatedProbe} */\nexport const probe = true;`,
    ).exports,
    ...scanExampleSource(
      "mirror.ts",
      `/** ${repeatedProbe} */\nexport const mirror = true;`,
    ).exports,
  ];
  TestValidator.equals(
    "claim errors report missing, weak, repeated, and shared evidence",
    probeProblems(probePopulation, [
      { file: "missing.ts", symbol: "missing", probe: repeatedProbe },
      { file: "probe.ts", symbol: "probe", probe: "Too short" },
      { file: "probe.ts", symbol: "probe", probe: repeatedProbe },
    ]),
    [
      "missing.ts#missing: claim names no export",
      `probe.ts#probe: probe is shorter than ${MINIMUM_PROBE_LENGTH}`,
      "probe.ts#probe: probe is not a complete sentence",
      "probe.ts#probe: own JSDoc contains the probe 0 times",
      "probe.ts#probe: own JSDoc contains the probe 2 times",
      "probe.ts#probe: probe also occurs in mirror.ts#mirror",
    ],
  );

  const audited = population.filter(
    (entry) => entry.file === "buildings.ts" || entry.file === "props.ts",
  );
  TestValidator.equals(
    "the buildings and props audit retains twelve explicit claims",
    {
      claims: audited.filter((entry) => claimSet.has(keyOf(entry))).length,
      exemptions: audited.filter((entry) => exemptionReason(entry) !== null)
        .length,
      population: audited.length,
    },
    { claims: 12, exemptions: 0, population: 12 },
  );
};
