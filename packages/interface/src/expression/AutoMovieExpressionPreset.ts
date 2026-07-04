/**
 * The closed set of **VRM 1.0 expression presets** ??high-level named emotions
 * and visemes.
 *
 * Where {@link automovieArkitChannel} is the fine-grained 52-channel control,
 * presets are the _coarse, semantic_ control surface: a single name an LLM can
 * pick to convey an emotion or a mouth shape, which the runtime expands into
 * the underlying blendshapes. Presets retarget across every VRM avatar
 * generically (the avatar author defines how each preset deforms its own mesh),
 * making them the most portable and most LLM-reliable expression handle.
 *
 * The five `aa`/`ih`/`ou`/`ee`/`oh` visemes drive lip-sync; the emotion set
 * drives mood; `blink` and the look directions drive eyes.
 *
 * Reference: VRM 1.0 expressions (https://vrm.dev/en/vrm/vrm_features/).
 *
 * @author Samchon
 */
export type automovieExpressionPreset =
  // ?? emotion ??
  | "neutral"
  | "happy"
  | "angry"
  | "sad"
  | "relaxed"
  | "surprised"
  // ?? lip-sync visemes ??
  | "aa"
  | "ih"
  | "ou"
  | "ee"
  | "oh"
  // ?? eyes ??
  | "blink"
  | "blinkLeft"
  | "blinkRight"
  | "lookUp"
  | "lookDown"
  | "lookLeft"
  | "lookRight";
