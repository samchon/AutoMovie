// Publish ./dist to the gh-pages branch by hand.
//
// `.github/workflows/website.yml` does the same on every push to master; this
// script is the manual route for publishing a build from the current checkout.
// Run `pnpm run deploy` so the build precedes the publish.
const ghpages = require("gh-pages");
const path = require("path");

const root = path.resolve(__dirname, "..");

console.log("[deploy] publishing ./dist to gh-pages...");
ghpages.publish(
  path.join(root, "dist"),
  {
    branch: "gh-pages",
    dotfiles: true,
    // One commit on gh-pages, as the workflow keeps it; a snapshot history of
    // a 20 MB texture set would only bloat the repository.
    history: false,
    message: "Update automovie website",
  },
  (error) => {
    if (error) {
      console.error("[deploy] FAILED:", error);
      process.exit(1);
    }
    console.log("[deploy] done.");
  },
);
