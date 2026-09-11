/**
 * One process-wide graphics request, recorded beside the observed renderer.
 * Browser defaults may select hardware or software; the observed device is
 * authoritative when a review requires a real GPU.
 *
 * @author Samchon
 */
export interface ICaptureGraphicsBackend {
  args: string[];
  requestedBackend: "angle:swiftshader" | "browser-default";
}

/** Keep software capture explicit while permitting the host's default GPU path. */
export const readCaptureGraphicsBackend = (
  environment: Readonly<Record<string, string | undefined>>,
): ICaptureGraphicsBackend => {
  const selected = environment.AUTOMOVIE_CAPTURE_GRAPHICS_BACKEND;
  if (selected === undefined || selected === "" || selected === "swiftshader")
    return {
      args: ["--use-angle=swiftshader"],
      requestedBackend: "angle:swiftshader",
    };
  if (selected === "default")
    return { args: [], requestedBackend: "browser-default" };
  throw new Error(
    'AUTOMOVIE_CAPTURE_GRAPHICS_BACKEND must be "swiftshader" or "default".',
  );
};
