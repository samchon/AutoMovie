export * from "./blockBeat";
export * from "./cameraMove";
export * from "./cameraClearance";
export {
  compileCameraClearanceReports,
  type IAutoMovieCameraClearanceRuntime,
} from "./cameraClearancePerformance";
export * from "./cameraDepthPrecision";
export * from "./compileAttach";
export * from "./compileLaunch";
export * from "./cutSequence";
// One symbol, not the module: `foldRoot` is the engine's canonical answer to
// "where in the world is this actor", which an offline consumer needs to ask
// (the pose-keypoint sidecar samples the atmosphere there). The rest of
// `beatEndSim` is beat-end simulation internals with no caller outside it.
export { foldRoot } from "./beatEndSim";
export * from "./defineShot";
export * from "./filmGrammar";
export * from "./forgeCast";
export * from "./forgeProp";
export * from "./propPlacement";
export * from "./scriptGraph";
export * from "./performShot";
export * from "./playback";
export * from "./readSlateContext";
export * from "./realizeShotContract";
export * from "./cameraProjection";
export * from "./resolvePoseKeypoints";
export * from "./reviewShot";
export * from "./reviewVisualRead";
export * from "./resolveBeatEnd";
export * from "./stageScene";
export * from "./subjectExtent";
export * from "./storyClock";
export * from "./productionLighting";
export * from "./productionTimebase";
