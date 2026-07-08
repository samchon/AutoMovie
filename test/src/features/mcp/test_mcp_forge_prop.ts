import { resolveFrame } from "@automovie/engine";
import { AutoMovieApplication, IAutoMovieMcpPropSpec } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { createDoorPropSpec } from "../film/test_film_forge_prop";
import { hasViolation } from "../internal/predicates";

const app = new AutoMovieApplication();

/** The engine door spec re-expressed as the MCP boundary accepts it. */
export const mcpDoorSpec = (): IAutoMovieMcpPropSpec => {
  const spec = createDoorPropSpec();
  const articulation = spec.articulation!;
  return {
    node: spec.node,
    model: spec.model,
    articulation: {
      nodes: articulation.nodes,
      profile: {
        id: articulation.profile.id,
        name: articulation.profile.name,
        controls: articulation.profile.controls,
        limits: articulation.profile.limits,
        drivers: [
          ...articulation.profile.drivers.filter((d) => d.type !== "driven"),
          {
            type: "driven",
            output: { kind: "node", node: "pivot", path: "translation" },
            source: { kind: "pointer", pointer: "/ajar", valueType: "scalar" },
            inRange: { from: 0, to: 1 },
            outRange: { from: 0, to: 0.1 },
            clamp: true,
          },
        ],
      },
      binding: articulation.binding,
    },
  };
};

/**
 * The MCP `forgeProp` tool: a JSON-only prop spec — driven ranges as named
 * `{from, to}` objects, no tuples — forges through the same engine gates, and
 * the accepted echo stays MCP-safe.
 *
 * Scenarios:
 *
 * 1. A valid articulated spec (including a driven driver whose named ranges the
 *    converter lowers to engine pairs) forges; the success echo is the MCP spec
 *    itself.
 * 2. The forged articulation still executes: feeding the ENGINE-side spec's
 *    profile to resolveFrame clamps the over-swing (sanity that the MCP layer
 *    changed representation, not semantics).
 * 3. A violating spec (skeletoned model) surfaces the engine's violations through
 *    the tool.
 * 4. A malformed MCP articulation shape is reported as a forge failure instead of
 *    leaking a converter TypeError.
 * 5. Malformed direct prop spec/model/profile/binding shapes stop at the MCP
 *    boundary instead of leaking raw converter or engine dereference errors.
 */
export const test_mcp_forge_prop = (): void => {
  const spec = mcpDoorSpec();
  const output = app.forgeProp({ spec });
  TestValidator.equals("valid prop forges", output.forged.success, true);
  TestValidator.equals(
    "success echoes the MCP spec",
    output.forged.success === true ? output.forged.prop.node : null,
    "door",
  );

  // #724: a curve-driven prop driver omits inRange/outRange entirely; the MCP
  // converter must lower it without inventing dead ranges, and it still forges.
  const curveSpec: IAutoMovieMcpPropSpec = {
    ...spec,
    articulation: {
      ...spec.articulation!,
      profile: {
        ...spec.articulation!.profile,
        drivers: [
          ...spec.articulation!.profile.drivers.filter(
            (d) => d.type !== "driven",
          ),
          {
            type: "driven",
            output: { kind: "node", node: "pivot", path: "translation" },
            source: { kind: "pointer", pointer: "/ajar", valueType: "scalar" },
            curve: {
              points: [
                { source: 0, output: 0 },
                { source: 1, output: 0.1 },
              ],
            },
          },
        ],
      },
    },
  };
  TestValidator.equals(
    "curve-driven prop forges with no ranges (#724)",
    app.forgeProp({ spec: curveSpec }).forged.success,
    true,
  );

  const engineSpec = createDoorPropSpec();
  const articulation = engineSpec.articulation!;
  const slammed = resolveFrame({
    nodes: articulation.nodes,
    clip: {
      id: "swing",
      name: null,
      duration: 1,
      loop: false,
      tracks: [
        {
          channel: { kind: "node", node: "hinge", path: "rotation" },
          times: [0],
          values: [
            0,
            Math.sin(Math.PI * (75 / 180)),
            0,
            Math.cos(Math.PI * (75 / 180)),
          ],
          interpolation: "linear",
        },
      ],
    },
    limits: [],
    profiles: [
      { profile: articulation.profile, binding: articulation.binding },
    ],
    seconds: 0,
  });
  TestValidator.predicate(
    "the same declared limit still clamps at resolve time",
    slammed.violations.length > 0,
  );

  const broken = app.forgeProp({
    spec: {
      ...spec,
      model: {
        ...spec.model,
        skeleton: { id: "rig", bones: [] },
      },
    },
  });
  TestValidator.equals(
    "skeletoned model refused",
    broken.forged.success,
    false,
  );
  TestValidator.predicate(
    "violation surfaced through the tool",
    broken.forged.success === false &&
      broken.forged.violations.some((v) =>
        v.path.includes("$input.model.skeleton"),
      ),
  );

  const malformedArticulation = app.forgeProp({
    spec: {
      ...spec,
      articulation: {},
    } as unknown as IAutoMovieMcpPropSpec,
  });
  TestValidator.equals(
    "malformed articulation returns a forge failure",
    malformedArticulation.forged.success,
    false,
  );
  TestValidator.predicate(
    "malformed articulation violation names articulation",
    hasViolation(malformedArticulation.forged, "type", "$input.articulation"),
  );

  const malformedRoot = app.forgeProp({
    spec: null as unknown as IAutoMovieMcpPropSpec,
  });
  TestValidator.predicate(
    "malformed prop root returns violations",
    malformedRoot.forged.success === false &&
      hasViolation(malformedRoot.forged, "type", "$input"),
  );

  const malformedModel = app.forgeProp({
    spec: {
      ...spec,
      model: null as unknown as IAutoMovieMcpPropSpec["model"],
    },
  });
  TestValidator.predicate(
    "malformed prop model returns violations",
    malformedModel.forged.success === false &&
      hasViolation(malformedModel.forged, "type", "$input.model"),
  );

  const malformedDrivers = app.forgeProp({
    spec: {
      ...spec,
      articulation: {
        ...spec.articulation!,
        profile: {
          ...spec.articulation!.profile,
          drivers: null as unknown as NonNullable<
            IAutoMovieMcpPropSpec["articulation"]
          >["profile"]["drivers"],
        },
      },
    },
  });
  TestValidator.predicate(
    "malformed prop profile drivers return violations",
    malformedDrivers.forged.success === false &&
      hasViolation(
        malformedDrivers.forged,
        "type",
        "$input.articulation.profile.drivers",
      ),
  );

  const malformedBoneMap = app.forgeProp({
    spec: {
      ...spec,
      articulation: {
        ...spec.articulation!,
        binding: {
          ...spec.articulation!.binding,
          boneMap: { pivot: null, mirror: "handleMirror" } as unknown as Record<
            string,
            string
          >,
        },
      },
    },
  });
  TestValidator.predicate(
    "malformed prop binding bone map returns violations",
    malformedBoneMap.forged.success === false &&
      hasViolation(
        malformedBoneMap.forged,
        "type",
        '$input.articulation.binding.boneMap["pivot"]',
      ),
  );
};
