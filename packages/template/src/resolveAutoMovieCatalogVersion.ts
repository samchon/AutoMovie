import {
  type Document,
  type Node,
  type YAMLMap,
  isAlias,
  isMap,
  isScalar,
  parseDocument,
} from "yaml";

/**
 * Explicit inputs for one pnpm workspace catalog lookup.
 *
 * @evidence requirements/agent-authoring/project-ownership.md#agent-portable-authoring Carries the exact workspace, catalog, and dependency identities that determine a generated project's pinned dependency input.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Defines the complete declared source boundary for catalog derivation.
 * @author Samchon
 */
export interface IAutoMovieCatalogVersionProps {
  /**
   * Direct child mapping selected below the top-level `catalogs` mapping.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-portable-authoring Names the catalog that owns the portable dependency input.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Selects one explicit catalog source rather than searching unrelated mappings.
   */
  catalog: string;
  /**
   * Direct child selected from the requested catalog.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-portable-authoring Names the exact dependency whose version is baked into the generated project.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Keeps the dependency key explicit at the derivation boundary.
   */
  dependency: string;
  /**
   * Complete workspace YAML source.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-portable-authoring Makes the portable workspace declaration the sole version source.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Supplies the complete syntax needed to interpret mappings, scalars, anchors, aliases, comments, and duplicates.
   */
  workspace: string;
}

/**
 * The pnpm workspace catalog lookup whose mapping ownership is resolved before
 * a dependency specifier is accepted.
 *
 * @evidence requirements/agent-authoring/project-ownership.md#agent-portable-authoring Resolves the generated project's pinned dependency input from the declared workspace catalog rather than a similarly named mapping.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Interprets the workspace YAML document and accepts only the requested direct string scalar as derivation input.
 * @author Samchon
 */
export const resolveAutoMovieCatalogVersion = (
  props: IAutoMovieCatalogVersionProps,
): string => {
  const context = `catalog "${props.catalog}" dependency "${props.dependency}"`;
  const document = parseDocument(props.workspace, {
    prettyErrors: false,
    strict: true,
    uniqueKeys: true,
  });
  const diagnostic = document.errors[0] ?? document.warnings[0];
  if (diagnostic !== undefined)
    throw new Error(`${context} has invalid YAML: ${diagnostic.message}`);
  const root = requireMapping(document.contents, context, "document");
  const catalogs = requireDirect(
    root,
    "catalogs",
    context,
    "top-level mapping",
  );
  const catalogsMap = requireMapping(catalogs, context, "catalogs");
  const catalog = requireDirect(
    catalogsMap,
    props.catalog,
    context,
    "catalogs",
  );
  const catalogMap = requireMapping(
    catalog,
    context,
    `catalog "${props.catalog}"`,
  );
  const dependency = requireDirect(
    catalogMap,
    props.dependency,
    context,
    `catalog "${props.catalog}"`,
  );
  const resolved = resolveNode(dependency, document, context);
  if (isScalar(resolved) === false || typeof resolved.value !== "string")
    throw new Error(`${context} must be a string scalar`);
  if (resolved.value.trim().length === 0)
    throw new Error(`${context} must be a non-empty string scalar`);
  return resolved.value;
};

const requireMapping = (
  node: Node | null,
  context: string,
  owner: string,
): YAMLMap => {
  if (isMap(node) === false)
    throw new Error(`${context} requires ${owner} to be a mapping`);
  return node;
};

const requireDirect = (
  mapping: YAMLMap,
  key: string,
  context: string,
  owner: string,
): Node | null => {
  const pair = mapping.items.find(
    (item) => isScalar(item.key) && item.key.value === key,
  );
  if (pair === undefined)
    throw new Error(`${context} is missing "${key}" under ${owner}`);
  return (pair.value as Node | null) ?? null;
};

const resolveNode = (
  node: Node | null,
  document: Document,
  context: string,
): Node | null => {
  if (isAlias(node) === false) return node;
  const resolved = node.resolve(document);
  if (resolved === undefined)
    throw new Error(`${context} contains an unresolved YAML alias`);
  return resolved;
};
