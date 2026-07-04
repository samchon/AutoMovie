/**
 * A face template in render-ready flat-array form ??the geometry side of the
 * face editor that an {@link IautomovieFace} morphs.
 *
 * `positions` is the template's resting face (the canonical neutral, or a
 * character with its `identity` morph already baked in), and `targets` maps
 * each morph-target name to per-vertex xyz deltas of the same length. This
 * matches what a glTF face asset carries (POSITION plus named morph targets),
 * so `ingest` fills it straight from the file and the engine's `morphFace`
 * consumes it without further shaping.
 *
 * @author Samchon
 */
export interface IautomovieFaceTemplate {
  /** Resting vertex positions, xyz triples. */
  positions: number[];

  /** Morph-target deltas by parameter name, each `positions.length` long. */
  targets: Record<string, number[]>;
}
