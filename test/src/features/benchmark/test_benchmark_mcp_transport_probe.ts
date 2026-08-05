import { probeAutoMovieBenchmarkMcpTransport } from "@automovie/benchmark-runner";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { TestValidator } from "@nestia/e2e";

/**
 * One measured MCP handshake, driven over a linked in-memory pair.
 *
 * The runner's process target adds a spawned server and its stderr and nothing
 * else, and launching a server over stdio is the SDK's verified surface rather
 * than this suite's, so the measurement itself is exercised here in-process.
 */
const measuredServer = (): Server => {
  const server = new Server(
    { name: "benchmark-probe-fixture", version: "9.9.9" },
    { capabilities: { tools: {} } },
  );
  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: [
      {
        name: "first",
        description: "가",
        inputSchema: { type: "object" as const },
      },
      {
        name: "second",
        description: "",
        inputSchema: {
          type: "object" as const,
          properties: { id: { type: "string" as const } },
        },
      },
    ],
  }));
  return server;
};

/** A transport that fails at the boundary one scenario needs it to fail. */
class FailingTransport implements Transport {
  public onclose?: Transport["onclose"];
  public onerror?: Transport["onerror"];
  public onmessage?: Transport["onmessage"];

  public constructor(
    private readonly props: {
      closeFailure?: Error;
      inner?: Transport;
      startFailure?: Error;
    },
  ) {}

  public async start(): Promise<void> {
    if (this.props.startFailure !== undefined) throw this.props.startFailure;
    const inner = this.props.inner;
    if (inner === undefined) return;
    inner.onclose = () => this.onclose?.();
    inner.onerror = (error) => this.onerror?.(error);
    inner.onmessage = (message) => this.onmessage?.(message);
    await inner.start();
  }

  public async send(
    message: Parameters<Transport["send"]>[0],
    options?: Parameters<Transport["send"]>[1],
  ): Promise<void> {
    await this.props.inner?.send(message, options);
  }

  public async close(): Promise<void> {
    if (this.props.closeFailure !== undefined) throw this.props.closeFailure;
    await this.props.inner?.close();
  }

  public setProtocolVersion(_version: string): void {}
}

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const rejection = async (closure: () => Promise<unknown>): Promise<unknown> => {
  try {
    await closure();
    return null;
  } catch (error) {
    return error;
  }
};

export const test_benchmark_mcp_transport_probe = async (): Promise<void> => {
  const server = measuredServer();
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const session = await probeAutoMovieBenchmarkMcpTransport({
    provenance: "benchmark-probe-fixture:in-process",
    startupTimeoutMs: 5_000,
    timeoutMs: 5_000,
    transport: clientTransport,
  });
  TestValidator.equals(
    "an in-process handshake reports identity and exact byte budgets",
    {
      protocol: session.protocolVersion.length !== 0,
      serverName: session.serverName,
      serverVersion: session.serverVersion,
      tools: session.tools,
    },
    {
      protocol: true,
      serverName: "benchmark-probe-fixture",
      serverVersion: "9.9.9",
      tools: [
        // "가" is three UTF-8 bytes, so a description budget that counted UTF-16
        // code units would read 1 here.
        { name: "first", descriptionBytes: 3, schemaBytes: 17 },
        { name: "second", descriptionBytes: 0, schemaBytes: 55 },
      ],
    },
  );

  const startFailure = new Error("transport refused to start");
  const probeFailure = await rejection(() =>
    probeAutoMovieBenchmarkMcpTransport({
      diagnostics: () => "  server said no  ",
      provenance: "unstartable",
      startupTimeoutMs: 5_000,
      timeoutMs: 5_000,
      transport: new FailingTransport({ startFailure }),
    }),
  );
  TestValidator.equals(
    "a refused handshake carries the provenance and the collected diagnostics",
    message(probeFailure),
    'MCP probe "unstartable" failed: transport refused to start; stderr: server said no',
  );

  const closeFailure = new Error("transport refused to close");
  const combined = await rejection(() =>
    probeAutoMovieBenchmarkMcpTransport({
      provenance: "unstartable-and-unclosable",
      startupTimeoutMs: 5_000,
      timeoutMs: 5_000,
      transport: new FailingTransport({ closeFailure, startFailure }),
    }),
  );
  TestValidator.predicate(
    "a probe failure and a close failure travel together",
    combined instanceof AggregateError &&
      combined.errors.length === 2 &&
      message(combined.errors[0]) ===
        'MCP probe "unstartable-and-unclosable" failed: transport refused to start' &&
      combined.errors[1] === closeFailure,
  );

  const closedServer = measuredServer();
  const [measuredClient, measuredServerTransport] =
    InMemoryTransport.createLinkedPair();
  await closedServer.connect(measuredServerTransport);
  const closeOnly = await rejection(() =>
    probeAutoMovieBenchmarkMcpTransport({
      provenance: "measured-but-unclosable",
      startupTimeoutMs: 5_000,
      timeoutMs: 5_000,
      transport: new FailingTransport({
        closeFailure,
        inner: measuredClient,
      }),
    }),
  );
  TestValidator.predicate(
    "a close failure after a successful measurement is not swallowed",
    closeOnly === closeFailure,
  );
  await server.close();
  await closedServer.close();
};
