/** Typed entry points for pure inspection logic, separate from model construction. */
export declare const portraitWebModes: readonly ["colour", "clay", "wireframe"];
export declare function resetPortraitWebSubject(subject: {
  matrixAutoUpdate: boolean;
  matrix: { identity(): unknown };
  updateMatrixWorld(force: boolean): unknown;
}): void;
export declare function verifyPortraitWebBasis(
  expected: Record<string, string>,
  actual: Record<string, string>,
): void;
export declare function portraitWebCamera(
  target: readonly number[],
  distance: number,
  yaw: number,
  pitch: number,
): number[];
export declare function portraitWebFocusIds(
  ids: readonly string[],
  focus: string,
): string[];
export declare function portraitWebHardwareRenderer(renderer: string): boolean;
export declare function portraitWebCaptureLabel(label: string): string;
export declare function portraitWebClip(
  min: readonly number[],
  max: readonly number[],
  eye: readonly number[],
  forward: readonly number[],
): { near: number; far: number };
export declare function createPortraitWebBuildGate(): {
  request: () => void;
  start: () => boolean;
  finish: () => boolean;
};
export declare function portraitWebReferenceFrame(profile: {
  measurement: {
    rotation: readonly number[];
    origin: readonly number[];
    millimetersPerPixel: number;
  };
  reference: { crop: { x: number; y: number; size: number } };
}): { target: number[]; position: number[]; span: number; matrix: number[] };
