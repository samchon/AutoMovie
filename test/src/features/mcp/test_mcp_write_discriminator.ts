import { TestValidator } from "@nestia/e2e";

import { makeScriptWrite, makeStagingWrite } from "../internal/filmFixtures";
import { openMcpStdio, probeMcpTool } from "../internal/mcpStdio";

/** The same payload with its `type` discriminator removed. */
const withoutType = (value: object): Record<string, unknown> => {
  const copy: Record<string, unknown> = { ...value };
  delete copy.type;
  return copy;
};

/**
 * The `type: "write"` discriminator is optional on the authoring surface
 * (#1347).
 *
 * Ten parameters across `stage` / `block` / `perform` / `cut` / `forge` take
 * `IAutoMovie*Application.IWrite`, one arm of a two-arm union whose other arm
 * (`IDecline`) no tool accepts. The constant therefore discriminated nothing an
 * author could vary: it was a required token whose only legal value the tool's
 * own signature already fixed, and no guide in the corpus mentioned it. Three
 * independent benchmark sessions dropped it and lost a full round each, one of
 * them re-emitting an 8,722-character `perform` payload in its entirety.
 *
 * `IDecline` is untouched: it remains how a model refuses a brief at the
 * `IProps.request` level. What changed is that supplying the constant became
 * optional rather than mandatory, so both the omission and the habit are legal
 * and only a WRONG literal is still refused.
 *
 * This scenario must drive the real stdio transport: an in-process
 * `AutoMovieApplication` call bypasses typia entirely, so input validation is
 * only observable through a client.
 *
 * Scenarios (one live stdio handshake):
 *
 * 1. Positive. A `stage` call omitting `type` on BOTH of its write parameters
 *    succeeds.
 * 2. Regression. The same call supplying `type: "write"` still succeeds, so the
 *    habit five sessions formed keeps working.
 * 3. Boundary. A wrong literal (`type: "decline"`, the other union arm's tag) is
 *    still refused, at its own `$input.call.input.script.type` path.
 * 4. Negative twin. Input strictness was not widened generally: an excess property
 *    on the same payload is still refused where it was written, which is the
 *    guarantee #1340 bought.
 */
export const test_mcp_write_discriminator = async (): Promise<void> => {
  const { client } = await openMcpStdio("automovie-test");
  try {
    const script = makeScriptWrite();
    const staging = makeStagingWrite();

    // 1. POSITIVE: neither write parameter carries the constant
    const omitted = await probeMcpTool(client, "stage", {
      script: withoutType(script),
      staging: withoutType(staging),
    });
    TestValidator.equals(
      "a stage call omitting the write discriminator succeeds",
      omitted.refused,
      false,
    );

    // 2. REGRESSION: supplying it is still legal
    const supplied = await probeMcpTool(client, "stage", { script, staging });
    TestValidator.equals(
      "a stage call supplying the write discriminator still succeeds",
      supplied.refused,
      false,
    );

    // 3. BOUNDARY: the other arm's tag is not a legal value here
    const declined = await probeMcpTool(client, "stage", {
      script: { ...script, type: "decline" },
      staging,
    });
    TestValidator.predicate(
      "a wrong literal is refused at its own path",
      declined.refused &&
        declined.text.includes("$input.call.input.script.type"),
    );

    // 4. NEGATIVE TWIN: strictness elsewhere is unchanged
    const excess = await probeMcpTool(client, "stage", {
      script: { ...withoutType(script), bogusScriptField: 1 },
      staging: withoutType(staging),
    });
    TestValidator.predicate(
      "an excess property on the same payload is still refused",
      excess.refused &&
        excess.text.includes("$input.call.input.script.bogusScriptField") &&
        excess.text.includes("is not defined in the object type"),
    );
  } finally {
    await client.close();
  }
};
