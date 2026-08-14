/**
 * RFC 6901 pointer resolution for cases that quote a prepared design selector.
 *
 * The review gate hands a reviewer a list of pointers and then rechecks that
 * each cited `exactValue` still equals what the pointer resolves to, so a case
 * that builds a worksheet has to resolve pointers the same way the gate does.
 * Reading the value back out of the service instead would make the assertion
 * circular: the worksheet would agree with the gate no matter what either one
 * resolved.
 *
 * A missing key is reported rather than answered with `undefined`, because a
 * pointer that addresses nothing and a pointer that addresses a null are the
 * difference between an invented selector and a legitimate one.
 */
export const resolveJsonPointer = (
  value: unknown,
  pointer: string,
): { found: boolean; value: unknown } => {
  if (pointer === "") return { found: true, value };
  if (pointer.startsWith("/") === false)
    return { found: false, value: undefined };
  let current = value;
  for (const raw of pointer.slice(1).split("/")) {
    const key = raw.replaceAll("~1", "/").replaceAll("~0", "~");
    if (
      typeof current === "object" &&
      current !== null &&
      Object.prototype.hasOwnProperty.call(current, key)
    )
      current = (current as Record<string, unknown>)[key];
    else return { found: false, value: undefined };
  }
  return { found: true, value: current };
};
