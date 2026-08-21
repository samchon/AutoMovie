import fs from "node:fs";
import path from "node:path";

import type { AutoMovieEvidenceStage } from "../AutoMovieEvidenceStage";
import type { IAutoMovieEvidenceConfigProps } from "../IAutoMovieEvidenceConfigProps";

interface IHostPopulation {
  extension: ".md" | ".ts";
  headings?: (2 | 3 | 4)[];
  name: string;
  owner?: "class" | "function-or-property";
  roots: string[];
  stage: AutoMovieEvidenceStage;
}

interface IMarkdownIdentity {
  anchor: string;
  depth: 2 | 3 | 4;
  lineage: string;
}

/** Lists governed files below one path without treating placeholders as hosts. */
const governedFiles = (root: string, extension: ".md" | ".ts"): string[] => {
  if (!fs.existsSync(root)) return [];
  if (fs.statSync(root).isFile()) return [root];
  const output: string[] = [];
  const visit = (current: string): void => {
    for (const entry of fs
      .readdirSync(current, { withFileTypes: true })
      // Code-unit order keeps topology validation independent of host locale.
      .sort((x, y) => Number(x.name > y.name) - Number(x.name < y.name))) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile() && entry.name.endsWith(extension))
        output.push(absolute);
    }
  };
  visit(root);
  return output;
};

/** Removes comments and literal bodies before looking for exported owners. */
const executableTypeScript = (source: string): string => {
  let mode: "block" | "code" | "double" | "line" | "single" | "template" =
    "code";
  let escaped = false;
  let output = "";
  for (let index = 0; index < source.length; index++) {
    const character = source[index]!;
    const next = source[index + 1];
    if (mode === "code") {
      if (character === "/" && next === "/") {
        mode = "line";
        output += "  ";
        index++;
      } else if (character === "/" && next === "*") {
        mode = "block";
        output += "  ";
        index++;
      } else if (character === '"') {
        mode = "double";
        output += " ";
      } else if (character === "'") {
        mode = "single";
        output += " ";
      } else if (character === "`") {
        mode = "template";
        output += " ";
      } else output += character;
      continue;
    }
    if (character === "\n") {
      output += "\n";
      if (mode === "line") mode = "code";
      escaped = false;
      continue;
    }
    output += " ";
    if (mode === "line") continue;
    if (mode === "block") {
      if (character === "*" && next === "/") {
        output += " ";
        index++;
        mode = "code";
      }
      continue;
    }
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (
      (mode === "double" && character === '"') ||
      (mode === "single" && character === "'") ||
      (mode === "template" && character === "`")
    )
      mode = "code";
  }
  return output;
};

/** Whether a TypeScript file declares one named exported owner symbol. */
const hasExportedOwner = (
  file: string,
  owner: NonNullable<IHostPopulation["owner"]>,
): boolean => {
  const source = executableTypeScript(fs.readFileSync(file, "utf8"));
  return owner === "class"
    ? /^\s*export\s+(?:default\s+)?(?:abstract\s+)?class\s+[$A-Z_a-z][$\w]*\b/mu.test(
        source,
      )
    : /^\s*export\s+(?:(?:default\s+)?(?:async\s+)?function\s+[$A-Z_a-z][$\w]*\b|(?:const|let|var)\s+[$A-Z_a-z][$\w]*\b)/mu.test(
        source,
      );
};

/** Reads stable heading identities and refuses missing anchors or parents. */
const markdownIdentities = (
  file: string,
  headings: (2 | 3 | 4)[],
): IMarkdownIdentity[] => {
  const required = new Set(headings);
  const seen = new Set<number>();
  const anchors = new Set<string>();
  const output: IMarkdownIdentity[] = [];
  let fence: { character: "`" | "~"; length: number } | undefined;
  let htmlComment = false;
  let h2: string | undefined;
  let h3: string | undefined;
  for (const [index, sourceLine] of fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/u)
    .entries()) {
    if (fence !== undefined) {
      if (
        new RegExp(
          `^ {0,3}${fence.character}{${fence.length},}[ \\t]*$`,
          "u",
        ).test(sourceLine)
      )
        fence = undefined;
      continue;
    }
    let line = "";
    for (let cursor = 0; cursor < sourceLine.length; ) {
      if (htmlComment) {
        const close = sourceLine.indexOf("-->", cursor);
        if (close === -1) {
          line += " ".repeat(sourceLine.length - cursor);
          break;
        }
        line += " ".repeat(close + 3 - cursor);
        cursor = close + 3;
        htmlComment = false;
      } else {
        const open = sourceLine.indexOf("<!--", cursor);
        if (open === -1) {
          line += sourceLine.slice(cursor);
          break;
        }
        line += sourceLine.slice(cursor, open) + "    ";
        cursor = open + 4;
        htmlComment = true;
      }
    }
    const fenceMarker = /^ {0,3}(`{3,}|~{3,})/u.exec(line)?.[1];
    if (fenceMarker !== undefined) {
      fence = {
        character: fenceMarker[0] as "`" | "~",
        length: fenceMarker.length,
      };
      continue;
    }
    const heading = /^(#{2,4})(?!#)\s+\S.*$/u.exec(line);
    if (heading === null) continue;
    const depth = heading[1]!.length as 2 | 3 | 4;
    if (!required.has(depth)) continue;
    seen.add(depth);
    const anchored = /[ \t]+\{#([^{}\s]+)\}[ \t]*$/u.exec(line);
    if (anchored === null)
      throw new Error(
        `${file.replaceAll("\\", "/")}:${index + 1} has an active H${depth} unit without an explicit {#anchor}.`,
      );
    const anchor = anchored[1]!;
    if (anchors.has(anchor))
      throw new Error(
        `${file.replaceAll("\\", "/")}:${index + 1} repeats explicit heading anchor #${anchor}; anchors are unique within a Markdown file.`,
      );
    anchors.add(anchor);
    if (depth === 2) {
      h2 = anchor;
      h3 = undefined;
    } else if (depth === 3) {
      if (h2 === undefined)
        throw new Error(
          `${file.replaceAll("\\", "/")}:${index + 1} has an H3 unit before any H2 parent.`,
        );
      h3 = anchor;
    } else if (h2 === undefined || h3 === undefined)
      throw new Error(
        `${file.replaceAll("\\", "/")}:${index + 1} has an H4 unit before its H2/H3 parents.`,
      );
    output.push({
      anchor,
      depth,
      lineage: [
        h2,
        depth >= 3 ? h3 : undefined,
        depth === 4 ? anchor : undefined,
      ]
        .filter((value): value is string => value !== undefined)
        .join("/"),
    });
  }
  for (const depth of headings)
    if (!seen.has(depth))
      throw new Error(
        `${file.replaceAll("\\", "/")} belongs to an active layer but has no H${depth} unit.`,
      );
  return output;
};

/** Refuses a cross-wired or reordered narrative identity ladder. */
const requireMatchingIdentities = (
  childName: "scenarios" | "script",
  child: IMarkdownIdentity[],
  parentName: "scenarios" | "storylines",
  parent: IMarkdownIdentity[],
): void => {
  const signature = (items: IMarkdownIdentity[]): string[] =>
    items.map((item) => `H${item.depth}:${item.lineage}`);
  const childSignature = signature(child);
  const parentSignature = signature(parent);
  if (
    childSignature.length !== parentSignature.length ||
    childSignature.some(
      (identity, index) => identity !== parentSignature[index],
    )
  )
    throw new Error(
      `${childName} heading identities must exactly preserve ${parentName} identity and order; received [${childSignature.join(", ")}], expected [${parentSignature.join(", ")}].`,
    );
};

/** Refuses duplicate explicit anchors inside one identity-bearing layer. */
const requireUniqueIdentities = (
  name: "briefs" | "scenarios" | "script" | "storylines",
  items: IMarkdownIdentity[],
): void => {
  const seen = new Set<string>();
  for (const item of items) {
    const identity = item.anchor;
    if (seen.has(identity))
      throw new Error(
        `${name} declares duplicate heading identity #${identity}; every explicit anchor is unique within its layer regardless of heading depth.`,
      );
    seen.add(identity);
  }
};

/**
 * Refuses declared stages whose physical authored topology says otherwise.
 *
 * A disabled claim must not make resident film prose disappear from a brief,
 * and an active stage with no host must not pass merely because a glob matched
 * nothing. Placeholder files and empty directories remain harmless.
 */
export function validateEvidenceHosts(
  props: IAutoMovieEvidenceConfigProps,
): void {
  const population = (
    name: string,
    stage: AutoMovieEvidenceStage,
    roots: string[],
    extension: ".md" | ".ts",
    structure: Pick<IHostPopulation, "headings" | "owner">,
  ): IHostPopulation => ({ name, stage, roots, extension, ...structure });
  const populations: IHostPopulation[] = [
    population("settings", props.settings, ["docs/settings"], ".md", {
      headings: [2],
    }),
    population("research", props.research, ["docs/research"], ".md", {
      headings: [2],
    }),
    population("models", props.models, ["docs/models"], ".md", {
      headings: [2],
    }),
    population("motions", props.motions, ["docs/motions"], ".md", {
      headings: [2],
    }),
    population("storylines", props.storylines, ["docs/storylines"], ".md", {
      headings: [2, 3, 4],
    }),
    population("scenarios", props.scenarios, ["docs/scenarios"], ".md", {
      headings: [2, 3, 4],
    }),
    population("script", props.script, ["docs/script"], ".md", {
      headings: [2, 3, 4],
    }),
    population("briefs", props.briefs, ["docs/briefs"], ".md", {
      headings: [2, 3, 4],
    }),
    population(
      "modelSources",
      props.modelSources,
      ["src/units", "src/objects", "src/world", "src/formations"],
      ".ts",
      { owner: "class" },
    ),
    population("motionSources", props.motionSources, ["src/motions"], ".ts", {
      owner: "function-or-property",
    }),
    population("shots", props.shots, ["src/shots"], ".ts", {
      owner: "function-or-property",
    }),
    population(
      "productionSources",
      props.productionSources,
      ["src/production.ts"],
      ".ts",
      { owner: "function-or-property" },
    ),
    population("filmSources", props.filmSources, ["src/film.ts"], ".ts", {
      owner: "function-or-property",
    }),
  ];
  if (fs.existsSync(path.join(props.location, "config/docs")))
    populations.push(
      population(
        "reusable contracts",
        "evidence",
        ["config/docs/principles", "config/docs/obligations"],
        ".md",
        { headings: [2] },
      ),
    );
  const identities = new Map<string, IMarkdownIdentity[]>();

  for (const item of populations) {
    const files = item.roots.flatMap((root) =>
      governedFiles(path.join(props.location, root), item.extension),
    );
    if (item.stage === "disabled" && files.length !== 0)
      throw new Error(
        `${item.name} is disabled but governed host files remain: ${files
          .map((file) =>
            path.relative(props.location, file).replaceAll("\\", "/"),
          )
          .join(", ")}. Remove those hosts or activate the layer.`,
      );
    if (item.stage !== "disabled" && files.length === 0)
      throw new Error(
        `${item.name} cannot enter ${item.stage} without a governed ${item.extension} host.`,
      );
    if (item.stage !== "disabled" && item.headings !== undefined)
      identities.set(
        item.name,
        files.flatMap((file) => markdownIdentities(file, item.headings!)),
      );
    if (item.stage !== "disabled" && item.owner !== undefined) {
      const owner = item.owner;
      for (const file of files)
        if (hasExportedOwner(file, owner) === false)
          throw new Error(
            `${path.relative(props.location, file).replaceAll("\\", "/")} belongs to active ${item.name} but has no named exported ${
              owner === "class" ? "class" : "function or property"
            } owner.`,
          );
    }
  }
  for (const name of ["storylines", "scenarios", "script", "briefs"] as const) {
    const layer = identities.get(name);
    if (layer !== undefined) requireUniqueIdentities(name, layer);
  }
  if (props.scenarios !== "disabled")
    requireMatchingIdentities(
      "scenarios",
      identities.get("scenarios")!,
      "storylines",
      identities.get("storylines")!,
    );
  if (props.script !== "disabled") {
    requireMatchingIdentities(
      "script",
      identities.get("script")!,
      "scenarios",
      identities.get("scenarios")!,
    );
    requireMatchingIdentities(
      "script",
      identities.get("script")!,
      "storylines",
      identities.get("storylines")!,
    );
  }
}
