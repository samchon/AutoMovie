import { AutoMovieGatewayApplication } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * The compact gateway delegates its three operating entry points directly and
 * routes every other call without changing the operation's output contract.
 *
 * Scenarios:
 *
 * 1. The guide entry point returns the generated operating guide.
 * 2. `openProject` activates resident memory and `nextSteps` reads its ladder.
 * 3. `execute(getSlate)` returns the original result under an operation-tagged
 *    wrapper, proving the dynamic adapter preserves the selected operation.
 */
export const test_mcp_gateway_application = async (): Promise<void> => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-gateway-"));
  try {
    const app = new AutoMovieGatewayApplication();
    const guide = app.getGuideDocument({ name: "AUTOMOVIE_OVERALL" });
    TestValidator.predicate(
      "the direct guide entry point returns the operating guide",
      guide.content.startsWith("# AutoMovie MCP Operating Guide"),
    );

    const opened = app.openProject({ root });
    TestValidator.equals(
      "the direct project entry point activates the requested root",
      opened.project.root,
      path.resolve(root),
    );
    TestValidator.predicate(
      "the direct ladder entry point names the first resident action",
      app
        .nextSteps()
        .nextActions.some((action) => action.includes("commitScript")),
    );

    const executed = await app.execute({
      call: { operation: "getSlate", input: {} },
    });
    TestValidator.equals(
      "the gateway repeats the selected operation",
      executed.result.operation,
      "getSlate",
    );
    if (executed.result.operation !== "getSlate") return;
    TestValidator.equals(
      "the gateway preserves the operation output",
      executed.result.output.slate,
      {
        script: null,
        scene: null,
        shots: [],
        beatEnds: [],
        notes: [],
        film: null,
      },
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
