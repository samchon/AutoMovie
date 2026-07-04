import { AutoMovieArkitChannel } from "./AutoMovieArkitChannel";

/**
 * One ARKit blendshape channel set to a weight.
 *
 * The pair of a closed channel name and a `[0, 1]` weight is the fine-grained
 * facial control atom. A list of these is a fully-specified facial expression
 * at ARKit resolution — what Audio2Face streams and what an LLM can emit
 * directly because the space is named, bounded, and only 52-wide.
 *
 * @author Samchon
 */
export interface IAutoMovieBlendshapeChannel {
  /** Which ARKit channel — from the closed 52-name menu. */
  channel: AutoMovieArkitChannel;

  /** Activation weight, `[0, 1]`. `0` = inactive, `1` = full. */
  weight: number;
}
