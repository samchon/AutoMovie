# Render encoding과 validation

## Contract units {#spec-render-encoding-validation-contract-units}

### Encode, multiplex와 output probe {#spec-render-encode-probe}
<!-- @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encoding-multiplexing Frame과 audio의 media 조립을 정밀화한다. -->
<!-- @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure Encode input closure를 정밀화한다. -->
<!-- @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-timestamps Stream timestamp와 sync를 정밀화한다. -->
<!-- @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-codec-container-facts Codec와 container fact를 정밀화한다. -->
<!-- @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-stream-selection Stream selection을 정밀화한다. -->
<!-- @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-atomic-output Atomic encode output을 정밀화한다. -->
<!-- @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-retry Encode retry의 reproducibility 범위를 정밀화한다. -->
<!-- @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-refusal Encode 거절 조건을 정밀화한다. -->

Encode plan은 verified image sequence, audio streams, text cues와 metadata events를 selected delivery profile의 container, codec, pixel·sample format, rate, channel, color와 duration으로 변환한다. 시작 전 frame numbering·count·dimensions·alpha·color·digest, audio sample count·format, cue set와 duration closure를 확인하며 missing input을 duplicate frame, silence 또는 empty cue로 채우지 않는다. 각 stream은 role, language, source identity와 deterministic ordering을 가진다.

Frame, audio sample, cue와 metadata timestamp는 common exact presentation origin에서 계산하고 stream timebase rounding rule과 permitted lead·tail을 기록한다. Encoder·muxer identity, version, platform과 normalized effective setting은 request와 별도로 receipt에 들어간다. Lossless profile은 supported runtime에서 약속하는 reproducibility 범위를, nondeterministic byte layout은 semantic media comparison 기준을 선언하며 byte equality를 허위로 약속하지 않는다.

Output은 isolated destination에서 process success, nonzero size, stream probe, timestamps, duration, dimensions, color·audio facts와 digest를 actual bytes에서 확인한 뒤 원자적으로 current가 된다. Missing frame, numbering gap, sync drift, unsupported codec-container 조합, failed process, stale input, zero bytes와 probe mismatch는 variant별 실패로 남는다. Independent variant는 보존할 수 있지만 failed required stream이나 metadata가 있는 encode를 전체 성공으로 승격하지 않는다.

### Render validation과 review boundary {#spec-render-validation}
<!-- @evidence requirements/rendering/validation.md#rendering-validation Planned output에서 current pixel까지의 검증을 정밀화한다. -->
<!-- @evidence requirements/rendering/validation.md#rendering-schedule-set-validation Schedule와 set closure 검증을 정밀화한다. -->
<!-- @evidence requirements/rendering/validation.md#rendering-nonblank-expected-content Expected pixel content 검증을 정밀화한다. -->
<!-- @evidence requirements/rendering/validation.md#rendering-multitime-multipass Multi-time과 multi-pass 검증을 정밀화한다. -->
<!-- @evidence requirements/rendering/validation.md#rendering-determinism-check Direct seek와 retry 비교를 정밀화한다. -->
<!-- @evidence requirements/rendering/validation.md#rendering-byte-media-probe Actual byte와 media probe를 정밀화한다. -->
<!-- @evidence requirements/rendering/validation.md#rendering-visual-review Actual presentation review 경계를 정밀화한다. -->
<!-- @evidence requirements/rendering/validation.md#rendering-negative-boundary-validation Negative와 boundary validation을 정밀화한다. -->
<!-- @evidence requirements/rendering/validation.md#rendering-validation-recovery Partial result와 recovery를 정밀화한다. -->
<!-- @evidence requirements/rendering/validation.md#rendering-validation-status Render validation 상태를 정밀화한다. -->
<!-- @evidence requirements/rendering/validation.md#rendering-validation-refusal 불충분한 render verdict 거절 조건을 정밀화한다. -->
<!-- @evidence requirements/acceptance/evidence-and-freshness.md#acceptance-perceptual-evidence Pixel과 decoded media review는 current artifact identity에 결속되어야 한다. -->

Validation은 exact source·schedule·runtime·product identity를 고정하고 planned set, lowered state, materialized bytes, encoded media, probe와 review를 순서 있는 evidence 단계로 검사한다. Expected frame·pass·view·product가 정확히 한 번 존재하는지 확인하고 missing, duplicate, extra, stale와 wrong-numbered를 구분한다. Frame은 dimensions, alpha, finite channel, variance, required mask owner, expected subject와 camera relation을 검사하며 nonblank만으로 correct를 주장하지 않는다.

Start, middle, end, semantic event, cut, transition과 chunk boundary에서 beauty와 required structural pass를 함께 검사한다. Clean sequential execution, arbitrary direct seek, repeated seek, subrange와 retry를 exact 또는 declared tolerance profile로 비교한다. Actual bytes를 다시 열어 count, digest, streams, codec, timestamps, duration, dimensions, color와 audio facts를 확인하며 path나 receipt assertion만 재검사하지 않는다.

Visual verdict는 실제 deployed presentation 또는 final decoded media를 관찰한 별도 evidence이며 numeric·source inspection으로 대체하지 않는다. 결과는 planned, scheduled, rendering, partial, materialized, probed, reviewed, failed, unsupported, not-run과 stale을 구분한다. 성공한 independent product는 보존하되 missing scope와 stale downstream review를 표시하고, ambiguous identity·comparison profile·review freshness에서는 pass를 만들지 않는다.
