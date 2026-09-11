import type { AutoMovieContentDigest } from "@automovie/interface";

/** Refuse a render plan after source or reviewed authoring bindings change. */
export const assertCurrentRenderSource = (props: {
  expected: AutoMovieContentDigest;
  current: () => AutoMovieContentDigest;
}): void => {
  if (props.current() !== props.expected)
    throw new Error(
      "Render source or authoring changed. Replan before capture or publication.",
    );
};

/** Keep an awaited capture inside one current source and authoring basis. */
export const captureCurrentRenderSource = async <Result>(props: {
  expected: AutoMovieContentDigest;
  current: () => AutoMovieContentDigest;
  capture: () => Promise<Result>;
}): Promise<Result> => {
  assertCurrentRenderSource(props);
  const result = await props.capture();
  assertCurrentRenderSource(props);
  return result;
};
