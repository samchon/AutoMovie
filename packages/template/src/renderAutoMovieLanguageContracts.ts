import {
  AUTO_MOVIE_PRODUCTION_LANGUAGES,
  isAutoMovieProductionLanguage,
} from "@automovie/evidence";
import * as fs from "node:fs";
import * as path from "node:path";

const LANGUAGE_CONTRACT_FILES = [
  "discovery/signals.md",
  "obligations/common.md",
  "principles/common.md",
] as const;

/**
 * Absolute directory containing the package-private language packs.
 *
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-topic-document-discovery Locates the installed language-specific authoring guidance.
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-production-language-contract Locates only the package-private supported module source.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Exposes the reusable language-pack source without making it production content.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-production-language-module Provides the physical source for exact selected-module materialization.
 * @author Samchon
 */
export const autoMovieLanguageContractsDirectory = (
  moduleDirectory: string = __dirname,
): string => {
  const directory = path.resolve(moduleDirectory, "..", "language-contracts");
  if (!fs.lstatSync(directory, { throwIfNoEntry: false })?.isDirectory())
    throw new Error(`language contract assets are missing: ${directory}`);
  return directory;
};

/**
 * Render exactly one bundled language contract into project-local paths.
 *
 * The private package inventory is never copied wholesale. Selecting one
 * language yields only `docs/language/**`, so a generated project cannot
 * silently retain rules for another language.
 *
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-topic-document-discovery Publishes only the selected language's discoverable contracts.
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-production-language-contract Publishes exactly one selected language module and refuses residue.
 * @evidence requirements/agent-authoring/project-ownership.md#agent-portable-authoring Materializes the chosen language rules as ordinary project-local documents.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Derives one complete language module from explicit selection.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Makes the language identity part of deterministic scaffold derivation.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-production-language-module Enforces the module's exact physical file identity.
 * @author Samchon
 */
export const renderAutoMovieLanguageContracts = (props: {
  language: string;
  contractsRoot?: string;
}): Record<string, string> => {
  if (!isAutoMovieProductionLanguage(props.language))
    throw new Error(
      `${props.language || "(missing)"}: expected one bundled production language (${AUTO_MOVIE_PRODUCTION_LANGUAGES.join(", ")}).`,
    );
  const root = path.resolve(
    props.contractsRoot ?? autoMovieLanguageContractsDirectory(),
  );
  const selected = path.join(root, props.language);
  if (!fs.lstatSync(selected, { throwIfNoEntry: false })?.isDirectory())
    throw new Error(
      `${props.language}: bundled language contract directory is missing: ${selected}`,
    );
  const files: Record<string, string> = {};
  const walk = (directory: string): void => {
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort(
        (left, right) =>
          Number(left.name > right.name) - Number(left.name < right.name),
      )) {
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink())
        throw new Error(
          `${absolute}: language contract assets may not be linked.`,
        );
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile()) {
        const relative = path
          .relative(selected, absolute)
          .split(path.sep)
          .join("/");
        files[`docs/language/${relative}`] = fs
          .readFileSync(absolute, "utf8")
          .replaceAll("\r\n", "\n");
      }
    }
  };
  walk(selected);
  const actual = Object.keys(files).map((file) =>
    file.slice("docs/language/".length),
  );
  if (
    actual.length !== LANGUAGE_CONTRACT_FILES.length ||
    actual.some((file, index) => file !== LANGUAGE_CONTRACT_FILES[index])
  )
    throw new Error(
      `${props.language}: bundled language contract must contain exactly ${LANGUAGE_CONTRACT_FILES.join(", ")}; received ${actual.join(", ") || "(empty)"}.`,
    );
  return files;
};
