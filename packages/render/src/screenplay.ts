import {
  IAutoMovieDialogueLine,
  IAutoMovieScript,
  IAutoMovieScriptNode,
} from "@automovie/interface";

/**
 * Serialize an {@link IAutoMovieScript} into the deterministic, human-readable
 * plain-text screenplay: the artifact a person reviews and edits, exported
 * alongside the guide video (D009: dialogue TEXT is authoring data; audio is
 * diffusion's).
 *
 * **Convention** (plain text, fixed indents, no trailing whitespace):
 *
 * - Header: `LOGLINE: …` and `THEME: …`, from the intent root when a tree is
 *   present (the tree is the authored truth), else from the flat script.
 * - Act: a blank-line-separated `ACT, <purpose>` rule.
 * - Scene: the screenplay slug `INT. LOCATION - TIMEOFDAY` (location and time
 *   upper-cased), followed by the optional description line.
 * - Group: the rationale bracketed as `[<rationale>]`.
 * - Beat: the beat's flat name as `BEAT, <name>`, the stage direction prose, each
 *   dialogue line as a 16-space-indented `SPEAKER` line over an
 *   8-space-indented text line (prefixed `[t=…s]` when anchored), and the shot
 *   caption bracketed as `[Shot: …]`.
 *
 * **Tree vs flat.** With `script.tree` the document walks the refinement tree
 * depth-first, children in declaration order (the tree already validated on
 * commit: one intent root, acyclic, beats joined 1:1). Without a tree the
 * fallback renders the header plus each flat beat as `BEAT, <name>` over its
 * summary. Treeless scripts stay exportable. A script with no beats at all
 * throws: there is no screenplay to render, and serializing an empty shell
 * would hide the authoring gap.
 *
 * Same script → same bytes: iteration follows declaration order everywhere and
 * no timestamps or randomness enter the text.
 *
 * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Serializes the authoritative screenplay prose hierarchy without replacing it with a second summary owner.
 * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Preserves authored headings, action, and dialogue in deterministic declaration order.
 * @evidenceExclude requirements/delivery-and-accessibility/README.md#전달과-접근성-요구사항 Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/audio-description-and-alternatives.md#delivery-description-coverage Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/audio-description-and-alternatives.md#delivery-description-freshness Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/audio-description-and-alternatives.md#delivery-description-gaps-priority Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/audio-description-and-alternatives.md#delivery-description-mix Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/audio-description-and-alternatives.md#delivery-description-modes Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/audio-description-and-alternatives.md#delivery-description-refusal Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/audio-description-and-alternatives.md#delivery-other-alternatives Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/audio-description-and-alternatives.md#delivery-sign-language-rendition Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/audio-description-and-alternatives.md#delivery-transcript-navigation Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-audio-downmix Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-audio-mix-versions Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-audio-refusal Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-audio-sample-boundary Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-audio-silence Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-channel-layout Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-loudness-profile Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-coverage Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-presentation-form Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-reading-overlap Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-refusal Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-style-region Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-subtitle-distinction Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-cue-text-language Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md#delivery-container-metadata Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md#delivery-encoding-tool-identity Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md#delivery-media-fact-refusal Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md#delivery-partial-container Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md#delivery-stream-duration-interleave Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md#delivery-stream-identity Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md#delivery-supported-combinations Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/frame-rate-timebase-and-timecode.md#delivery-edit-media-origin Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/frame-rate-timebase-and-timecode.md#delivery-rate-mode Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/frame-rate-timebase-and-timecode.md#delivery-rational-frame-rate Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/frame-rate-timebase-and-timecode.md#delivery-stream-synchronization Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/frame-rate-timebase-and-timecode.md#delivery-time-boundary-count Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/frame-rate-timebase-and-timecode.md#delivery-time-refusal Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/frame-rate-timebase-and-timecode.md#delivery-timecode-profile Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/integrity-provenance-and-authenticity.md#delivery-authenticity-claim-boundary Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/integrity-provenance-and-authenticity.md#delivery-canonical-digest Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/integrity-provenance-and-authenticity.md#delivery-generative-provenance Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/integrity-provenance-and-authenticity.md#delivery-integrity-refusal Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/integrity-provenance-and-authenticity.md#delivery-provenance-disclosure Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/integrity-provenance-and-authenticity.md#delivery-provenance-entities-activities Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/integrity-provenance-and-authenticity.md#delivery-provenance-partial Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/integrity-provenance-and-authenticity.md#delivery-revision-invalidation Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/integrity-provenance-and-authenticity.md#delivery-signature-verification Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/localization-and-language-versions.md#delivery-dub-timing Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/localization-and-language-versions.md#delivery-language-completeness Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/localization-and-language-versions.md#delivery-language-selection Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/localization-and-language-versions.md#delivery-localization-freshness Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/localization-and-language-versions.md#delivery-localization-refusal Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/localization-and-language-versions.md#delivery-original-translation Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/localization-and-language-versions.md#delivery-text-expansion-layout Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/packages-manifests-and-dependencies.md#delivery-archive-expansion Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/packages-manifests-and-dependencies.md#delivery-external-references Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/packages-manifests-and-dependencies.md#delivery-manifest-identity Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/packages-manifests-and-dependencies.md#delivery-package-assembly Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/packages-manifests-and-dependencies.md#delivery-package-partial-recovery Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/packages-manifests-and-dependencies.md#delivery-package-refusal Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/packages-manifests-and-dependencies.md#delivery-safe-relative-paths Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-image-sequences Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-multipart-channels Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-picture-alpha-channels Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-picture-derivatives Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-picture-dimensions-window Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-picture-refusal Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-scene-display-picture Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/publication-and-retention.md#delivery-candidate-published Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/publication-and-retention.md#delivery-concurrent-publication Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/publication-and-retention.md#delivery-publication-atomicity Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/publication-and-retention.md#delivery-publication-preconditions Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/publication-and-retention.md#delivery-publication-refusal Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/publication-and-retention.md#delivery-publication-state-change Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/publication-and-retention.md#delivery-published-verification Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/publication-and-retention.md#delivery-retention-cleanup Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/publication-and-retention.md#delivery-retention-deletion Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/scope-and-profiles.md#delivery-multiple-profiles Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/scope-and-profiles.md#delivery-profile-freshness Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/scope-and-profiles.md#delivery-profile-ownership Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/scope-and-profiles.md#delivery-profile-partial Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/scope-and-profiles.md#delivery-profile-precedence Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/scope-and-profiles.md#delivery-profile-refusal Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/scope-and-profiles.md#delivery-required-optional Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/validation.md#delivery-accessibility-review Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/validation.md#delivery-audiovisual-review Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/validation.md#delivery-cross-artifact-consistency Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/validation.md#delivery-final-status Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/validation.md#delivery-negative-corruption Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/validation.md#delivery-package-closure-validation Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/validation.md#delivery-profile-conformance Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/validation.md#delivery-validation-recovery Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/delivery-and-accessibility/validation.md#delivery-validation-refusal Screenplay text and caption sidecars preserve supplied cues; accessibility policy, localization, presentation, packaging, and publication remain with their owning delivery layer.
 * @evidenceExclude requirements/story/README.md#이야기-저작-요구사항 Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/beats-and-causality.md#story-action-reaction Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/beats-and-causality.md#story-beat-coverage-duplication Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/beats-and-causality.md#story-beat-observation-plan Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/beats-and-causality.md#story-beat-state-change Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/beats-and-causality.md#story-causal-link-types Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/beats-and-causality.md#story-causality-gap-reporting Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/beats-and-causality.md#story-choice-cost-reversal Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/beats-and-causality.md#story-semantic-event-identity Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/beats-and-causality.md#story-setup-payoff Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/coverage-and-acceptance.md#story-acceptance-empty-unsupported Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/coverage-and-acceptance.md#story-acceptance-judgment-measurement Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/coverage-and-acceptance.md#story-acceptance-negative-twin Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/coverage-and-acceptance.md#story-acceptance-result-provenance Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/coverage-and-acceptance.md#story-coverage-roles-duplication Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/coverage-and-acceptance.md#story-falsifiable-acceptance Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/coverage-and-acceptance.md#story-film-level-review Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/coverage-and-acceptance.md#story-final-acceptance Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/coverage-and-acceptance.md#story-orphan-gap Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/coverage-and-acceptance.md#story-scene-event-acceptance Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/coverage-and-acceptance.md#story-sequence-acceptance Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/dialogue-language-and-silence.md#story-dialogue-action-interaction Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/dialogue-language-and-silence.md#story-dialogue-continuity Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/dialogue-language-and-silence.md#story-dialogue-quotation-provenance Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/dialogue-language-and-silence.md#story-dialogue-text-intent Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/dialogue-language-and-silence.md#story-dialogue-timing-intent Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/dialogue-language-and-silence.md#story-dialogue-variants-approval Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/dialogue-language-and-silence.md#story-dialogue-voice-text-separation Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/dialogue-language-and-silence.md#story-multilingual-dialogue Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/dialogue-language-and-silence.md#story-silence-nonverbal Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/dramatic-characters-goals-and-relations.md#story-character-actor-binding Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/dramatic-characters-goals-and-relations.md#story-character-agency-viewpoint Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/dramatic-characters-goals-and-relations.md#story-character-arc-milestones Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/dramatic-characters-goals-and-relations.md#story-character-completeness Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/dramatic-characters-goals-and-relations.md#story-character-goals-obstacles Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/dramatic-characters-goals-and-relations.md#story-character-groups-members Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/dramatic-characters-goals-and-relations.md#story-character-information-provenance Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/dramatic-characters-goals-and-relations.md#story-character-presence-absence Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/dramatic-characters-goals-and-relations.md#story-character-relations Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/logline-and-premise.md#story-logline-alternatives Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/logline-and-premise.md#story-logline-opening-ending-relation Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/logline-and-premise.md#story-logline-overclaim-refusal Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/logline-and-premise.md#story-logline-promises-exclusions Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/logline-and-premise.md#story-logline-scope-bound Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/logline-and-premise.md#story-observable-core Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/logline-and-premise.md#story-premise-question Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/logline-and-premise.md#story-premise-review-status Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/revision-and-change-impact.md#story-deletion-invalidation Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/revision-and-change-impact.md#story-revision-alternatives Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/revision-and-change-impact.md#story-revision-approval-status Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/revision-and-change-impact.md#story-revision-conflict-authority Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/revision-and-change-impact.md#story-revision-freshness Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/revision-and-change-impact.md#story-revision-lineage Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/revision-and-change-impact.md#story-revision-reason Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/revision-and-change-impact.md#story-revision-rollback-reproduction Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/revision-and-change-impact.md#story-revision-soft-lock Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/revision-and-change-impact.md#story-revision-stable-identity Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/scenes-and-observable-action.md#story-scene-boundary-continuity Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/scenes-and-observable-action.md#story-scene-entry-exit-state Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/scenes-and-observable-action.md#story-scene-local-arc Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/scenes-and-observable-action.md#story-scene-number-soft-lock Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/scenes-and-observable-action.md#story-scene-observability Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/scenes-and-observable-action.md#story-scene-participant-modes Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/scenes-and-observable-action.md#story-scene-place-time Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/scenes-and-observable-action.md#story-scene-shot-separation Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/scenes-and-observable-action.md#story-scene-subject-dependencies Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/scenes-and-observable-action.md#story-unfilmable-scene-refusal Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/scope-and-source-of-truth.md#story-capability-content-boundary Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/scope-and-source-of-truth.md#story-fact-fiction-provenance Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/scope-and-source-of-truth.md#story-open-form Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/scope-and-source-of-truth.md#story-production-distinction Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/scope-and-source-of-truth.md#story-progressive-refinement Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/scope-and-source-of-truth.md#story-source-authority Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/scope-and-source-of-truth.md#story-stable-unit-identity Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/scope-and-source-of-truth.md#story-unknown-preservation Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/story-clock-and-state.md#story-absolute-relative-time Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/story-clock-and-state.md#story-duration-deadline-recurrence Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/story-clock-and-state.md#story-presentation-chronology Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/story-clock-and-state.md#story-simultaneous-events Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/story-clock-and-state.md#story-state-ledger Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/story-clock-and-state.md#story-state-transition-causes Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/story-clock-and-state.md#story-time-contradictions Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/story-clock-and-state.md#story-time-ellipsis-compression Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/story-clock-and-state.md#story-time-state-review-scope Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/themes-motifs-and-subtext.md#story-motif-absence-restraint Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/themes-motifs-and-subtext.md#story-motif-variation Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/themes-motifs-and-subtext.md#story-subtext-performance Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/themes-motifs-and-subtext.md#story-symbol-source-context Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/themes-motifs-and-subtext.md#story-theme-acceptance-boundary Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/themes-motifs-and-subtext.md#story-theme-change-impact Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/themes-motifs-and-subtext.md#story-theme-coverage Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/themes-motifs-and-subtext.md#story-theme-interpretation-boundary Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/themes-motifs-and-subtext.md#story-theme-progression-counterpoint Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/treatment-and-sequences.md#story-parallel-intercut-lines Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/treatment-and-sequences.md#story-sequence-alternatives-order Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/treatment-and-sequences.md#story-sequence-causality Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/treatment-and-sequences.md#story-sequence-identity Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/treatment-and-sequences.md#story-sequence-scale-weight Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/treatment-and-sequences.md#story-sequence-state-handoff Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/treatment-and-sequences.md#story-treatment-completeness Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude requirements/story/treatment-and-sequences.md#story-treatment-coverage Screenplay text and caption sidecars serialize supplied story structure and prose; story authority, causality, and narrative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/README.md#narrative-intent-readme Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/alternatives-revisions-and-compatibility.md#narrative-intent-alternative-selection-approval Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/alternatives-revisions-and-compatibility.md#narrative-intent-canonical-comparison-revalidation Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/alternatives-revisions-and-compatibility.md#narrative-intent-compatibility-invariants Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/alternatives-revisions-and-compatibility.md#narrative-intent-revision-conflict-rollback Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/alternatives-revisions-and-compatibility.md#narrative-intent-revision-deletion-soft-lock Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/alternatives-revisions-and-compatibility.md#narrative-intent-revision-reason-status Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/budgets-continuity-and-deliverables.md#narrative-intent-budget-aggregate-variant Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/budgets-continuity-and-deliverables.md#narrative-intent-budget-feasibility-verdict Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/budgets-continuity-and-deliverables.md#narrative-intent-budget-measurement-worst-case Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/budgets-continuity-and-deliverables.md#narrative-intent-budget-story-representation Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/budgets-continuity-and-deliverables.md#narrative-intent-deliverable-authority-gaps Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/budgets-continuity-and-deliverables.md#narrative-intent-deliverable-provenance-handoff Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/budgets-continuity-and-deliverables.md#narrative-intent-design-change-impact-comparison Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/characters-relations-and-state.md#narrative-intent-character-agency-viewpoint Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/characters-relations-and-state.md#narrative-intent-character-arc-milestones Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/characters-relations-and-state.md#narrative-intent-character-goal-state Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/characters-relations-and-state.md#narrative-intent-character-group-membership Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/characters-relations-and-state.md#narrative-intent-character-presence-state Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/characters-relations-and-state.md#narrative-intent-character-state-completeness Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/characters-relations-and-state.md#narrative-intent-scene-entry-exit-state Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-design-authority-boundary Screenplay rendering preserves supplied story prose; it neither owns nor revises the production-design snapshot, whose authority remains with the authoring and design layer.
 * @evidenceExclude specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-design-capability-boundary Screenplay rendering serializes production-authored prose without shipping subject or style catalogues or deciding the engine's general capability boundary.
 * @evidenceExclude specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-design-reference-realization Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-design-scope-completeness Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-design-status-unknown Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-graphics-style-exceptions Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-story-design-ownership Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-design-graph-ownership Screenplay text serializes a supplied story hierarchy; it does not construct a tracked production-design graph or bind its slices to source revisions.
 * @evidenceExclude specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-visual-hierarchy-viewing Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-visual-language-acceptance Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/design-authority-and-visual-language.md#narrative-intent-visual-language-variation Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-dialogue-continuity Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-dialogue-quotation-rights Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-dialogue-voice-text-boundary Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-motif-variation-coverage Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-silence-nonverbal-contract Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-subtext-theme-progression Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-theme-source-acceptance Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-action-reaction-knowledge Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-beat-observation-boundary Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-causal-failure Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-chronology-presentation Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-semantic-event-occurrence Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-setup-payoff-roles Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-story-synchronization Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-representation Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-blocking-pass-invariants Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-fidelity-freshness-acceptance Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-fidelity-tier-transition Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-authority-replacement Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-manifest-closure Screenplay serialization does not inventory adopted reference bytes, licenses, sidecars, processing lineage, or downstream consumer relations.
 * @evidenceExclude specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-manifest-review Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-rights-boundary Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-repaint-structural-boundary Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-unsupported-fidelity-continuity Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/locations-subjects-and-assets.md#narrative-intent-asset-plan-lifecycle Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/locations-subjects-and-assets.md#narrative-intent-location-anchor-traversal Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/locations-subjects-and-assets.md#narrative-intent-location-review Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/locations-subjects-and-assets.md#narrative-intent-location-scope-context Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/locations-subjects-and-assets.md#narrative-intent-location-time-build-scope Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/locations-subjects-and-assets.md#narrative-intent-subject-capability-ledger Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/locations-subjects-and-assets.md#narrative-intent-subject-prototype-role Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/locations-subjects-and-assets.md#narrative-intent-subject-source-strategy Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/scale-palette-material-and-state.md#narrative-intent-material-color-lighting-boundary Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/scale-palette-material-and-state.md#narrative-intent-material-layer-representation Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/scale-palette-material-and-state.md#narrative-intent-material-provenance-substitution Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/scale-palette-material-and-state.md#narrative-intent-material-state-continuity Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/scale-palette-material-and-state.md#narrative-intent-palette-role-distinction Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/scale-palette-material-and-state.md#narrative-intent-repeated-scale-proportion Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/scale-palette-material-and-state.md#narrative-intent-scale-clearance-conflict Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/scale-palette-material-and-state.md#narrative-intent-scale-tier-evidence Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/scale-palette-material-and-state.md#narrative-intent-silhouette-detail-contract Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/scene-coverage-and-acceptance.md#narrative-intent-coverage-gap-status Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/scene-coverage-and-acceptance.md#narrative-intent-final-story-acceptance Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/scene-coverage-and-acceptance.md#narrative-intent-scene-dependency-refusal Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/scene-coverage-and-acceptance.md#narrative-intent-story-criterion-cases Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/scene-coverage-and-acceptance.md#narrative-intent-story-human-machine-verdict Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/scene-coverage-and-acceptance.md#narrative-intent-story-review-surfaces Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/scene-coverage-and-acceptance.md#narrative-intent-story-sync-criterion Screenplay serialization does not compare an authored cross-shot event criterion with realized event times or a declared tolerance.
 * @evidenceExclude specifications/narrative-and-intent/scene-coverage-and-acceptance.md#narrative-intent-story-verdict-provenance Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-logline-premise-input Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-logline-promise-closure Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-sequence-refinement Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-story-fact-authority Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-story-unit-identity Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @evidenceExclude specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-story-unknown-review-state Screenplay text serializes supplied hierarchy and prose; narrative authority, intent formation, causality, and creative choice remain with the authoring layer.
 * @author Samchon
 * @evidenceExclude requirements/story/delivery-index.md#story-delivery-index The render package schedules frames and plans captions from compiled artifacts; the production language module and the delivery index are generated-project authoring contracts owned by the evidence and template packages.
 * @evidenceExclude specifications/narrative-and-intent/delivery-index.md#narrative-intent-delivery-index The render package schedules frames and plans captions from compiled artifacts; the production language module and the delivery index are generated-project authoring contracts owned by the evidence and template packages.
 */
export const renderScreenplay = (script: IAutoMovieScript): string => {
  if (script.beats.length === 0)
    throw new Error("script has no beats: there is no screenplay to render");

  const tree = script.tree ?? null;
  if (tree === null) return renderFlat(script);
  return renderTree(script, tree);
};

const renderFlat = (script: IAutoMovieScript): string => {
  const lines: string[] = [
    `LOGLINE: ${script.logline}`,
    `THEME: ${script.theme}`,
  ];
  for (const beat of script.beats) {
    lines.push("", `BEAT, ${beat.name}`, beat.summary);
  }
  return `${lines.join("\n")}\n`;
};

const renderTree = (
  script: IAutoMovieScript,
  tree: IAutoMovieScriptNode[],
): string => {
  const beatNames = new Map(script.beats.map((beat) => [beat.id, beat.name]));
  const children = new Map<string | null, IAutoMovieScriptNode[]>();
  for (const node of tree) {
    const list = children.get(node.parent) ?? [];
    list.push(node);
    children.set(node.parent, list);
  }

  const lines: string[] = [];
  const walk = (node: IAutoMovieScriptNode): void => {
    switch (node.kind) {
      case "intent":
        lines.push(
          `LOGLINE: ${node.payload.logline}`,
          `THEME: ${node.payload.theme}`,
        );
        break;
      case "act":
        lines.push("", `ACT, ${node.payload.purpose}`);
        break;
      case "scene": {
        const slug = sceneSlug(node.payload);
        lines.push("", slug);
        if (node.payload.description !== null)
          lines.push(node.payload.description);
        break;
      }
      case "group":
        lines.push("", `[${node.payload.rationale}]`);
        break;
      case "beat": {
        const name = beatNames.get(node.payload.beat) ?? node.payload.beat;
        lines.push("", `BEAT, ${name}`, node.payload.direction);
        for (const line of node.payload.dialogue)
          lines.push(...dialogueLines(line));
        if (node.payload.caption !== null)
          lines.push(`[Shot: ${node.payload.caption}]`);
        break;
      }
    }
    for (const child of children.get(node.id) ?? []) walk(child);
  };

  for (const root of children.get(null) ?? []) walk(root);
  return `${lines.join("\n")}\n`;
};

/** `INT. CASTLE COURTYARD - DAWN`: the slug, location and time upper-cased. */
const sceneSlug = (payload: {
  interiorExterior: "INT" | "EXT";
  location: string;
  timeOfDay: string;
}): string =>
  `${payload.interiorExterior}. ${payload.location.toUpperCase()} - ${payload.timeOfDay.toUpperCase()}`;

const dialogueLines = (line: IAutoMovieDialogueLine): string[] => {
  const anchor = line.anchor === null ? "" : `[t=${line.anchor}s] `;
  return [
    `${" ".repeat(16)}${line.speaker.toUpperCase()}`,
    `${" ".repeat(8)}${anchor}${line.text}`,
  ];
};

/**
 * Per-beat caption + enclosing scene slug from the screenplay tree: the join
 * table {@link planCaptionSidecar} consults per span. The tree walks depth-first
 * from the intent root (the same walk the screenplay document renders with),
 * carrying the nearest scene slug down; a treeless script (null or the legacy
 * absent field), or a tree with no root to walk, yields an empty map, so every
 * span captions `null`. A node unreachable from the root is never visited:
 * commit validation owns that rejection, the join is total.
 *
 * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-cue-freshness Joins each caption and slug to its authored beat identity without creating replacement text.
 * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-cues Exposes the authored text needed to build a frame-aligned selectable cue sidecar.
 * @author Samchon
 */
export const beatCaptions = (
  script: IAutoMovieScript,
): Map<string, { caption: string | null; slug: string | null }> => {
  const map = new Map<
    string,
    { caption: string | null; slug: string | null }
  >();
  const tree = script.tree;
  if (tree === undefined) return map;
  if (tree === null) return map;

  const children = new Map<string | null, IAutoMovieScriptNode[]>();
  for (const node of tree) {
    const list = children.get(node.parent) ?? [];
    list.push(node);
    children.set(node.parent, list);
  }

  const walk = (node: IAutoMovieScriptNode, slug: string | null): void => {
    let current = slug;
    if (node.kind === "scene") current = sceneSlug(node.payload);
    if (node.kind === "beat")
      map.set(node.payload.beat, {
        caption: node.payload.caption,
        slug: current,
      });
    for (const child of children.get(node.id) ?? []) walk(child, current);
  };
  for (const root of children.get(null) ?? []) walk(root, null);
  return map;
};
