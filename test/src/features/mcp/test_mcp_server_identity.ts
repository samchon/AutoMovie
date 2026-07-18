import { createAutoMovieMcpServer } from "@automovie/mcp";
import packageJson from "@automovie/mcp/package.json";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TestValidator } from "@nestia/e2e";

/**
 * The MCP initialize handshake identifies the installed AutoMovie package.
 *
 * MCP implementation metadata is distinct from the negotiated protocol version.
 * Announcing a dependency fallback such as `"1.0.0"` makes client diagnostics
 * disagree with the artifact that actually serves the tools.
 *
 * 1. Create the production server factory over an in-memory transport.
 * 2. Connect a real MCP SDK client and complete initialize.
 * 3. Assert the public server identity matches the exported package manifest.
 */
export const test_mcp_server_identity = async (): Promise<void> => {
  const server: McpServer = createAutoMovieMcpServer();
  const client: Client = new Client({
    name: "automovie-identity-test",
    version: "0.0.0",
  });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    TestValidator.equals(
      "server implementation identity",
      client.getServerVersion(),
      {
        name: "automovie",
        version: packageJson.version,
      },
    );
  } finally {
    await Promise.allSettled([client.close(), server.close()]);
  }
};
