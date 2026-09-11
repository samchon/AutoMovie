/**
 * A dependency's import spelling is distinct from its manifest identity.
 *
 * @author Samchon
 */
export interface ICapturePackageDependency {
  entry: string;
  package: string;
  specifier: string;
}

/** Preserve the declared npm alias while sealing the package it names. */
export const capturePackageDependency = (props: {
  optionalVersion?: unknown;
  specifier: string;
  version: unknown;
}): Omit<ICapturePackageDependency, "entry"> & { optional: boolean } => {
  const optional = typeof props.optionalVersion === "string";
  const version = optional ? props.optionalVersion : props.version;
  let packageName = props.specifier;
  if (typeof version === "string" && version.startsWith("npm:")) {
    const alias = /^npm:((?:@[^/@\s]+\/)?[^/@\s]+)(?:@.+)?$/u.exec(version);
    if (alias === null)
      throw new Error(
        `Installed capture dependency "${props.specifier}" has an invalid npm alias.`,
      );
    packageName = alias[1]!;
  }
  return {
    optional,
    package: packageName,
    specifier: props.specifier,
  };
};

/** Re-resolution must retain both the entry and the sealed canonical package. */
export const assertCapturePackageDependencyCurrent = (props: {
  dependency: ICapturePackageDependency;
  resolved: string;
  packages: readonly { entry: string; snapshot: { package: string } }[];
}): void => {
  if (
    props.resolved !== props.dependency.entry ||
    props.packages.some(
      (candidate) =>
        candidate.entry === props.resolved &&
        candidate.snapshot.package === props.dependency.package,
    ) === false
  )
    throw new Error(
      `Installed capture dependency "${props.dependency.specifier}" changed its resolved package generation. Restart with the current installation.`,
    );
};
