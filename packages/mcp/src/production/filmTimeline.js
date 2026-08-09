import typia from "typia";
import { digestAutoMovieBytes } from "./contentIdentity";
/**
 * Select only review frames present in one edit segment.
 *
 * A segment whose trim excludes every authored frame receives one deterministic
 * beauty fallback at source-in, so render and film review cannot deadlock.
 */
export const selectAutoMovieFilmReviewFrames = (segment, shot, fps) => {
    const selected = shot.reviewFrames.flatMap((frame) => {
        const index = Math.round(frame.time * fps);
        return index < segment.sourceInFrame || index >= segment.sourceOutFrame
            ? []
            : [{ ...frame, index }];
    });
    return selected.length !== 0
        ? selected
        : [
            {
                id: "film-segment-entry",
                time: segment.sourceInFrame / fps,
                index: segment.sourceInFrame,
                passes: ["beauty"],
            },
        ];
};
/** Validate manifest ownership, bytes, schema and compile identity together. */
export const parseAutoMovieFilmTimeline = (artifact) => {
    const entry = artifact.manifest?.files.find((file) => file.path === "film-timeline.json");
    if (artifact.manifest?.inputFingerprint !== artifact.fingerprint ||
        entry === undefined)
        throw new Error("Canonical film timeline is missing or changed after compilation. Run the scaffold source compile command.");
    const bytes = artifact.read(entry.path);
    if (digestAutoMovieBytes(bytes) !== entry.digest)
        throw new Error("Canonical film timeline bytes differ from the generated manifest. Run the scaffold source compile command.");
    const validation = typia.validateEquals(JSON.parse(Buffer.from(bytes).toString("utf8")));
    if (validation.success === false ||
        validation.data.inputFingerprint !== artifact.fingerprint)
        throw new Error("Canonical film timeline is invalid or stale. Run the scaffold source compile command.");
    return validation.data;
};
/** Read the canonical film timeline from one production project. */
export const readAutoMovieFilmTimeline = (project, fingerprint) => parseAutoMovieFilmTimeline({
    manifest: project.generatedManifest(),
    fingerprint,
    read: (file) => project.readGeneratedFile(file),
});
//# sourceMappingURL=filmTimeline.js.map