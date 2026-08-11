import { compareCodeUnits } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

/** Repository root, four levels above `test/src/features/workspace`. */
const ROOT = path.resolve(__dirname, "..", "..", "..", "..");

/** Markdown files below one directory in stable repository order. */
const markdownFiles = (root: string): string[] =>
  fs
    .readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort(compareCodeUnits);

/** Specification folders declared by one package lint config. */
const configuredFolders = (source: string): string[] => {
  const call = source.match(
    /automoviePackageLintConfig\(\[([\s\S]*?)\]\)/u,
  )?.[1];
  if (call === undefined) return [];
  return [...call.matchAll(/"([a-z][a-z0-9-]*)"/gu)].map((match) => match[1]!);
};

/**
 * The committed evidence graph is a partition, not a set of advisory globs.
 *
 * Every first-level specification directory has exactly one package owner,
 * every configured directory exists, and every controlled H2 or H3 carries an
 * explicit lowercase ASCII anchor. The compiler proves the citation edges; this
 * scenario proves that the package configs partition the denominator the
 * compiler reads instead of overlapping it or leaving a directory invisible.
 */
export const test_workspace_evidence_partition = (): void => {
  const specificationRoot = path.join(ROOT, "docs", "specifications");
  const specificationFolders = fs
    .readdirSync(specificationRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort(compareCodeUnits);
  const owners = new Map<string, string[]>();
  const packageRoot = path.join(ROOT, "packages");
  for (const entry of fs.readdirSync(packageRoot, { withFileTypes: true })) {
    if (entry.isDirectory() === false) continue;
    const configPath = path.join(packageRoot, entry.name, "lint.config.ts");
    if (fs.existsSync(configPath) === false) continue;
    for (const folder of configuredFolders(
      fs.readFileSync(configPath, "utf8"),
    )) {
      const current = owners.get(folder) ?? [];
      current.push(entry.name);
      owners.set(folder, current);
    }
  }

  TestValidator.equals(
    "every specification directory has exactly one package owner",
    specificationFolders
      .map((folder): [string, string[]] => [
        folder,
        (owners.get(folder) ?? []).sort(compareCodeUnits),
      ])
      .filter(([, packages]) => packages.length !== 1),
    [],
  );
  TestValidator.equals(
    "package configs name no absent specification directory",
    [...owners.keys()]
      .filter((folder) => specificationFolders.includes(folder) === false)
      .sort(compareCodeUnits),
    [],
  );

  const controlled = [
    ...markdownFiles(path.join(ROOT, "docs", "requirements")),
    ...markdownFiles(specificationRoot),
  ];
  const invalidHeadings = controlled.flatMap((file) =>
    fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/u)
      .filter((line) => /^#{2,3} /u.test(line))
      .filter(
        (line) => /^#{2,3} .+ \{#[a-z][a-z0-9-]*\}$/u.test(line) === false,
      )
      .map((line) => `${path.relative(ROOT, file)}: ${line}`),
  );
  TestValidator.equals(
    "controlled H2 and H3 headings declare ASCII anchors",
    invalidHeadings,
    [],
  );
};
