# Delivery validation과 release status

## Contract units {#spec-delivery-validation-release-status-contract-units}

### Published bytes validation과 recovery {#spec-delivery-validation-release}
<!-- @evidence requirements/delivery-and-accessibility/validation.md#delivery-validation Actual published bytes의 재검증을 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/validation.md#delivery-profile-conformance Profile conformance 판정을 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/validation.md#delivery-package-closure-validation Package closure validation을 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/validation.md#delivery-audiovisual-review Final decoded audiovisual review를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/validation.md#delivery-accessibility-review Intended selection path의 accessibility review를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/validation.md#delivery-negative-corruption Corruption과 negative validation을 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/validation.md#delivery-cross-artifact-consistency Cross-artifact revision consistency를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/validation.md#delivery-validation-recovery Partial validation recovery를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/validation.md#delivery-final-status Final delivery 상태를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/validation.md#delivery-validation-refusal Ambiguous final verdict 거절 조건을 정밀화한다. -->
<!-- @evidence requirements/acceptance/review-surfaces-and-sampling.md#acceptance-delivery-surface Actual published delivery가 독립 acceptance 표면이다. -->

Validation request는 exact profile revision, selected film, candidate 또는 published artifact identity, manifest, destination과 required review protocol을 고정한다. Actual bytes에서 path safety, digest, container, streams, codec, timestamps, rate, dimensions, color, audio, text, language, accessibility, provenance와 publication state를 측정하고 각 required field를 profile의 target, range, allowed set 또는 conditional rule과 비교한다. Manifest assertion, planned setting, extension, URL과 이전 publication은 observed fact가 아니다.

Final decoded review는 전체 picture와 sound, 시작·ending, sync, language, caption, audio description, transcript, navigation, sign rendition과 artifact를 target playback 조건에서 관찰한다. Accessibility asset은 intended user selection path에서 발견·표시·활성화하여 timing, readability, audibility, coverage와 labeling을 확인한다. Package, container metadata, text assets, provenance와 public reference가 같은 edit, duration, language, profile과 digest를 가리키는지 cross-artifact join을 검사한다.

Positive result와 함께 truncated bytes, missing stream, wrong language, stale cue, extra·missing frame, wrong channel, digest mismatch, path escape, partial package와 concurrent revision의 negative·boundary case를 실행하며 valid published version을 변경하지 않는다. Status는 planned, assembling, encoded, packaged, probed, reviewed, publishing, published, partial, failed, unsupported, superseded, withdrawn, not-run과 stale을 구분한다. Independent evidence는 exact scope에서 보존하지만 수정 뒤 dependency와 downstream review만 재실행하고, ambiguous identity·profile·fact·review·target에서는 pass나 published를 만들지 않는다.
