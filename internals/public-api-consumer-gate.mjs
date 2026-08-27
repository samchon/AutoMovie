import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import ts from "typescript-compiler";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE_EXTENSION = /\.(?:[cm]?ts|tsx)$/u;
const SKIPPED_DIRECTORIES = new Set(["dist", "lib", "node_modules"]);
const PLACEHOLDER =
  /^(?:future|later|n\/a|na|none|pending|tbd|todo|unknown|unspecified)$/iu;
const PLACEHOLDER_REASON =
  /^(?:later|n\/a|na|none|pending|tbd|todo|unknown|unspecified)\b/iu;

const walk = (directory) => {
  if (fs.existsSync(directory) === false) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory())
      return SKIPPED_DIRECTORIES.has(entry.name) ? [] : walk(target);
    return entry.isFile() &&
      SOURCE_EXTENSION.test(entry.name) &&
      entry.name.endsWith(".d.ts") === false
      ? [target]
      : [];
  });
};

const walkMarkdown = (directory) => {
  if (fs.existsSync(directory) === false) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory()
      ? walkMarkdown(target)
      : entry.isFile() && entry.name.endsWith(".md")
        ? [target]
        : [];
  });
};

const inside = (file, directory) => {
  const relative = path.relative(path.resolve(directory), path.resolve(file));
  return (
    relative !== "" &&
    relative !== ".." &&
    relative.startsWith(`..${path.sep}`) === false &&
    path.isAbsolute(relative) === false
  );
};

const originalSymbol = (checker, symbol) => {
  let current = symbol;
  const seen = new Set();
  while (
    (current.flags & ts.SymbolFlags.Alias) !== 0 &&
    seen.has(current) === false
  ) {
    seen.add(current);
    current = checker.getAliasedSymbol(current);
  }
  return current;
};

const declarationOf = (checker, symbol) => {
  const original = originalSymbol(checker, symbol);
  return original.valueDeclaration ?? original.declarations?.[0];
};

const declarationKey = (declaration) =>
  `${path.resolve(declaration.getSourceFile().fileName)}:${declaration.pos}:${declaration.end}`;

const packageRoots = (root) => {
  const directory = path.join(root, "packages");
  if (fs.existsSync(directory) === false) return [];
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(directory, entry.name))
    .filter((candidate) =>
      fs.existsSync(path.join(candidate, "src", "index.ts")),
    );
};

const packageName = (directory) => {
  const manifest = path.join(directory, "package.json");
  if (fs.existsSync(manifest) === false) return path.basename(directory);
  const parsed = JSON.parse(fs.readFileSync(manifest, "utf8"));
  return typeof parsed.name === "string"
    ? parsed.name
    : path.basename(directory);
};

const moduleSource = (program, file) =>
  program
    .getSourceFiles()
    .find(
      (candidate) => path.resolve(candidate.fileName) === path.resolve(file),
    );

const callableExports = (program, checker, directories) => {
  const exports = new Map();
  for (const directory of directories) {
    const entry = path.join(directory, "src", "index.ts");
    const source = moduleSource(program, entry);
    if (source === undefined)
      throw new Error(`Package entry was not loaded: ${entry}`);
    const module = source.symbol ?? checker.getSymbolAtLocation(source);
    if (module === undefined) continue;
    for (const exported of checker.getExportsOfModule(module)) {
      const symbol = originalSymbol(checker, exported);
      const declaration = symbol.valueDeclaration;
      if (
        declaration === undefined ||
        inside(declaration.getSourceFile().fileName, directory) === false
      )
        continue;
      const type = checker.getTypeOfSymbolAtLocation(symbol, declaration);
      if (checker.getSignaturesOfType(type, ts.SignatureKind.Call).length === 0)
        continue;
      const key = declarationKey(declaration);
      const record = exports.get(key) ?? {
        declaration,
        names: new Set(),
        package: packageName(directory),
        productReferences: [],
        testReferences: [],
      };
      record.names.add(exported.name);
      exports.set(key, record);
    }
  }
  return exports;
};

const declarationName = (node) => {
  const parent = node.parent;
  return (
    ((ts.isFunctionDeclaration(parent) ||
      ts.isVariableDeclaration(parent) ||
      ts.isMethodDeclaration(parent) ||
      ts.isClassDeclaration(parent) ||
      ts.isParameter(parent) ||
      ts.isBindingElement(parent)) &&
      parent.name === node) ||
    ts.isImportSpecifier(parent) ||
    ts.isExportSpecifier(parent) ||
    ts.isExportAssignment(parent) ||
    ts.isNamespaceImport(parent) ||
    ts.isImportClause(parent)
  );
};

const typePosition = (node) => {
  for (
    let current = node.parent;
    current !== undefined;
    current = current.parent
  ) {
    if (ts.isTypeNode(current)) return true;
    if (ts.isStatement(current) || ts.isExpression(current)) return false;
  }
  return false;
};

const collectReferences = (props) => {
  const packages = path.join(props.root, "packages");
  const tests = path.join(props.root, "test", "src");
  for (const source of props.program.getSourceFiles()) {
    const product = inside(source.fileName, packages);
    const test = inside(source.fileName, tests);
    if (!product && !test) continue;
    const visit = (node) => {
      if (
        ts.isIdentifier(node) &&
        declarationName(node) === false &&
        typePosition(node) === false
      ) {
        const symbol = props.checker.getSymbolAtLocation(node);
        const declaration =
          symbol === undefined
            ? undefined
            : declarationOf(props.checker, symbol);
        const record =
          declaration === undefined
            ? undefined
            : props.exports.get(declarationKey(declaration));
        if (
          record !== undefined &&
          !(
            source === record.declaration.getSourceFile() &&
            node.pos >= record.declaration.pos &&
            node.end <= record.declaration.end
          )
        ) {
          const position = source.getLineAndCharacterOfPosition(
            node.getStart(source),
          );
          (test ? record.testReferences : record.productReferences).push(
            `${path.relative(props.root, source.fileName)}:${position.line + 1}`,
          );
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

const documentationFiles = (root, directories) => [
  ...directories.flatMap((directory) => {
    const readme = path.join(directory, "README.md");
    return fs.existsSync(readme) ? [readme] : [];
  }),
  ...walkMarkdown(
    path.join(root, "packages", "template", "scaffold", ".agents", "skills"),
  ),
];

const documentedIn = (names, documents) => {
  for (const name of names) {
    const pattern = new RegExp(
      `(?<![A-Za-z0-9_$])${escapeRegExp(name)}(?![A-Za-z0-9_$])`,
      "u",
    );
    for (const document of documents)
      if (pattern.test(document.text)) return document.file;
  }
  return null;
};

const publicUnconsumed = (declaration) => {
  const source = declaration.getSourceFile();
  let host = declaration;
  while (host.parent !== undefined && ts.isStatement(host) === false)
    host = host.parent;
  const leading = source.text.slice(host.getFullStart(), host.getStart(source));
  const marker = /@publicUnconsumed\b/gu;
  const markers = [...leading.matchAll(marker)];
  if (markers.length === 0) return { kind: "absent" };
  const exact = [
    ...leading.matchAll(
      /@publicUnconsumed\s+([A-Za-z0-9_.:/-]+):\s+([^\r\n*][^\r\n]*)/gu,
    ),
  ];
  if (markers.length !== 1 || exact.length !== 1)
    return {
      kind: "invalid",
      reason: "expected exactly one planned-consumer and reason",
    };
  const planned = exact[0][1].trim();
  const reason = exact[0][2].replace(/\s*\*\/\s*$/u, "").trim();
  if (
    planned.length === 0 ||
    reason.length === 0 ||
    PLACEHOLDER.test(planned) ||
    PLACEHOLDER.test(reason) ||
    PLACEHOLDER_REASON.test(reason)
  )
    return {
      kind: "invalid",
      reason: "placeholder planned-consumer or reason",
    };
  return { kind: "valid", planned, reason };
};

const analyzePublicApiConsumers = (root) => {
  const directories = packageRoots(root);
  const roots = [
    walk(path.join(root, "packages")),
    walk(path.join(root, "test", "src")),
  ].flat();
  const program = ts.createProgram({
    rootNames: roots,
    options: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      noEmit: true,
      resolveJsonModule: true,
      skipLibCheck: true,
      strict: true,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const checker = program.getTypeChecker();
  const exports = callableExports(program, checker, directories);
  collectReferences({ root, program, checker, exports });
  const documents = documentationFiles(root, directories).map((file) => ({
    file: path.relative(root, file),
    text: fs.readFileSync(file, "utf8"),
  }));
  const findings = [];
  const testOnlyCallables = [];
  let documentedOnly = 0;
  for (const record of exports.values()) {
    const names = [...record.names].sort();
    const declaration = publicUnconsumed(record.declaration);
    const documented = documentedIn(names, documents);
    const references =
      record.productReferences.length + record.testReferences.length;
    const source = record.declaration.getSourceFile();
    const position = source.getLineAndCharacterOfPosition(
      record.declaration.getStart(source),
    );
    const base = {
      names,
      package: record.package,
      location: `${path.relative(root, source.fileName)}:${position.line + 1}`,
    };
    if (declaration.kind === "invalid")
      findings.push({
        ...base,
        code: "invalid-public-unconsumed",
        reason: declaration.reason,
      });
    else if (
      declaration.kind === "valid" &&
      (record.productReferences.length !== 0 || documented !== null)
    )
      findings.push({
        ...base,
        code: "stale-public-unconsumed",
        reason: "the declared early API now has a resolved repository consumer",
      });
    else if (
      references === 0 &&
      documented === null &&
      declaration.kind !== "valid"
    )
      findings.push({
        ...base,
        code: "unconsumed-public-callable",
        reason:
          "no resolved repository reference or reviewed authoring document",
      });
    if (
      record.productReferences.length === 0 &&
      record.testReferences.length !== 0 &&
      documented === null &&
      declaration.kind === "absent"
    )
      testOnlyCallables.push(base);
    if (references === 0 && documented !== null) documentedOnly++;
  }
  return {
    publicCallables: exports.size,
    testOnly: testOnlyCallables.length,
    testOnlyCallables: testOnlyCallables.sort((left, right) =>
      left.location.localeCompare(right.location),
    ),
    documentedOnly,
    findings: findings.sort((left, right) =>
      left.location.localeCompare(right.location),
    ),
  };
};

const writeFixture = (root) => {
  const source = path.join(root, "packages", "sample", "src");
  fs.mkdirSync(source, { recursive: true });
  fs.mkdirSync(path.join(root, "packages", "sample", "node_modules"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(root, "packages", "sample", "node_modules", "ignored.ts"),
    "export const ignored = (): void => undefined;\n",
  );
  fs.writeFileSync(
    path.join(root, "packages", "sample", "src", "ambient.d.ts"),
    "declare const ambient: string;\n",
  );
  fs.writeFileSync(
    path.join(root, "packages", "sample", "notes.txt"),
    "not source\n",
  );
  fs.writeFileSync(
    path.join(root, "packages", "sample", "package.json"),
    `${JSON.stringify({ name: "@automovie/gate-fixture" }, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(root, "packages", "sample", "README.md"),
    "The `documented` callable is the fixture's reviewed public surface.\n",
  );
  fs.writeFileSync(
    path.join(source, "index.ts"),
    'export * from "./surface";\nimport { called, stale } from "./surface";\ncalled();\nstale();\n',
  );
  fs.writeFileSync(
    path.join(source, "surface.ts"),
    [
      "called();",
      'export const called = (): string => "called";',
      "called();",
      "type CalledType = typeof called;",
      "missingFixtureSymbol();",
      "export const value = 1;",
      'export const documented = (): string => "documented";',
      "/** @publicUnconsumed future-renderer: lands before its tracked rendering consumer. */",
      'export const deliberate = (): string => "deliberate";',
      "/** @publicUnconsumed TBD: placeholder is not a decision. */",
      'export const malformed = (): string => "malformed";',
      "/** @publicUnconsumed future-renderer: TODO decide later */",
      'export const placeholderReason = (): string => "placeholder";',
      "/** @publicUnconsumed */",
      'export const malformedSyntax = (): string => "malformed-syntax";',
      'export const dead = (): string => "dead";',
      'export const tested = (): string => "tested";',
      "/** @publicUnconsumed future-reviewer: this marker must leave once called. */",
      'export const stale = (): string => "stale";',
      "export type CallableType = () => string;",
      "",
    ].join("\n"),
  );
  const tests = path.join(root, "test", "src");
  fs.mkdirSync(tests, { recursive: true });
  fs.writeFileSync(
    path.join(tests, "surface.test.ts"),
    'import { deliberate, tested } from "../../packages/sample/src/surface";\ndeliberate();\ntested();\n',
  );
  const skills = path.join(
    root,
    "packages",
    "template",
    "scaffold",
    ".agents",
    "skills",
    "nested",
  );
  fs.mkdirSync(skills, { recursive: true });
  fs.writeFileSync(path.join(skills, "SKILL.md"), "Fixture skill.\n");
  fs.writeFileSync(path.join(skills, "ignored.txt"), "Not Markdown.\n");
  const empty = path.join(root, "packages", "empty", "src");
  fs.mkdirSync(empty, { recursive: true });
  fs.writeFileSync(path.join(empty, "index.ts"), "");
};

const writeCleanFixture = (root) => {
  const source = path.join(root, "packages", "clean", "src");
  fs.mkdirSync(source, { recursive: true });
  fs.writeFileSync(
    path.join(root, "packages", "clean", "package.json"),
    `${JSON.stringify({ name: "@automovie/clean-fixture" }, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(source, "index.ts"),
    'export * from "./surface";\nimport { called } from "./surface";\ncalled();\n',
  );
  fs.writeFileSync(
    path.join(source, "surface.ts"),
    'export const called = (): string => "called";\n',
  );
};

const expectMismatch = (callback, message) => {
  try {
    callback();
  } catch (error) {
    if (error instanceof Error && error.message.includes(message)) return;
    throw error;
  }
  throw new Error(`Expected self-test mismatch containing "${message}".`);
};

const assertExitCode = (actual, expected, label) => {
  if (actual !== expected)
    throw new Error(
      `${label} produced exit code ${actual}; expected ${expected}.`,
    );
};

const selfTest = () => {
  const fixture = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-public-api-"),
  );
  const clean = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-public-api-"));
  try {
    writeFixture(fixture);
    writeCleanFixture(clean);
    walk(path.join(fixture, "absent"));
    walkMarkdown(path.join(fixture, "absent"));
    packageRoots(path.join(fixture, "absent"));
    const manifestless = path.join(fixture, "manifestless");
    fs.mkdirSync(manifestless);
    packageName(manifestless);
    const unnamed = path.join(fixture, "unnamed");
    fs.mkdirSync(unnamed);
    fs.writeFileSync(path.join(unnamed, "package.json"), '{"name":1}\n');
    packageName(unnamed);
    typePosition(ts.factory.createIdentifier("detached"));
    const unloaded = ts.createProgram({ rootNames: [], options: {} });
    expectMismatch(
      () =>
        callableExports(unloaded, unloaded.getTypeChecker(), [
          path.join(clean, "packages", "clean"),
        ]),
      "Package entry was not loaded",
    );
    const result = analyzePublicApiConsumers(fixture);
    const actual = result.findings.map((finding) => [
      finding.code,
      finding.names.join(","),
    ]);
    const expected = [
      ["unconsumed-public-callable", "dead"],
      ["invalid-public-unconsumed", "malformed"],
      ["invalid-public-unconsumed", "malformedSyntax"],
      ["invalid-public-unconsumed", "placeholderReason"],
      ["stale-public-unconsumed", "stale"],
    ].sort(
      ([leftCode, leftName], [rightCode, rightName]) =>
        leftCode.localeCompare(rightCode) || leftName.localeCompare(rightName),
    );
    actual.sort(
      ([leftCode, leftName], [rightCode, rightName]) =>
        leftCode.localeCompare(rightCode) || leftName.localeCompare(rightName),
    );
    const assertFindings = (observed) => {
      if (JSON.stringify(observed) !== JSON.stringify(expected))
        throw new Error(
          `Public API consumer self-test mismatch: ${JSON.stringify({ actual: observed, expected })}`,
        );
    };
    const assertPopulation = (observed) => {
      if (
        observed.publicCallables !== 9 ||
        observed.documentedOnly !== 1 ||
        observed.testOnly !== 1
      )
        throw new Error(
          `Public API consumer self-test population mismatch: ${JSON.stringify(observed)}`,
        );
    };
    assertFindings(actual);
    assertPopulation(result);
    expectMismatch(() => assertFindings([]), "self-test mismatch");
    expectMismatch(
      () => assertPopulation({ ...result, publicCallables: 0 }),
      "population mismatch",
    );
    expectMismatch(
      () => expectMismatch(() => undefined, "never"),
      "Expected self-test mismatch",
    );
    expectMismatch(
      () =>
        expectMismatch(() => {
          throw new Error("different mismatch");
        }, "wanted mismatch"),
      "different mismatch",
    );
    const output = { log: () => undefined, error: () => undefined };
    assertExitCode(
      main(["--list-test-only"], fixture, output),
      1,
      "Finding fixture",
    );
    assertExitCode(main([], clean, output), 0, "Clean fixture");
    expectMismatch(
      () => assertExitCode(0, 1, "Synthetic fixture"),
      "Synthetic fixture produced exit code",
    );
    expectMismatch(
      () => runGate(["--unknown"], clean, output),
      "Unknown arguments",
    );
    expectMismatch(
      () => main(["--self-test", "--list-test-only"], clean, output),
      "cannot be combined",
    );
    console.log(
      "Public API consumer gate self-test passed (9 callables, 5 expected refusals, 1 test-only report).",
    );
  } finally {
    fs.rmSync(fixture, { force: true, recursive: true });
    fs.rmSync(clean, { force: true, recursive: true });
  }
};

const runGate = (arguments_, root = ROOT, output = console) => {
  const unknown = arguments_.filter(
    (argument) => argument !== "--list-test-only",
  );
  if (unknown.length !== 0)
    throw new Error(`Unknown arguments: ${unknown.join(", ")}`);
  const result = analyzePublicApiConsumers(root);
  output.log(
    `Public API consumers: ${result.publicCallables} callables, ${result.documentedOnly} documented-only, ${result.testOnly} test-only.`,
  );
  if (arguments_.includes("--list-test-only"))
    for (const callable of result.testOnlyCallables)
      output.log(
        `test-only-public-callable: ${callable.package} ${callable.names.join(", ")} at ${callable.location}`,
      );
  if (result.findings.length === 0) {
    output.log("Public API consumer gate passed.");
    return 0;
  }
  for (const finding of result.findings)
    output.error(
      `${finding.code}: ${finding.package} ${finding.names.join(", ")} at ${finding.location}: ${finding.reason}`,
    );
  return 1;
};

const main = (arguments_, root = ROOT, output = console) => {
  if (arguments_.includes("--self-test")) {
    if (arguments_.length !== 1)
      throw new Error("--self-test cannot be combined with other arguments.");
    selfTest();
    return 0;
  }
  return runGate(arguments_, root, output);
};

process.exitCode = main(process.argv.slice(2));
