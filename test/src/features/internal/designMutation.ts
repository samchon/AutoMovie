import { IAutoMovieModelRecipe } from "@automovie/interface";

/**
 * One contract-valid recipe edit that is guaranteed to change the design bytes.
 *
 * Review cases need a target that legitimately moved, not a target that broke:
 * a fingerprint is supposed to follow authored change, so proving it does needs
 * an edit the compiler still accepts. The palette entry is the smallest such
 * change, and swapping between two fixed colours makes the new bytes differ
 * from the old ones whichever colour the fixture starts from.
 *
 * The current colour is read rather than assumed, and an absent or unexpected
 * palette entry throws here instead of silently producing an edit that changes
 * nothing -- an arrangement that quietly fails would leave the case asserting
 * that an unchanged target has an unchanged fingerprint.
 */
export const recolouredModelRecipe = (
  recipe: IAutoMovieModelRecipe,
  entry = "body",
): IAutoMovieModelRecipe => {
  const current = recipe.palette[entry];
  if (
    typeof current !== "string" ||
    /^#[0-9a-fA-F]{6}$/.test(current) === false
  )
    throw new Error(
      `Model recipe "${recipe.id}" has no six-digit hex palette entry "${entry}" to repaint.`,
    );
  return {
    ...recipe,
    palette: {
      ...recipe.palette,
      [entry]: current.toLowerCase() === "#3355aa" ? "#aa5533" : "#3355aa",
    },
  };
};
