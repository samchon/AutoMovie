import { createAutoMovieMcpServer } from "@automovie/mcp";
import packageJson from "@automovie/mcp/package.json";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { TestValidator } from "@nestia/e2e";

import { productionFixture } from "./productionFixtures";

interface IServerIdentityFailure {
  error: unknown;
}

interface IServerIdentityConnectionCleanup {
  cleanup: () => Promise<unknown>;
  resource: string;
}

class ServerIdentityCleanupError extends AggregateError {}

/** Close acquired identity resources without replacing an earlier failure. */
export const preserveServerIdentityCleanup = async (
  failure: IServerIdentityFailure | undefined,
  connections: readonly IServerIdentityConnectionCleanup[],
  fixtureCleanup: () => unknown,
): Promise<void> => {
  const results = await Promise.allSettled(
    connections.map((resource) => Promise.resolve().then(resource.cleanup)),
  );
  const cleanupFailures: Array<{ error: unknown; resource: string }> =
    results.flatMap((result, index) =>
      result.status === "fulfilled"
        ? []
        : [{ error: result.reason, resource: connections[index]!.resource }],
    );
  try {
    fixtureCleanup();
  } catch (error) {
    cleanupFailures.push({ error, resource: "production fixture" });
  }
  if (cleanupFailures.length === 0) return;
  if (failure === undefined && cleanupFailures.length === 1)
    throw cleanupFailures[0]!.error;
  throw new ServerIdentityCleanupError(
    [
      ...(failure === undefined ? [] : [failure.error]),
      ...cleanupFailures.map((entry) => entry.error),
    ],
    `Server-identity cleanup failed${
      failure === undefined ? "" : " after the test failed"
    }: ${cleanupFailures.map((entry) => entry.resource).join(", ")}.`,
  );
};

/** The initialize handshake identifies the installed five-tool package. */
export const test_mcp_server_identity = async (): Promise<void> => {
  const connectionCleanups: IServerIdentityConnectionCleanup[] = [];
  let serverIdentityFailure: IServerIdentityFailure | undefined;
  const fixture = productionFixture();
  try {
    const server = createAutoMovieMcpServer({
      projectRoot: fixture.root,
      productionId: "fixture-film",
    });
    connectionCleanups.push({
      resource: "MCP server",
      cleanup: () => server.close(),
    });
    const client = new Client({
      name: "automovie-identity-test",
      version: "0.0.0",
    });
    connectionCleanups.unshift({
      resource: "MCP client",
      cleanup: () => client.close(),
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    TestValidator.equals(
      "server implementation identity",
      client.getServerVersion(),
      { name: "automovie", version: packageJson.version },
    );
  } catch (error) {
    serverIdentityFailure = { error };
    throw error;
  } finally {
    await preserveServerIdentityCleanup(
      serverIdentityFailure,
      connectionCleanups,
      () => fixture.dispose(),
    );
  }
};
