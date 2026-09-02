/** Map every YAML anchor (`&name ^1.2.3`) to its version, for alias resolution. */
const anchorMap = (workspace: string): Record<string, string> => {
  const map: Record<string, string> = {};
  for (const line of workspace.split(/\r?\n/)) {
    const match = line.match(/&(\w+)\s+"?([~^]?[\w.-]+)"?/);
    if (match) map[match[1]] = match[2];
  }
  return map;
};

/**
 * Resolve one catalog entry out of a workspace manifest given as text.
 *
 * Split from the read so the rule this repository owns -- indentation scoping,
 * anchor stripping, alias resolution, and the three refusals -- can be driven
 * over a manifest written for the case, rather than only over the one manifest
 * this repository happens to hold today. Asserting against that manifest would
 * pin its current versions and say nothing about the parser: bumping a
 * dependency would break the test, and breaking the parser would not.
 */
export const readCatalogVersion = (props: {
  catalog: string;
  dep: string;
  workspace: string;
}): string => {
  const { catalog, dep, workspace } = props;
  const anchors = anchorMap(workspace);
  const lines = workspace.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `${catalog}:`);
  if (start === -1) throw new Error(`catalog "${catalog}" not found`);
  const baseIndent = lines[start].length - lines[start].trimStart().length;
  for (let i = start + 1; i < lines.length; ++i) {
    const line = lines[i];
    if (line.trim().length === 0) continue;
    const indent = line.length - line.trimStart().length;
    if (indent <= baseIndent) break;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim().replace(/^"|"$/g, "");
    if (key !== dep) continue;
    // The value may be `^22.19.17`, an anchored `&name ^13.0.2`, an alias
    // `*name`, or a quoted form; strip a leading anchor token, resolve an
    // alias against the anchor map, and drop surrounding quotes.
    const raw = line
      .slice(colon + 1)
      .trim()
      .replace(/^&\S+\s*/, "")
      .replace(/^"|"$/g, "");
    const alias = raw.match(/^\*(\w+)$/);
    if (alias) {
      const resolved = anchors[alias[1]];
      if (resolved === undefined)
        throw new Error(`unresolved YAML alias: ${raw}`);
      return resolved;
    }
    return raw;
  }
  throw new Error(`dependency "${dep}" not found in catalog "${catalog}"`);
};
