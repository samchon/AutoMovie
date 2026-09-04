import {
  type IAutoMovieLocalProcessOwner,
  isAutoMovieLocalProcessOwner,
} from "@automovie/production";

/** Encode one complete process owner as a path-safe temporary-record suffix. */
export const renderProcessOwnerSuffix = (
  owner: IAutoMovieLocalProcessOwner,
): string => {
  if (isAutoMovieLocalProcessOwner(owner) === false)
    throw new Error("Render process owner is invalid.");
  return `${owner.pid}.${owner.generation}.${Buffer.from(owner.host, "utf8").toString("base64url")}`;
};

/** Decode one complete process owner suffix without querying its PID. */
export const parseRenderProcessOwnerSuffix = (
  value: string,
): IAutoMovieLocalProcessOwner | null => {
  const parts = value.split(".");
  if (parts.length !== 3 || /^[1-9]\d*$/u.test(parts[0]) === false) return null;
  const host = Buffer.from(parts[2], "base64url").toString("utf8");
  if (Buffer.from(host, "utf8").toString("base64url") !== parts[2]) return null;
  const owner = {
    host,
    pid: Number(parts[0]),
    generation: parts[1],
  };
  return isAutoMovieLocalProcessOwner(owner) ? owner : null;
};
