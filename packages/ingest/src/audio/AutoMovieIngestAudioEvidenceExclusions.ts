/**
 * The audio contract units this package's media input surface does not answer for.
 *
 * The audio decode hosts name their contract documents one by one, so every
 * section in those documents becomes an obligation for this package. The units
 * below belong to mixing, scheduling, dialogue, provenance recording, and
 * delivery verification, each of which lives outside an input decoder. Each line
 * names the owner that does answer, so a reader can follow the unit rather than
 * only see that it was excluded here.
 *
 * @evidenceExclude requirements/sound/sources-and-external-assets.md#sound-source-immutable-adoption Adoption receipts and source revisions are recorded by the production source store; decoding reads bytes it is handed and mints no identity.
 * @evidenceExclude requirements/sound/sources-and-external-assets.md#sound-source-choice Which source a cue adopts is an authoring decision in the production design; the decoder is handed one asset and never selects between candidates.
 * @evidenceExclude requirements/sound/sources-and-external-assets.md#sound-source-secret-remote-boundary Credentials and remote fetches belong to the host acquisition path; this decoder takes resident bytes and opens no connection.
 * @evidenceExclude requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-audio-mix-versions Mix versioning is the engine mixer's and the production deliverable ledger's; a decoded source buffer is not a mix.
 * @evidenceExclude requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-loudness-profile Loudness measurement and normalization targets belong to the mix and delivery profile checks, not to source decoding.
 * @evidenceExclude requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-audio-sample-boundary Presentation trims and tail handling are performed by the render Node entry's audio trim, which consumes decoded samples.
 * @evidenceExclude requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-audio-silence Substituting or reporting missing sound is the sound plan's judgment; an unsupported or damaged asset is refused here rather than silenced.
 * @evidenceExclude requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-audio-refusal Delivery-stage refusal of a finished audio stream is the production delivery verifier's; this host refuses input bytes, not a deliverable.
 * @evidenceExclude requirements/evidence-and-provenance/generation-transformation-and-derivation.md#provenance-generated-output-record Generated-output records are written by the production receipt writers; decoding produces no artifact to record.
 * @evidenceExclude requirements/evidence-and-provenance/generation-transformation-and-derivation.md#provenance-nondeterministic-generation No generator, seed, or model is invoked; the decode is a pure function of the input bytes and the requested rate.
 * @evidenceExclude requirements/evidence-and-provenance/generation-transformation-and-derivation.md#provenance-selection-and-composition Selecting and composing sources is the sound plan's and the mixer's; this host transforms exactly one asset.
 * @evidenceExclude requirements/evidence-and-provenance/generation-transformation-and-derivation.md#provenance-derivation-impact Tracing which deliverables a derivation invalidates belongs to the production plan and receipt currentness checks.
 * @evidenceExclude specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-source-choice-provider-and-secret-boundary Provider requests, receipts, and secrets are the acquisition layer's; the decoder consumes provider-neutral bytes already adopted.
 * @evidenceExclude specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-cue-kind-and-event-timing One-shot and sustained cue semantics and their event timing are planned by the production sound plan and realized by the engine mixer.
 * @evidenceExclude specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-cue-sample-boundary-and-arrival Cue arrival against the render clock is computed where cues are scheduled; decoding reports frame counts without placing them in time.
 * @evidenceExclude specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-cue-failure-contract Cue-level failure is raised by the scheduler that owns the cue; this host's failures name the asset and its byte-level defect.
 * @evidenceExclude specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-voice-consistency-and-phoneme-state Voice identity and phoneme state belong to the dialogue cache and the TTS receipts, which are produced before any asset reaches this decoder.
 * @evidenceExclude specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-lipsync-join-and-seek Lip-sync joins and seeks are performed by the dialogue runtime against planned timing, not by source decoding.
 * @evidenceExclude specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#dialogue-failure-contract Dialogue failure reporting is the dialogue cache inspector's; an undecodable dialogue asset fails here as an input refusal.
 * @evidenceExclude specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#foley-variation-layering-and-bound Foley variation, layering, and procedural bounds are the effects planner's; this host returns one buffer per asset.
 * @evidenceExclude specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#foley-claim-and-failure-boundary What a foley claim may assert is judged where foley is authored and verified, not where its bytes are decoded.
 */
export const AUTOMOVIE_INGEST_AUDIO_EVIDENCE_EXCLUSIONS =
  "ingest-audio-evidence-exclusions" as const;
