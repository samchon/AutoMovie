import {
  AutoMovieBenchmarkSurface,
  IAutoMovieBenchmarkMcpSession,
  IAutoMovieBenchmarkScenario,
} from "@automovie/benchmark";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

/** Runner-owned workspace handed to one MCP inventory probe. */
export interface IAutoMovieBenchmarkMcpProbeContext {
  /** Registered scenario selected for the run. */
  scenario: IAutoMovieBenchmarkScenario;
  /** Candidate workspace the probed server must open. */
  project: string;
}

/** Actual initialize/tools-list measurement supplied by a trusted probe. */
export type AutoMovieBenchmarkMcpProbe = (
  context: IAutoMovieBenchmarkMcpProbeContext,
) => Promise<IAutoMovieBenchmarkMcpSession>;

/** One current or retired surface the runner measures itself. */
export interface IAutoMovieBenchmarkMcpTarget {
  /** Surface represented by the server process. */
  surface: AutoMovieBenchmarkSurface;
  /** Stable non-secret identity for the executable/configuration under test. */
  provenance: string;
  /** Trusted probe that performs initialize and tools/list. */
  probe: AutoMovieBenchmarkMcpProbe;
}

/** Configuration for a real stdio MCP inventory target. */
export interface IAutoMovieBenchmarkProcessMcpTargetInput {
  /** Surface represented by the process. */
  surface: AutoMovieBenchmarkSurface;
  /** Stable non-secret package or artifact identity. */
  provenance: string;
  /** Executable resolved by the host environment. */
  command: string;
  /** Fixed arguments placed after the executable. */
  args?: readonly string[];
  /** Additional non-secret environment variables. */
  env?: Readonly<Record<string, string>>;
  /** Ordinary MCP request timeout in milliseconds. */
  timeoutMs: number;
  /** Initialize timeout including process startup. Defaults to `timeoutMs`. */
  startupTimeoutMs?: number;
}

/**
 * Measure a real stdio MCP server instead of accepting candidate inventory.
 *
 * The SDK performs the initialize handshake and tools/list request. The runner
 * records the negotiated protocol, server implementation, advertised order, and
 * exact UTF-8 byte budgets of the parsed descriptions and schemas.
 */
export const createProcessAutoMovieBenchmarkMcpTarget = (
  input: IAutoMovieBenchmarkProcessMcpTargetInput,
): IAutoMovieBenchmarkMcpTarget => {
  const startupTimeoutMs = input.startupTimeoutMs ?? input.timeoutMs;
  if (
    input.command.trim().length === 0 ||
    input.provenance.trim().length === 0 ||
    Number.isSafeInteger(input.timeoutMs) === false ||
    input.timeoutMs <= 0 ||
    Number.isSafeInteger(startupTimeoutMs) === false ||
    startupTimeoutMs <= 0
  )
    throw new Error(
      "Benchmark MCP target needs non-blank command/provenance, a positive safe-integer timeoutMs and, when supplied, startupTimeoutMs.",
    );
  return {
    surface: input.surface,
    provenance: input.provenance,
    probe: async (context) => {
      const inner = new StdioClientTransport({
        command: input.command,
        args: [...(input.args ?? [])],
        cwd: context.project,
        env: {
          ...getDefaultEnvironment(),
          ...input.env,
          AUTOMOVIE_PROJECT_ROOT: context.project,
        },
        stderr: "pipe",
      });
      const transport = new ProtocolObservingTransport(inner);
      const client = new Client({
        name: "automovie-benchmark-runner",
        version: "0.1.0",
      });
      let stderr = "";
      inner.stderr?.on("data", (chunk: Buffer | string) => {
        stderr += chunk.toString();
      });
      let probeResult:
        | { success: true; value: IAutoMovieBenchmarkMcpSession }
        | { error: unknown; success: false };
      try {
        await client.connect(transport, { timeout: startupTimeoutMs });
        const server = client.getServerVersion();
        const listed = await client.listTools(undefined, {
          timeout: input.timeoutMs,
        });
        if (server === undefined || transport.protocolVersion === null)
          throw new Error(
            "MCP initialize completed without protocol or server identity.",
          );
        probeResult = {
          success: true,
          value: {
            protocolVersion: transport.protocolVersion,
            serverName: server.name,
            serverVersion: server.version,
            tools: listed.tools.map((tool) => ({
              name: tool.name,
              descriptionBytes: Buffer.byteLength(
                tool.description ?? "",
                "utf8",
              ),
              schemaBytes: Buffer.byteLength(
                JSON.stringify(tool.inputSchema),
                "utf8",
              ),
            })),
          },
        };
      } catch (error) {
        const detail = stderr.trim();
        probeResult = {
          error: new Error(
            `MCP probe "${input.provenance}" failed: ${messageOf(error)}${
              detail.length === 0 ? "" : `; stderr: ${detail}`
            }`,
          ),
          success: false,
        };
      }
      let cleanupFailure: { error: unknown } | undefined;
      try {
        await client.close();
      } catch (error) {
        cleanupFailure = { error };
      }
      if (probeResult.success === false) {
        if (cleanupFailure !== undefined)
          throw new AggregateError(
            [probeResult.error, cleanupFailure.error],
            `MCP probe "${input.provenance}" cleanup failed after the probe failed.`,
          );
        throw probeResult.error;
      }
      if (cleanupFailure !== undefined) throw cleanupFailure.error;
      return probeResult.value;
    },
  };
};

/** Capture the protocol version the SDK otherwise keeps private. */
class ProtocolObservingTransport implements Transport {
  public onclose?: Transport["onclose"];
  public onerror?: Transport["onerror"];
  public onmessage?: Transport["onmessage"];
  public protocolVersion: string | null = null;

  public constructor(private readonly inner: StdioClientTransport) {}

  public async start(): Promise<void> {
    this.inner.onclose = () => this.onclose?.();
    this.inner.onerror = (error) => this.onerror?.(error);
    this.inner.onmessage = (message) => this.onmessage?.(message);
    await this.inner.start();
  }

  public send(
    message: Parameters<Transport["send"]>[0],
    _options?: Parameters<Transport["send"]>[1],
  ): Promise<void> {
    return this.inner.send(message);
  }

  public close(): Promise<void> {
    return this.inner.close();
  }

  public setProtocolVersion(version: string): void {
    this.protocolVersion = version;
  }
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
