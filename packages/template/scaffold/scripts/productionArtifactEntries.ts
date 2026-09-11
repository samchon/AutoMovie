import { isAutoMovieProductionArtifactEntry } from "@automovie/production";

/**
 * Whether one production output root already holds state a namespace owns.
 *
 * The project store owns which entries count. Asking it rather than repeating
 * the rule here is what keeps this resolver and the store's legacy layout
 * migration from disagreeing about the one document the scaffold ships.
 */
export const hasProductionArtifactEntries = (props: {
  directory: "productions" | "generated" | "renders";
  entries: readonly { name: string; isFile: boolean }[];
}): boolean =>
  props.entries.some((entry) =>
    isAutoMovieProductionArtifactEntry({
      directory: props.directory,
      name: entry.name,
      isFile: entry.isFile,
    }),
  );
