import { AutoMovieGuideName, IAutoMovieGuideDocumentOutput } from "../dto";
import { AUTOMOVIE_GUIDE_CONSTANT } from "../guides/AutoMovieGuideConstant";

/**
 * Every guide name the server actually serves, taken from the generated corpus
 * rather than restated.
 *
 * The corpus, the {@link AutoMovieGuideName} union, and the scenario that covers
 * them were three hand-kept lists with nothing comparing them (#1399). This
 * closes one side: it cannot fall behind the markdown, because it is the
 * markdown's own keys. The other side is the lookup below, which indexes the
 * generated object with a union key, so a name the union declares and the
 * corpus lacks is a build error rather than a runtime surprise.
 */
export const AUTOMOVIE_GUIDE_NAMES: readonly AutoMovieGuideName[] = Object.keys(
  AUTOMOVIE_GUIDE_CONSTANT,
) as AutoMovieGuideName[];

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
    // Indexed with the union key and no cast: a declared name the corpus does
    // not carry fails the build here. The `undefined` arm below is still live,
    // because a caller reaching this API directly can pass a name no type
    // allows, which is what scenario 2 of the guide scenario pins.
    const content: string | undefined = AUTOMOVIE_GUIDE_CONSTANT[props.name];
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
