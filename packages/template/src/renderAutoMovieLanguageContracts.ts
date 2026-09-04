import {
  AUTO_MOVIE_PRODUCTION_LANGUAGES,
  isAutoMovieProductionLanguage,
  projectAutoMovieMarkdownSyntax,
} from "@automovie/evidence";
import * as fs from "node:fs";
import * as path from "node:path";

import { validateAutoMovieLanguageContractInventory } from "./validateAutoMovieLanguageContractInventory";

type InventoryEntry = Parameters<
  typeof validateAutoMovieLanguageContractInventory
>[0]["entries"][number];

type ReservedTarget = NonNullable<
  Parameters<
    typeof validateAutoMovieLanguageContractInventory
  >[0]["reservedTargets"]
>[number];

const packageDirectory = path.resolve(__dirname, "..");

const strictUtf8 = (file: string): string => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(
      fs.readFileSync(file),
    );
  } catch (error) {
    throw new Error(`${file}: language contract asset must be strict UTF-8.`, {
      cause: error,
    });
  }
};

const languageInventory = (root: string): InventoryEntry[] => {
  const output: InventoryEntry[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort(
        (left, right) =>
          Number(left.name > right.name) - Number(left.name < right.name),
      )) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).split(path.sep).join("/");
      if (entry.isSymbolicLink()) output.push({ kind: "link", path: relative });
      else if (entry.isDirectory()) {
        output.push({ kind: "directory", path: relative });
        visit(absolute);
      } else if (entry.isFile())
        output.push({
          content: strictUtf8(absolute),
          kind: "file",
          path: relative,
        });
      else output.push({ kind: "other", path: relative });
    }
  };
  visit(root);
  return output;
};

const sharedTargetIdentities = (): ReservedTarget[] => {
  const docs = path.join(packageDirectory, "scaffold", "docs");
  const output: ReservedTarget[] = [];
  const visit = (directory: string): void => {
    if (!fs.lstatSync(directory, { throwIfNoEntry: false })?.isDirectory())
      throw new Error(
        `${directory}: scaffold contract asset root must be a physical directory.`,
      );
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort(
        (left, right) =>
          Number(left.name > right.name) - Number(left.name < right.name),
      )) {
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink())
        throw new Error(
          `${absolute}: scaffold contract assets may not be linked.`,
        );
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile() && entry.name.endsWith(".md")) {
        const relative = path
          .relative(docs, absolute)
          .split(path.sep)
          .join("/");
        for (const line of projectAutoMovieMarkdownSyntax({
          path: relative,
          source: strictUtf8(absolute),
        }).visibleLines) {
          const heading =
            /^##(?!#)\s+(\S.*?)[ \t]+\{#([^{}\s]+)\}[ \t]*$/u.exec(line);
          if (heading !== null)
            output.push({
              anchor: heading[2]!,
              owner: `${relative}#${heading[2]!}`,
              title: heading[1]!,
            });
        }
      }
    }
  };
  for (const family of ["discovery", "obligations", "principles", "upstream"])
    visit(path.join(docs, family));
  return output;
};

/**
 * Render exactly one bundled language contract into project-local paths.
 *
 * The private package inventory is never copied wholesale. Selecting one
 * language yields only `docs/language/**`, so a generated project cannot
 * silently retain rules for another language.
 *
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-topic-document-discovery Publishes only the selected language's discoverable contracts.
 * @evidence requirements/agent-authoring/production-language.md#agent-production-language-contract Publishes exactly one selected language module and refuses residue.
 * @evidence requirements/agent-authoring/project-ownership.md#agent-portable-authoring Materializes the chosen language rules as ordinary project-local documents.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Derives one complete language module from explicit selection.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Makes the language identity part of deterministic scaffold derivation.
 * @evidence specifications/authoring-and-authority/production-language.md#spec-authoring-production-language-module Enforces the module's exact physical file identity.
 * @author Samchon
 */
export const renderAutoMovieLanguageContracts = (props: {
  language: string;
}): Record<string, string> => {
  if (!isAutoMovieProductionLanguage(props.language))
    throw new Error(
      `${props.language || "(missing)"}: expected one bundled production language (${AUTO_MOVIE_PRODUCTION_LANGUAGES.join(", ")}).`,
    );
  const root = path.join(packageDirectory, "language-contracts");
  if (!fs.lstatSync(root, { throwIfNoEntry: false })?.isDirectory())
    throw new Error(`language contract assets are missing: ${root}`);
  const selected = path.join(root, props.language);
  if (!fs.lstatSync(selected, { throwIfNoEntry: false })?.isDirectory())
    throw new Error(
      `${props.language}: bundled language contract directory is missing: ${selected}`,
    );
  return validateAutoMovieLanguageContractInventory({
    entries: languageInventory(selected),
    language: props.language,
    reservedTargets: sharedTargetIdentities(),
  });
};
