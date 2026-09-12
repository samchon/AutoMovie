import type { AutoMovieProductionPngRole } from "./AutoMovieProductionPngRole";

/** Exact role profile that the current deterministic PNG writers support. */
export interface IAutoMovieProductionPngProfile {
  /** Profile schema version. */
  version: 1;
  /** Renderer-owned role the PNG is written for. */
  role: AutoMovieProductionPngRole;
  /** Stored pixel width. */
  width: number;
  /** Stored pixel height. */
  height: number;
  /** Bits per channel every writer emits. */
  bitDepth: 8;
  /** Channel layout every writer emits. */
  color: "rgba";
  /** Alpha convention of the stored pixels. */
  alpha: "straight";
  /** Interlace method; the writers never interlace. */
  interlace: "none";
  /** Color space the pixels are display-referred in. */
  colorSpace: "srgb";
  /** Pixel aspect; the writers emit square pixels only. */
  pixelAspect: "square";
  /** Stored orientation; the writers never rotate. */
  orientation: "upright";
}
