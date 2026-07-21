import { IAutoMovieModel } from "@automovie/interface";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { TestValidator } from "@nestia/e2e";

import { MCP_REQUEST_TIMEOUT, openMcpStdio } from "../internal/mcpStdio";

/** A minimal valid prop model: generated, skeleton-less, id equal to the node. */
const propModel = (): IAutoMovieModel => ({
  id: "crate",
  name: null,
  origin: "generated",
  skeleton: null,
  body: null,
  materials: [
    {
      id: "mat-1",
      name: "wood",
      baseColor: { r: 0.45, g: 0.38, b: 0.32, a: 1, hex: null },
      metallic: 0,
      roughness: 0.6,
      emissive: null,
      opacity: 1,
      baseColorTexture: null,
    },
  ],
  parts: [
    {
      id: "part-1",
      name: null,
      geometry: {
        type: "primitive",
        shape: { type: "box", width: 0.5, height: 0.4, depth: 0.5 },
      },
      material: "mat-1",
      attachedBone: null,
      transform: null,
    },
  ],
  asset: null,
});

interface IProbe {
  /** Whether the tool refused the call. */
  refused: boolean;

  /** The serialized annotation text the client receives. */
  text: string;
}

const probe = async (
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<IProbe> => {
  const result = await client.callTool({ name, arguments: args }, undefined, {
    timeout: MCP_REQUEST_TIMEOUT,
  });
  const content = (result.content ?? []) as { text?: string }[];
  return {
    refused: result.isError === true,
    text: content.map((part) => part.text ?? "").join(""),
  };
};

/**
 * One authoring mistake gets one answer (#1340).
 *
 * `forge` used to accept an excess property on its input without complaint, and
 * whether the author ever learned about it depended on where the property
 * landed: on an input-only object the call succeeded silently and the stray
 * property was discarded, while on an object the engine echoes into its result
 * the same property survived into the output, failed OUTPUT validation, and
 * threw. The error then blamed the tool's output for the caller's input, at a
 * path prefixed `$input.forged.` where the caller had written `$input.forge.`.
 *
 * The fix is at the boundary, not in the diagnostics: the controller validates
 * with typia's `validateEquals`, so an excess property is refused where it was
 * written, before the engine runs, for every tool alike.
 *
 * This scenario must drive the real stdio transport. An in-process
 * `AutoMovieApplication` call bypasses typia entirely, so the strictness is
 * only observable through a client.
 *
 * Scenarios (one live stdio handshake):
 *
 * 1. Control: the payload with no excess property succeeds.
 * 2. An excess property on an INPUT-ONLY object is refused, named at its own input
 *    path.
 * 3. An excess property on an ECHOED object is refused at its own INPUT path
 *    (`$input.spec.model...`), not at the output wrapper's, so the blame points
 *    where the author can act.
 * 4. Probes 2 and 3 give the SAME verdict as each other. That equality is the
 *    whole issue: the two are one mistake in two places.
 * 5. Boundary, depth: top-level, array-element, and deeply-nested excess
 *    properties are all refused, and on a tool that echoes nothing at all, so
 *    the rule is uniform rather than a property of the echo.
 * 6. Negative twin: a genuinely missing required field still fails at its own
 *    input path with its existing "fill the value" message, so strictness did
 *    not swallow or reshape the diagnostics that already worked.
 */
export const test_mcp_input_strictness = async (): Promise<void> => {
  const { client } = await openMcpStdio("automovie-test");
  try {
    const spec = (model: IAutoMovieModel) => ({
      node: "crate",
      model,
      articulation: null,
    });

    // 1. CONTROL
    const control = await probe(client, "forgeProp", {
      spec: spec(propModel()),
    });
    TestValidator.equals(
      "a payload with no excess property succeeds",
      control.refused,
      false,
    );

    // 2. excess on an input-only object
    const inputOnly = await probe(client, "forgeProp", {
      spec: { ...spec(propModel()), bogusInputOnlyField: "x" },
    });
    TestValidator.predicate(
      "an excess property on an input-only object is refused where it was written",
      inputOnly.refused &&
        inputOnly.text.includes("$input.spec.bogusInputOnlyField") &&
        inputOnly.text.includes("is not defined in the object type"),
    );

    // 3. excess on an object the engine echoes into its result
    const echoedModel = propModel();
    const echoed = await probe(client, "forgeProp", {
      spec: spec({
        ...echoedModel,
        materials: [
          {
            ...echoedModel.materials[0]!,
            baseColor: {
              ...echoedModel.materials[0]!.baseColor,
              z: 0,
            } as unknown as IAutoMovieModel["materials"][number]["baseColor"],
          },
        ],
      }),
    });
    TestValidator.predicate(
      "an excess property on an echoed object is refused at its INPUT path",
      echoed.refused &&
        echoed.text.includes("$input.spec.model.materials[0].baseColor.z") &&
        echoed.text.includes("$input.spec.model.materials[0].baseColor.z") &&
        echoed.text.includes('Type errors in "forgeProp" output:') === false,
    );

    // 4. the two are one mistake, so they get one verdict
    TestValidator.equals(
      "the input-only and echoed mistakes now agree",
      inputOnly.refused,
      echoed.refused,
    );

    // 5. BOUNDARY: depth, and a tool that echoes nothing
    const topLevel = await probe(client, "validatePose", {
      pose: { skeleton: "s", root: null, joints: [] },
      skeleton: { id: "s", bones: [] },
      bogusTopLevel: 1,
    });
    TestValidator.predicate(
      "a top-level excess property is refused",
      topLevel.refused && topLevel.text.includes("$input.bogusTopLevel"),
    );
    const nested = await probe(client, "validatePose", {
      pose: { skeleton: "s", root: null, joints: [], bogusNested: 1 },
      skeleton: { id: "s", bones: [] },
    });
    TestValidator.predicate(
      "a nested excess property on a non-echoing tool is refused too",
      nested.refused && nested.text.includes("$input.pose.bogusNested"),
    );
    const inArray = await probe(client, "validatePose", {
      pose: {
        skeleton: "s",
        root: null,
        joints: [
          { bone: "hips", flexion: 0, abduction: null, twist: null, bogus: 1 },
        ],
      },
      skeleton: { id: "s", bones: [] },
    });
    TestValidator.predicate(
      "an excess property inside an array element is refused at its index",
      inArray.refused && inArray.text.includes("$input.pose.joints[0].bogus"),
    );

    // 6. NEGATIVE TWIN: a real missing field still reads the way it always did
    const missing = await probe(client, "forgeProp", {
      spec: { node: "crate", articulation: null },
    });
    TestValidator.predicate(
      "a missing required field still fails at its own path, unchanged",
      missing.refused &&
        missing.text.includes("$input.spec.model") &&
        missing.text.includes("Please fill the"),
    );
  } finally {
    await client.close();
  }
};
