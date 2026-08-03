import { IAutoMovieBenchmarkMcpSession } from "./submission";
import { AutoMovieBenchmarkSurface, compareBenchmarkCodeUnits } from "./task";

/** One measured tool surface and its aggregate prompt/schema budget. */
export interface IAutoMovieBenchmarkToolInventorySurface {
  /** Surface whose MCP handshake was measured. */
  surface: AutoMovieBenchmarkSurface;
  /** Exact advertised tool count. */
  tools: number;
  /** Sum of UTF-8 tool-description bytes. */
  descriptionBytes: number;
  /** Sum of JSON-schema bytes. */
  schemaBytes: number;
  /** Stable advertised tool names. */
  names: string[];
}

/** One pairwise surface delta, right minus left. */
export interface IAutoMovieBenchmarkToolInventoryComparison {
  /** Baseline surface. */
  from: AutoMovieBenchmarkSurface;
  /** Candidate surface. */
  to: AutoMovieBenchmarkSurface;
  /** Candidate tool-count delta. */
  tools: number;
  /** Candidate description-byte delta. */
  descriptionBytes: number;
  /** Candidate schema-byte delta. */
  schemaBytes: number;
  /** Tools only the candidate advertises. */
  added: string[];
  /** Tools only the baseline advertises. */
  removed: string[];
}

/** Complete measured new/retired surface inventory report. */
export interface IAutoMovieBenchmarkToolInventoryReport {
  /** Per-surface measurements. */
  surfaces: IAutoMovieBenchmarkToolInventorySurface[];
  /** Every stable pairwise comparison. */
  comparisons: IAutoMovieBenchmarkToolInventoryComparison[];
}

const SURFACE_HISTORY: readonly AutoMovieBenchmarkSurface[] = [
  "legacy-granular",
  "legacy-compact",
  "production",
  "five-tool",
];

/** Compare actual MCP handshakes without inventing a static tool count. */
export const reportAutoMovieBenchmarkToolInventory = (
  sessions: readonly {
    surface: AutoMovieBenchmarkSurface;
    mcp: IAutoMovieBenchmarkMcpSession;
  }[],
): IAutoMovieBenchmarkToolInventoryReport => {
  if (sessions.length === 0)
    throw new Error(
      "Tool inventory requires at least one measured MCP handshake.",
    );
  const duplicate = sessions.find(
    (entry, index) =>
      sessions.findIndex((candidate) => candidate.surface === entry.surface) !==
      index,
  );
  if (duplicate !== undefined)
    throw new Error(
      `Tool inventory repeats surface "${duplicate.surface}". Supply one measured handshake per surface.`,
    );
  for (const { surface, mcp } of sessions) {
    const invalidName = mcp.tools.find(
      (tool) => tool.name.trim().length === 0 || tool.name.trim() !== tool.name,
    );
    if (invalidName !== undefined)
      throw new Error(
        `Tool inventory surface "${surface}" contains a blank or untrimmed tool name.`,
      );
    const invalidBudget = mcp.tools.find((tool) =>
      [tool.descriptionBytes, tool.schemaBytes].some(
        (value) => Number.isSafeInteger(value) === false || value < 0,
      ),
    );
    if (invalidBudget !== undefined)
      throw new Error(
        `Tool inventory surface "${surface}" tool "${invalidBudget.name}" has a negative or non-integer byte budget.`,
      );
    const names = mcp.tools.map((tool) => tool.name);
    if (new Set(names).size !== names.length)
      throw new Error(
        `Tool inventory surface "${surface}" repeats an advertised tool name.`,
      );
  }
  const surfaces = sessions
    .map(({ surface, mcp }) => ({
      surface,
      tools: mcp.tools.length,
      descriptionBytes: mcp.tools.reduce(
        (sum, tool) => sum + tool.descriptionBytes,
        0,
      ),
      schemaBytes: mcp.tools.reduce((sum, tool) => sum + tool.schemaBytes, 0),
      names: mcp.tools.map((tool) => tool.name).sort(compareBenchmarkCodeUnits),
    }))
    .sort(
      (left, right) =>
        SURFACE_HISTORY.indexOf(left.surface) -
        SURFACE_HISTORY.indexOf(right.surface),
    );
  const comparisons = surfaces.flatMap((from, leftIndex) =>
    surfaces.slice(leftIndex + 1).map((to) => ({
      from: from.surface,
      to: to.surface,
      tools: to.tools - from.tools,
      descriptionBytes: to.descriptionBytes - from.descriptionBytes,
      schemaBytes: to.schemaBytes - from.schemaBytes,
      added: to.names.filter((name) => from.names.includes(name) === false),
      removed: from.names.filter((name) => to.names.includes(name) === false),
    })),
  );
  return { surfaces, comparisons };
};
