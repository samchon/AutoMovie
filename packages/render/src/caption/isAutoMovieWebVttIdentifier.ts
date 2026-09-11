/** Whether a string can be preserved verbatim as a WebVTT identifier. */
export const isAutoMovieWebVttIdentifier = (value: string): boolean =>
  /[\r\n]/u.test(value) === false && value.includes("-->") === false;
