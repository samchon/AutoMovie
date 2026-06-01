import { IMoticaBlendshapeChannel } from "./IMoticaBlendshapeChannel";
import { MoticaExpressionPreset } from "./MoticaExpressionPreset";

/**
 * A facial expression at one instant — coarse preset intent plus optional
 * fine-grained ARKit overrides.
 *
 * Motica offers two registration levels so the model can work at whatever
 * resolution the task needs:
 *
 * - `preset` + `intensity` — the **coarse, most reliable** handle. "Look happy at
 *   0.8." Portable across every VRM avatar.
 * - `blendshapes` — **fine-grained** ARKit channel overrides for precise lip
 *   shapes, asymmetric expressions, or audio-driven lip-sync, layered on top of
 *   the preset. `null` when the preset alone is enough.
 *
 * This split keeps the common case tiny (one preset + one number) while still
 * allowing the full 52-channel vector when needed — and both are validated the
 * same way (closed names, `[0, 1]` weights).
 *
 * @author Samchon
 */
export interface IMoticaExpression {
  /** Coarse emotion / viseme intent. */
  preset: MoticaExpressionPreset;

  /** How strongly to apply `preset`, `[0, 1]`. */
  intensity: number;

  /**
   * Optional fine-grained ARKit channel overrides layered on top of `preset`.
   * `null` when the preset alone suffices. Each channel should appear at most
   * once.
   */
  blendshapes: IMoticaBlendshapeChannel[] | null;
}
