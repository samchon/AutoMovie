import {
  createAutoMovieMcpServer,
  createAutoMovieReferenceProvider,
  startAutoMovieMcpServer,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

/**
 * Each registered tool consumes the same provider input and result as local JSON.
 *
 * Scenarios:
 * 1. Registration exposes exactly four read-only operations with no runtime action.
 * 2. A section success and a stale-digest failure retain the provider's exact envelope.
 *    The injected registration sink does not test the SDK's protocol implementation.
 */
export const test_reference_mcp_registration = async (): Promise<void> => {
  const registrations = new Map<
    string,
    {
      config: {
        inputSchema: { safeParse(input: unknown): { success: boolean } };
        annotations?: {
          readOnlyHint?: boolean;
          destructiveHint?: boolean;
          idempotentHint?: boolean;
          openWorldHint?: boolean;
        };
      };
      handler: (
        input: Record<string, unknown>,
      ) => Promise<{ content: { text: string }[]; isError: boolean }>;
    }
  >();
  const reader = {
    read: async () => Buffer.from("## A {#a}\nbody"),
    list: async () => [],
  };
  let connected: unknown;
  const sink = {
    registerTool(name: string, config: unknown, handler: unknown) {
      registrations.set(name, { config, handler } as never);
      return {};
    },
    connect: async (transport: unknown) => {
      connected = transport;
    },
  };
  const server = createAutoMovieMcpServer(
    reader,
    "test-version",
    (identity) => {
      TestValidator.equals("explicit server identity", identity, {
        name: "automovie-reference",
        version: "test-version",
      });
      return sink as unknown as ReturnType<typeof createAutoMovieMcpServer>;
    },
  );
  const transport = {} as ReturnType<
    NonNullable<Parameters<typeof startAutoMovieMcpServer>[2]>["transport"]
  >;
  const started = await startAutoMovieMcpServer("bound-root", "test-version", {
    reader: async (root) => {
      TestValidator.equals("single startup root", root, "bound-root");
      return reader;
    },
    server: (input, version) => {
      TestValidator.predicate("same bound reader", input === reader);
      TestValidator.equals("same installed version", version, "test-version");
      return server;
    },
    transport: () => transport,
  });
  TestValidator.predicate("same startup server", started === server);
  TestValidator.predicate(
    "chosen stdio transport connected",
    connected === transport,
  );
  TestValidator.equals(
    "only reference operations",
    [...registrations.keys()],
    [
      "get_index_of_layer",
      "get_index_of_file",
      "read_file_without_annotations",
      "read_section_without_annotations",
    ],
  );
  for (const item of registrations.values())
    TestValidator.equals("read-only annotation", item.config.annotations, {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    });
  const inputs: Record<string, Record<string, unknown>> = {
    get_index_of_layer: { layer: "settings" },
    get_index_of_file: { file: "docs/settings/a.md" },
    read_file_without_annotations: { file: "docs/settings/a.md" },
    read_section_without_annotations: { location: "docs/settings/a.md#a" },
  };
  const provider = createAutoMovieReferenceProvider(reader);
  for (const [operation, input] of Object.entries(inputs)) {
    TestValidator.equals(
      "tool schema keeps valid input",
      registrations.get(operation)!.config.inputSchema.safeParse(input).success,
      true,
    );
    TestValidator.equals(
      "tool schema refuses request-time roots",
      registrations.get(operation)!.config.inputSchema.safeParse({
        ...input,
        root: "other-production",
      }).success,
      false,
    );
    const result = await registrations.get(operation)!.handler(input);
    TestValidator.equals(
      `same ${operation} result`,
      result.content[0].text,
      JSON.stringify(await provider({ ...input, operation })),
    );
    TestValidator.equals("success transport marker", result.isError, false);
  }
  const stale = await registrations
    .get("read_file_without_annotations")!
    .handler({ file: "docs/settings/a.md", expectedDigest: "0".repeat(64) });
  TestValidator.equals("failure transport marker", stale.isError, true);
  TestValidator.equals(
    "same failure code",
    JSON.parse(stale.content[0].text).error.code,
    "STALE_REFERENCE",
  );
};
