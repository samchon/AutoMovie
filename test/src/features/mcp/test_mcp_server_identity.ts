import { createAutoMovieMcpServer } from "@automovie/mcp";
import packageJson from "@automovie/mcp/package.json";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { TestValidator } from "@nestia/e2e";

import { productionFixture } from "./productionFixtures";

/** The initialize handshake identifies the installed five-tool package. */
export const test_mcp_server_identity = async (): Promise<void> => {
  const fixture = productionFixture();
  const server = createAutoMovieMcpServer({
    projectRoot: fixture.root,
    productionId: "fixture-film",
  });
  const client = new Client({
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
      { name: "automovie", version: packageJson.version },
    );
  } finally {
    await Promise.allSettled([client.close(), server.close()]);
    fixture.dispose();
  }
};
