import { AUTOMOVIE_AUTHORED_DOCUMENT_LAYERS } from "@automovie/evidence";
import { z } from "zod";

import { DEFAULT_BUDGET, MAX_BUDGET } from "./internal/referenceError";
import type { AutoMovieReferenceRequest } from "./structures/IAutoMovieReference";

const budgetBytes = z.number().int().min(256).max(MAX_BUDGET).optional();
const revision = z.string().regex(/^[0-9a-f]{64}$/u);
const read = {
  expectedDigest: revision.optional(),
  detail: z.boolean().optional(),
  budgetBytes,
};

/**
 * The four narrow input schemas reused by MCP registration and local admission.
 *
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-transports Keeps both transport requests under one grammar without a caller-controlled production root.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-transports Describes exactly four read-only operations and rejects unknown request properties.
 */
export const autoMovieReferenceSchemas = {
  get_index_of_layer: z
    .object({
      layer: z.enum(AUTOMOVIE_AUTHORED_DOCUMENT_LAYERS),
      limit: z.number().int().min(1).max(100).optional(),
      continuation: z
        .object({ revision, offset: z.number().int().min(1).max(10_000) })
        .strict()
        .optional(),
      budgetBytes,
    })
    .strict(),
  get_index_of_file: z
    .object({ file: z.string().min(1).max(4_096), budgetBytes })
    .strict(),
  read_file_without_annotations: z
    .object({ file: z.string().min(1).max(4_096), ...read })
    .strict(),
  read_section_without_annotations: z
    .object({ location: z.string().min(1).max(4_096), ...read })
    .strict(),
};

const requestSchema = z.discriminatedUnion("operation", [
  autoMovieReferenceSchemas.get_index_of_layer.extend({
    operation: z.literal("get_index_of_layer"),
  }),
  autoMovieReferenceSchemas.get_index_of_file.extend({
    operation: z.literal("get_index_of_file"),
  }),
  autoMovieReferenceSchemas.read_file_without_annotations.extend({
    operation: z.literal("read_file_without_annotations"),
  }),
  autoMovieReferenceSchemas.read_section_without_annotations.extend({
    operation: z.literal("read_section_without_annotations"),
  }),
]);

const layerProbe = z.object({
  operation: z.literal("get_index_of_layer"),
  layer: z.string(),
});

/**
 * Distinguish an unknown authored population from a malformed request envelope.
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-bounds Gives callers a concrete population error instead of an empty successful page.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-bounds Classifies unknown layers independently of general schema admission.
 */
export function autoMovieReferenceRequestError(input: unknown): {
  code: string;
  message: string;
} {
  const layer = layerProbe.safeParse(input);
  return layer.success &&
    !AUTOMOVIE_AUTHORED_DOCUMENT_LAYERS.some(
      (candidate) => candidate === layer.data.layer,
    )
    ? {
        code: "INVALID_LAYER",
        message:
          "Choose one of the thirteen documented authored Markdown layers.",
      }
    : {
        code: "INVALID_REQUEST",
        message:
          "Use one documented reference operation and its bounded arguments.",
      };
}

/**
 * Admit an unknown request without reflecting submitted source or credentials in errors.
 *
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-bounds Refuses malformed operations and response limits before a reader is called.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-bounds Applies bounded schema admission and supplies the documented default response budget.
 */
export function parseAutoMovieReferenceRequest(
  input: unknown,
): (AutoMovieReferenceRequest & { budgetBytes: number }) | null {
  const parsed = requestSchema.safeParse(input);
  return parsed.success
    ? { ...parsed.data, budgetBytes: parsed.data.budgetBytes ?? DEFAULT_BUDGET }
    : null;
}
