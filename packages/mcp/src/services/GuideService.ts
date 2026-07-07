import { AutoMovieGuideName, IAutoMovieGuideDocumentOutput } from "../dto";
import { AUTOMOVIE_GUIDE_CONSTANT } from "../guides/AutoMovieGuideConstant";

/**
 * The film-authoring guide corpus — markdown doctrine generated from
 * `packages/mcp/prompts/*.md`, served by exact name so the rich guidance lives
 * outside the MCP JSDoc caps (512-char server lead, 1023-char tool
 * descriptions). Guides teach the method; tool returns decide correctness.
 */
export class GuideService {
  public getGuideDocument(props: {
    name: AutoMovieGuideName;
  }): IAutoMovieGuideDocumentOutput {
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
