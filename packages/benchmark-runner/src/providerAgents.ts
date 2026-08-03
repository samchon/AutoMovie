import fs from "node:fs";
import path from "node:path";

import {
  AutoMovieBenchmarkAgent,
  IAutoMovieBenchmarkAgentContext,
  IAutoMovieBenchmarkProcessAgentInput,
  createProcessAutoMovieBenchmarkAgent,
} from "./runAutoMovieBenchmark";

/** MCP process configuration shared by concrete coding-agent adapters. */
export interface IAutoMovieBenchmarkAgentMcpInput {
  /** MCP server executable. */
  command: string;
  /** Fixed MCP server arguments. */
  args?: readonly string[];
  /** Additional non-secret MCP server environment. */
  env?: Readonly<Record<string, string>>;
}

/** Host launcher seam used to test provider wiring without invoking a model. */
export type AutoMovieBenchmarkProcessAgentFactory = (
  input: IAutoMovieBenchmarkProcessAgentInput,
) => AutoMovieBenchmarkAgent;

/** Configuration for the directly runnable Codex CLI adapter. */
export interface IAutoMovieBenchmarkCodexAgentInput {
  /** Codex executable; use `codex.cmd` on PowerShell-restricted Windows hosts. */
  command?: string;
  /** Model override, or the authenticated CLI default when omitted. */
  model?: string;
  /** MCP server the candidate must drive. */
  mcp: IAutoMovieBenchmarkAgentMcpInput;
  /** Hard process fence in milliseconds. */
  timeoutMs: number;
  /** Extra non-secret environment variables for Codex itself. */
  env?: Readonly<Record<string, string>>;
  /** Explicitly opt into Codex's no-approval/no-sandbox automation flag. */
  dangerouslyBypassSandbox?: boolean;
  /** Optional deterministic launcher override for adapter verification. */
  processAgent?: AutoMovieBenchmarkProcessAgentFactory;
}

/**
 * Run the installed Codex CLI with the exact scenario brief on stdin.
 *
 * The adapter injects only the selected AutoMovie MCP server, disables session
 * persistence, permits an uninitialized benchmark workspace, and emits JSONL so
 * usage telemetry remains machine-readable.
 */
export const createCodexAutoMovieBenchmarkAgent = (
  input: IAutoMovieBenchmarkCodexAgentInput,
): AutoMovieBenchmarkAgent => {
  assertProviderInput(
    input.command ?? "codex",
    input.mcp,
    input.timeoutMs,
    input.env,
  );
  const processAgent =
    input.processAgent ?? createProcessAutoMovieBenchmarkAgent;
  return async (context) => {
    const args = [
      "exec",
      "--ephemeral",
      "--skip-git-repo-check",
      "--json",
      ...(input.dangerouslyBypassSandbox === true
        ? ["--dangerously-bypass-approvals-and-sandbox"]
        : ["--sandbox", "workspace-write"]),
      ...(input.model === undefined ? [] : ["--model", input.model]),
      ...codexMcpOverrides(input.mcp, context),
      "-",
    ];
    return processAgent({
      command: input.command ?? "codex",
      args,
      env: input.env,
      timeoutMs: input.timeoutMs,
      generation: codexGeneration,
    })(context);
  };
};

/** Configuration for the directly runnable Claude Code adapter. */
export interface IAutoMovieBenchmarkClaudeAgentInput {
  /** Claude executable. */
  command?: string;
  /** Model override, or the authenticated CLI default when omitted. */
  model?: string;
  /** Effort override, or the authenticated CLI default when omitted. */
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  /** MCP server the candidate must drive. */
  mcp: IAutoMovieBenchmarkAgentMcpInput;
  /** Hard process fence in milliseconds. */
  timeoutMs: number;
  /** Extra non-secret environment variables for Claude itself. */
  env?: Readonly<Record<string, string>>;
  /** Explicitly opt into Claude Code's bypassPermissions mode. */
  dangerouslyBypassPermissions?: boolean;
  /** Optional deterministic launcher override for adapter verification. */
  processAgent?: AutoMovieBenchmarkProcessAgentFactory;
}

/**
 * Run the installed Claude Code CLI in one-shot JSON mode.
 *
 * A runner-owned config inside the candidate input directory fixes the sole MCP
 * server. The exact registered brief is still delivered on stdin.
 */
export const createClaudeCodeAutoMovieBenchmarkAgent = (
  input: IAutoMovieBenchmarkClaudeAgentInput,
): AutoMovieBenchmarkAgent => {
  assertProviderInput(
    input.command ?? "claude",
    input.mcp,
    input.timeoutMs,
    input.env,
  );
  const processAgent =
    input.processAgent ?? createProcessAutoMovieBenchmarkAgent;
  return async (context) => {
    const configPath = writeClaudeMcpConfig(input.mcp, context);
    const args = [
      "--print",
      "--output-format",
      "json",
      "--no-session-persistence",
      "--strict-mcp-config",
      "--mcp-config",
      configPath,
      "--permission-mode",
      input.dangerouslyBypassPermissions === true
        ? "bypassPermissions"
        : "acceptEdits",
      ...(input.model === undefined ? [] : ["--model", input.model]),
      ...(input.effort === undefined ? [] : ["--effort", input.effort]),
    ];
    return processAgent({
      command: input.command ?? "claude",
      args,
      env: input.env,
      timeoutMs: input.timeoutMs,
      generation: claudeGeneration,
    })(context);
  };
};

const assertProviderInput = (
  command: string,
  mcp: IAutoMovieBenchmarkAgentMcpInput,
  timeoutMs: number,
  env: Readonly<Record<string, string>> | undefined,
): void => {
  if (
    command.trim().length === 0 ||
    mcp.command.trim().length === 0 ||
    Number.isSafeInteger(timeoutMs) === false ||
    timeoutMs <= 0
  )
    throw new Error(
      "Benchmark provider needs non-blank provider/MCP commands and a positive safe-integer timeoutMs.",
    );
  const invalidEnvironmentKey = [
    ...Object.keys(env ?? {}),
    ...Object.keys(mcp.env ?? {}),
  ].find((key) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) === false);
  if (invalidEnvironmentKey !== undefined)
    throw new Error(
      `Benchmark provider environment key "${invalidEnvironmentKey}" is not portable.`,
    );
};

const codexMcpOverrides = (
  mcp: IAutoMovieBenchmarkAgentMcpInput,
  context: IAutoMovieBenchmarkAgentContext,
): string[] => {
  const values: string[] = [
    `mcp_servers.automovie.command=${JSON.stringify(mcp.command)}`,
    `mcp_servers.automovie.args=${JSON.stringify([...(mcp.args ?? [])])}`,
    `mcp_servers.automovie.env.AUTOMOVIE_PROJECT_ROOT=${JSON.stringify(
      context.project,
    )}`,
  ];
  for (const [key, value] of Object.entries(mcp.env ?? {}))
    values.push(`mcp_servers.automovie.env.${key}=${JSON.stringify(value)}`);
  return values.flatMap((value) => ["--config", value]);
};

const writeClaudeMcpConfig = (
  mcp: IAutoMovieBenchmarkAgentMcpInput,
  context: IAutoMovieBenchmarkAgentContext,
): string => {
  const file = path.join(path.dirname(context.taskPath), "claude-mcp.json");
  fs.writeFileSync(
    file,
    `${JSON.stringify(
      {
        mcpServers: {
          automovie: {
            command: mcp.command,
            args: [...(mcp.args ?? [])],
            env: {
              ...mcp.env,
              AUTOMOVIE_PROJECT_ROOT: context.project,
            },
          },
        },
      },
      null,
      2,
    )}\n`,
  );
  return file;
};

const codexGeneration: NonNullable<
  IAutoMovieBenchmarkProcessAgentInput["generation"]
> = (stdout, _stderr, elapsedSeconds) => {
  const events = stdout
    .split(/\r?\n/u)
    .filter((line) => line.trim().length !== 0)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as Record<string, unknown>];
      } catch {
        return [];
      }
    });
  const usage = events
    .map((event) => event.usage)
    .filter(
      (value): value is Record<string, unknown> =>
        value !== null && typeof value === "object",
    )
    .at(-1);
  return {
    toolCalls: events.filter(
      (event) =>
        event.type === "item.completed" &&
        (event.item as { type?: unknown } | undefined)?.type ===
          "command_execution",
    ).length,
    corrections: 0,
    costUsd: 0,
    elapsedSeconds,
    inputTokens: nonNegativeInteger(usage?.input_tokens),
    outputTokens: nonNegativeInteger(usage?.output_tokens),
  };
};

const claudeGeneration: NonNullable<
  IAutoMovieBenchmarkProcessAgentInput["generation"]
> = (stdout, _stderr, elapsedSeconds) => {
  let result: Record<string, unknown> = {};
  try {
    result = JSON.parse(stdout) as Record<string, unknown>;
  } catch {
    // A successful provider process may omit optional accounting fields.
  }
  const usage =
    result.usage !== null && typeof result.usage === "object"
      ? (result.usage as Record<string, unknown>)
      : {};
  return {
    toolCalls: nonNegativeInteger(result.num_turns),
    corrections: 0,
    costUsd: nonNegativeNumber(result.total_cost_usd),
    elapsedSeconds,
    inputTokens: nonNegativeInteger(usage.input_tokens),
    outputTokens: nonNegativeInteger(usage.output_tokens),
  };
};

const nonNegativeInteger = (value: unknown): number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;

const nonNegativeNumber = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
