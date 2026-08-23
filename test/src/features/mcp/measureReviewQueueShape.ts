import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  AutoMovieProductionReviewService,
} from "@automovie/mcp";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { renderCompletedFilmFixture } from "../internal/completedFilmFixture";

/**
 * How much of a fresh production's review queue is structural.
 *
 * Not a test. A measurement run by hand when the question is whether a review
 * criterion is doing work a compiler could do, so the answer is a count rather
 * than an impression.
 */
const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-queue-"));
const files = renderCompletedFilmFixture("queue-probe");
for (const [relative, content] of Object.entries(files)) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}
const project = AutoMovieProductionProject.open(root);
const review = new AutoMovieProductionReviewService(project);
const output = new AutoMovieProductionCompiler(project, (status, snapshot) =>
  review.queue(status, snapshot),
).lint({ scope: "review" });

const byKind = new Map<string, number>();
for (const entry of output.reviews.entries) {
  const kind = entry.target.kind;
  byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
}
const byCode = new Map<string, number>();
for (const diagnostic of output.diagnostics)
  byCode.set(diagnostic.code, (byCode.get(diagnostic.code) ?? 0) + 1);

process.stdout.write(
  `${JSON.stringify(
    {
      reviewEntriesByTargetKind: Object.fromEntries(
        [...byKind].sort((a, b) => b[1] - a[1]),
      ),
      diagnosticsByCode: Object.fromEntries(
        [...byCode].sort((a, b) => b[1] - a[1]),
      ),
    },
    null,
    2,
  )}\n`,
);
fs.rmSync(root, { recursive: true, force: true });
