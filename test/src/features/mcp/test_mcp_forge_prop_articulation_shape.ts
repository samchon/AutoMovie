import { AutoMovieApplication, IAutoMovieMcpPropSpec } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { hasViolation } from "../internal/predicates";
import { mcpDoorSpec } from "./test_mcp_forge_prop";

const app = new AutoMovieApplication();

type PropArticulation = NonNullable<IAutoMovieMcpPropSpec["articulation"]>;

/**
 * The MCP `forgeProp` articulation shape gate: every driver kind, channel form,
 * limit, node, binding, and range the converter would otherwise dereference is
 * validated first, so a malformed prop spec fails as field-located data instead
 * of leaking a `toEnginePropSpec` TypeError or a raw engine dereference.
 *
 * Scenarios:
 *
 * 1. A single spec carrying one malformed driver of every kind (a non-string type,
 *    and bad `aim`/`ik`/`parent`/`spring`/`driven` fields plus an unsupported
 *    type), a non-object and a bad-channel limit, and a non-object articulation
 *    node fails at each field's own `$input.spec.articulation...` path.
 * 2. A non-object (but non-null) articulation fails at `$input.spec.articulation`.
 * 3. A non-object binding bone map fails at
 *    `$input.spec.articulation.binding.boneMap`.
 */
export const test_mcp_forge_prop_articulation_shape = (): void => {
  const base = mcpDoorSpec();
  const validBinding = base.articulation!.binding;

  const badDrivers = app.forgeProp({
    spec: {
      ...base,
      articulation: {
        nodes: [null],
        profile: {
          id: "p",
          name: "n",
          controls: [],
          limits: [null, { channel: 5 }],
          drivers: [
            { type: 42 },
            { type: "aim", owner: null, target: null },
            { type: "ik", chain: ["a", 5], goal: null, pole: { node: 7 } },
            { type: "parent", owner: null, parent: null },
            { type: "spring", chain: ["b", 9], center: 5 },
            { type: "wobble" },
            {
              type: "driven",
              output: { kind: "bogus" },
              source: { kind: "pointer", pointer: "/a", valueType: "scalar" },
              inRange: 5,
              outRange: { from: 0, to: 1 },
            },
            null,
            { type: "ik", chain: "notarray", goal: "g", pole: null },
            { type: "ik", chain: ["x"], goal: "g", pole: 5 },
          ],
        },
        binding: validBinding,
      } as unknown as PropArticulation,
    },
  }).forged;

  const driverRoot = "$input.spec.articulation.profile.drivers";
  const at = (path: string): boolean => hasViolation(badDrivers, "type", path);
  TestValidator.predicate(
    "every malformed prop driver, channel, limit, and node fails at its path",
    badDrivers.success === false &&
      at(`${driverRoot}[0].type`) &&
      at(`${driverRoot}[1].owner`) &&
      at(`${driverRoot}[1].target`) &&
      at(`${driverRoot}[2].chain[1]`) &&
      at(`${driverRoot}[2].goal`) &&
      at(`${driverRoot}[2].pole.node`) &&
      at(`${driverRoot}[3].owner`) &&
      at(`${driverRoot}[3].parent`) &&
      at(`${driverRoot}[4].chain[1]`) &&
      at(`${driverRoot}[4].center`) &&
      at(`${driverRoot}[5].type`) &&
      at(`${driverRoot}[6].output.kind`) &&
      at(`${driverRoot}[6].inRange`) &&
      at(`${driverRoot}[7]`) &&
      at(`${driverRoot}[8].chain`) &&
      at(`${driverRoot}[9].pole`) &&
      at("$input.spec.articulation.profile.limits[0]") &&
      at("$input.spec.articulation.profile.limits[1].channel") &&
      at("$input.spec.articulation.nodes[0]"),
  );

  const nonObjectArticulation = app.forgeProp({
    spec: {
      ...base,
      articulation: 5 as unknown as PropArticulation,
    },
  }).forged;
  TestValidator.predicate(
    "a non-object articulation fails at its root path",
    nonObjectArticulation.success === false &&
      hasViolation(nonObjectArticulation, "type", "$input.spec.articulation"),
  );

  const nonObjectBoneMap = app.forgeProp({
    spec: {
      ...base,
      articulation: {
        ...base.articulation!,
        binding: {
          ...validBinding,
          boneMap: 5 as unknown as Record<string, string>,
        },
      },
    },
  }).forged;
  TestValidator.predicate(
    "a non-object binding bone map fails at its path",
    nonObjectBoneMap.success === false &&
      hasViolation(
        nonObjectBoneMap,
        "type",
        "$input.spec.articulation.binding.boneMap",
      ),
  );
};
