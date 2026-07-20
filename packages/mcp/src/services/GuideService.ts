import { AutoMovieGuideName, IAutoMovieGuideDocumentOutput } from "../dto";
import { AUTOMOVIE_GUIDE_CONSTANT } from "../guides/AutoMovieGuideConstant";

/**
 * The film-authoring guide corpus, markdown doctrine generated from
 * `packages/mcp/prompts/*.md`, served by exact name so the rich guidance lives
 * outside the MCP JSDoc caps (512-char server lead, 1023-char tool
 * descriptions). Guides teach the method; tool returns decide correctness.
 */
export class GuideService {
  public getGuideDocument(props: {
    name: AutoMovieGuideName;
  }): IAutoMovieGuideDocumentOutput {
    assertGuideDocumentRequestRoot(props);
    assertGuideDocumentName(props.name);
    const content: string | undefined = (
      AUTOMOVIE_GUIDE_CONSTANT as Record<string, string>
    )[props.name];
    if (content === undefined)
      throw new Error(
        `unknown guide document "${props.name}"; valid names: ${Object.keys(
          AUTOMOVIE_GUIDE_CONSTANT,
        ).join(", ")}`,
      );
    return { content };
  }
}

function assertGuideDocumentRequestRoot(
  props: unknown,
): asserts props is Record<string, unknown> {
  if (typeof props === "object" && props !== null && !Array.isArray(props))
    return;
  throw new Error("guide document request at $input must be a JSON object");
}

function assertGuideDocumentName(
  name: unknown,
): asserts name is AutoMovieGuideName {
  if (typeof name === "string" && name.trim().length > 0) return;
  throw new Error(
    "guide document name at $input.name must be a non-empty string",
  );
}
