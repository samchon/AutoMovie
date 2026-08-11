# Delivery profile, time과 picture

## Destination profile과 product matrix {#spec-delivery-profile-matrix}
<!-- @evidence requirements/delivery-and-accessibility/scope-and-profiles.md#delivery-scope-profiles 목적지별 전달 계약을 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/scope-and-profiles.md#delivery-profile-ownership Profile ownership을 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/scope-and-profiles.md#delivery-required-optional Required와 optional 상태를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/scope-and-profiles.md#delivery-multiple-profiles Multiple delivery의 독립성을 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/scope-and-profiles.md#delivery-profile-precedence Constraint precedence를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/scope-and-profiles.md#delivery-profile-freshness Profile dependency freshness를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/scope-and-profiles.md#delivery-profile-partial Partial profile result를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/scope-and-profiles.md#delivery-profile-refusal Profile conflict 거절 조건을 정밀화한다. -->
<!-- @evidence requirements/acceptance/profiles-and-aggregation.md#acceptance-delivery-profile Actual delivery bytes를 판정하는 acceptance profile과 결속한다. -->

Delivery profile은 stable identity와 revision, destination purpose, selected edit, required picture·audio·text·accessibility products, language set, container·codec, exact time, raster·color, metadata, naming, package, validation, approval과 publication policy를 하나의 constraint matrix로 고정한다. 각 item은 required, optional, intentionally absent 또는 unsupported 중 하나이고, optional attempt failure와 intentionally absent를 합치지 않는다. 같은 film에서 profile별 result, status, review와 lineage는 독립적이다.

Constraint resolution은 destination rule, explicit project choice와 measured source capability를 ordered precedence로 적용하고 conflict와 permitted alternative를 사용자에게 보여준다. Default나 과거 성공 setting은 profile revision을 대신하지 않으며 quality 저하, stream drop, language fallback 또는 codec 교체는 명시적 새 candidate profile 없이는 실행하지 않는다. Plan은 expected product·stream·asset inventory와 각 acceptance condition을 제공한다.

Selected edit, render, mix, translation, caption 또는 profile revision 변경은 dependency에 따라 plan, encode, probe, review와 publication을 stale로 만든다. 독립 item은 partial candidate로 보존하되 requested set의 completed, failed, unsupported와 not-run을 모두 나열한다. 모순된 조합, missing required stream, unknown timebase, duplicate identity, unmeasurable target와 unresolved precedence는 계획 단계에서 거절한다.

## Container, codec와 observed media facts {#spec-delivery-container-media-facts}
<!-- @evidence requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md#delivery-container-codec-facts Planned setting과 actual stream 일치를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md#delivery-stream-identity Stream role과 identity를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md#delivery-supported-combinations Supported media combination을 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md#delivery-stream-duration-interleave Stream duration과 interleave를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md#delivery-container-metadata Playback metadata facts를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md#delivery-encoding-tool-identity Encoding tool identity를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md#delivery-partial-container Partial container 상태를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md#delivery-media-fact-refusal Planned-actual mismatch 거절 조건을 정밀화한다. -->

Media plan은 container와 video, audio, text 또는 data stream별 codec, profile-like parameters, rate, dimensions, channel, language, role와 required metadata를 선언한다. Profile은 container·codec·pixel·sample format·channel·subtitle representation의 supported combinations를 소유하고 encoder request가 자동 대체를 선택하지 못하게 한다. Stream identity는 source artifact, role, language와 deterministic order로 닫히며 unstable probe index만 사용하지 않는다.

Probe는 candidate와 published bytes를 직접 열어 container, stream population, codec, effective format, start, duration, timebase, dimensions, channel, language, color, orientation, accessibility designation과 metadata를 관찰한다. Planned와 observed를 field별로 비교하고 encoder·muxer name, version, platform, normalized setting와 process result를 receipt에 묶는다. Filename extension, command text, free-form tag와 upload receipt는 media fact가 아니다.

Open 가능한 container라도 required stream, duration 또는 metadata가 빠지면 partial 또는 failed다. Probe failure, zero stream, unexpected codec, duplicate role, undecodable stream, duration drift와 planned-actual mismatch는 해당 result를 거절하고 stream별 expected·actual을 보고한다. Valid stream bytes는 recovery에 보존할 수 있지만 complete public media로 승격하지 않는다.

## Rational rate, timebase와 timecode {#spec-delivery-timecode-sync}
<!-- @evidence requirements/delivery-and-accessibility/frame-rate-timebase-and-timecode.md#delivery-frame-rate-timebase-timecode Film time의 전달 표현을 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/frame-rate-timebase-and-timecode.md#delivery-rational-frame-rate Exact rational rate를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/frame-rate-timebase-and-timecode.md#delivery-rate-mode Constant와 variable rate를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/frame-rate-timebase-and-timecode.md#delivery-timecode-profile Timecode convention을 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/frame-rate-timebase-and-timecode.md#delivery-stream-synchronization Stream synchronization을 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/frame-rate-timebase-and-timecode.md#delivery-edit-media-origin Edit와 media origin을 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/frame-rate-timebase-and-timecode.md#delivery-time-boundary-count 첫 frame과 tail boundary를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/frame-rate-timebase-and-timecode.md#delivery-time-refusal Ambiguous time mapping 거절 조건을 정밀화한다. -->

Delivery time contract는 exact rational picture rate, constant 또는 declared variable mode, stream timebases, edit origin, presentation start, frame numbering, audio sample rate와 timecode profile을 별도 field로 가진다. Rational은 canonical numerator·denominator가 authority이고 decimal fps나 display string으로 duration을 재계산하지 않는다. Variable-rate stream은 각 sample timestamp와 duration을 보존하며 단일 평균 rate로 가장하지 않는다.

Timecode는 drop-frame-like 또는 non-drop convention, nominal rate relation, start, day wrap, reel·clip relation과 machine-readable 또는 burn-in presentation을 선언한다. Edit zero, media start와 displayed timecode origin을 구분하고 head offset, negative source time 또는 nonzero start가 trim·caption·seek에서 어느 origin을 쓰는지 고정한다. Video, audio, cue, chapter와 metadata는 common presentation origin으로 exact conversion되고 rounding drift bound를 가진다.

Validation은 first frame, end-exclusive film end, last presented frame, exact frame count, first·last audio sample, permitted tail와 final cue를 인접 boundary와 함께 확인한다. Invalid rate, ambiguous convention, unrepresentable mapping, count mismatch, timestamp reversal, overflow와 sync drift는 synchronized status를 거절한다. 유효 stream 일부를 보존해도 common timeline closure가 실패하면 complete delivery가 아니다.

## Picture, color와 image sequence {#spec-delivery-picture-products}
<!-- @evidence requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-picture-color-sequences Picture product의 공간·색 계약을 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-scene-display-picture Scene-linear와 display-referred lineage를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-picture-dimensions-window Dimensions와 window를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-picture-alpha-channels Alpha와 channel semantics를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-image-sequences Image sequence closure를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-multipart-channels Multi-part structural channel을 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-picture-derivatives Proxy와 derivative lineage를 정밀화한다. -->
<!-- @evidence requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-picture-refusal Invalid picture product 거절 조건을 정밀화한다. -->

Picture product는 stored·display dimensions, pixel aspect, orientation, crop, display·data window, channel order·unit·precision, alpha relation, color space, transfer, primaries-like identity, range와 view transform을 profile revision에 결속한다. Scene-linear intermediate, display-referred master, proxy와 consumer derivative는 별도 product이며 ordered transform lineage를 기록한다. Render와 encode에서 같은 view transform을 두 번 적용하거나 observed bytes와 다른 color metadata를 선언하지 않는다.

Image sequence는 normalized frame pattern, first number, exact count, time mapping, dimensions, schema, per-frame digest와 missing policy를 가진다. Multipart 또는 separate structural products는 part별 meaning과 validity를 제공하고 beauty와 numeric channel을 혼동하지 않는다. Thumbnail과 proxy는 master identity, crop, range와 transform을 참조하지만 master precision, alpha, dimensions 또는 metadata acceptance를 대신하지 않는다.

Decoded facts는 plan과 비교되고 wrong dimensions, gap·duplicate·stray revision frame, unknown color, double transform, invalid alpha, clipped range, mixed schema와 digest mismatch는 거절된다. Verified frames는 isolated partial sequence로 보존할 수 있지만 sequence closure와 missing set을 명시하고 complete picture나 publishable master로 표시하지 않는다.
