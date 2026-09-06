import { createAutoMovieSourceRuntimeModelRegistry } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

import { drawingBoxModel } from "../internal/drawingFixtures";
import { namedFacts } from "../internal/predicates";

/**
 * Source runtime model membership is exact own-key data.
 *
 * Scenarios:
 *
 * 1. Compiler keys and contained model ids resolve independently while own-key
 *    enumeration preserves insertion order.
 * 2. A source model named `__proto__` is registered, looked up, enumerated, and
 *    serialized exactly once as an own data property.
 * 3. A compiler-owned `__proto__` key is seeded with the same own-data
 *    semantics, while prototype member names absent from a registry remain
 *    unavailable.
 */
export const test_production_source_runtime_model_identity = (): void => {
  const compilerModel = drawingBoxModel({
    id: "compiler-model-id",
    shape: { type: "box", width: 1, height: 1, depth: 1 },
    material: "compiler-material",
  });
  const authoredModel = drawingBoxModel({
    id: "__proto__",
    shape: { type: "box", width: 2, height: 1, depth: 1 },
    material: "authored-material",
  });
  const registry = createAutoMovieSourceRuntimeModelRegistry(
    Object.fromEntries([["compiler-key", compilerModel]]),
  );
  registry.define(authoredModel.id, authoredModel);
  const compilerPrototypeRegistry = createAutoMovieSourceRuntimeModelRegistry(
    Object.fromEntries([["__proto__", compilerModel]]),
  );

  TestValidator.equals(
    "runtime model registry preserves only exact own identities",
    namedFacts([
      [
        "compilerKeyResolves",
        () => registry.get("compiler-key") === compilerModel,
      ],
      [
        "containedModelIdResolves",
        () => registry.resolve("compiler-model-id") === compilerModel,
      ],
      [
        "prototypeIdIsOwn",
        () =>
          registry.has("__proto__") &&
          registry.get("__proto__") === authoredModel &&
          Object.hasOwn(registry.record, "__proto__"),
      ],
      [
        "populationIsExactAndOrdered",
        () =>
          JSON.stringify(registry.keys()) === '["compiler-key","__proto__"]' &&
          JSON.stringify(registry.values().map((model) => model.id)) ===
            '["compiler-model-id","__proto__"]',
      ],
      [
        "serializationContainsOnlyOwnModels",
        () =>
          JSON.stringify(registry.record) ===
          JSON.stringify(
            Object.fromEntries([
              ["compiler-key", compilerModel],
              ["__proto__", authoredModel],
            ]),
          ),
      ],
      [
        "compilerPrototypeKeyIsOwn",
        () =>
          compilerPrototypeRegistry.has("__proto__") &&
          compilerPrototypeRegistry.get("__proto__") === compilerModel &&
          JSON.stringify(compilerPrototypeRegistry.keys()) === '["__proto__"]',
      ],
      [
        "inheritedNamesRemainAbsent",
        () =>
          ["toString", "constructor", "valueOf"].every(
            (identity) =>
              registry.has(identity) === false &&
              registry.get(identity) === undefined &&
              registry.resolve(identity) === undefined,
          ),
      ],
    ]),
    {
      compilerKeyResolves: true,
      containedModelIdResolves: true,
      prototypeIdIsOwn: true,
      populationIsExactAndOrdered: true,
      serializationContainsOnlyOwnModels: true,
      compilerPrototypeKeyIsOwn: true,
      inheritedNamesRemainAbsent: true,
    },
  );
};
