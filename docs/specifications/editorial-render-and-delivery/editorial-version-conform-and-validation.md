# Editorial version, conform과 validation

## Selected film identity와 duration closure {#spec-editorial-film-identity}
<!-- @evidence requirements/editorial/scope-and-identity.md#editorial-scope-identity Edit와 film identity를 정밀화한다. -->
<!-- @evidence requirements/editorial/scope-and-identity.md#editorial-story-film-order Story order와 film order의 분리를 정밀화한다. -->
<!-- @evidence requirements/editorial/scope-and-identity.md#editorial-source-preservation Source 보존 경계를 정밀화한다. -->
<!-- @evidence requirements/editorial/scope-and-identity.md#editorial-authored-cut Authored cut의 선택 결과를 정밀화한다. -->
<!-- @evidence requirements/editorial/scope-and-identity.md#editorial-duration-closure Film duration closure를 정밀화한다. -->
<!-- @evidence requirements/editorial/scope-and-identity.md#editorial-identity-boundary Edit identity 변화 경계를 정밀화한다. -->
<!-- @evidence requirements/editorial/scope-and-identity.md#editorial-missing-refusal Missing source의 거절 상태를 정밀화한다. -->

Film edit identity는 production revision, ordered composition graph, clip decisions, transition graph, picture와 sound selection, timing metadata와 selected version을 canonical closure로 묶는다. Story chronology와 presented film order는 별도 relation이며 reorder가 source truth를 변경하지 않는다. Source artifact와 authored cut은 immutable lineage로 연결되고 edit는 source bytes나 compiled scene을 직접 보정하지 않는다.

Duration closure는 모든 enabled required track의 first presentation instant, end-exclusive film end, picture last sample, sound tail와 text cue 범위를 계산하고 의도된 leader·gap·tail을 분류한다. Selection 결과는 stable edit fingerprint, total range, included·excluded source entries, unresolved dependencies와 exact status를 제공한다. 이름이 같은 cut, output path 또는 이전 선택 pointer는 identity가 아니다.

Missing required source, ambiguous selection, duration overflow, unresolved graph와 source mutation은 selected current 상태를 거절한다. 이미 닫힌 independent range는 partial candidate에 남길 수 있지만 missing interval과 consumer 금지 범위를 명시한다. Source 또는 decision 변경은 affected conform, render, mix, caption, review와 delivery만 stale로 전파한다.

## Append-only version과 alternative cut {#spec-editorial-version-selection}
<!-- @evidence requirements/editorial/versions-and-alternative-cuts.md#editorial-versions-alternative-cuts Version과 alternative cut 계약을 정밀화한다. -->
<!-- @evidence requirements/editorial/versions-and-alternative-cuts.md#editorial-append-only-revision Append-only revision 계보를 정밀화한다. -->
<!-- @evidence requirements/editorial/versions-and-alternative-cuts.md#editorial-difference-report Version difference report를 정밀화한다. -->
<!-- @evidence requirements/editorial/versions-and-alternative-cuts.md#editorial-alternative-independence Alternative의 독립 상태를 정밀화한다. -->
<!-- @evidence requirements/editorial/versions-and-alternative-cuts.md#editorial-selection-state Selection 상태 전이를 정밀화한다. -->
<!-- @evidence requirements/editorial/versions-and-alternative-cuts.md#editorial-version-merge-conflict Merge conflict를 정밀화한다. -->
<!-- @evidence requirements/editorial/versions-and-alternative-cuts.md#editorial-version-stale-review Stale review 전파를 정밀화한다. -->
<!-- @evidence requirements/editorial/versions-and-alternative-cuts.md#editorial-version-refusal Version 거절 조건을 정밀화한다. -->

Revision은 parent identity, immutable decision set, authoring rationale, creation activity와 status를 가진 append-only entity다. Alternative cut은 공통 ancestor를 참조할 수 있지만 clip·timing·sound·metadata, validation과 publication 상태를 독립적으로 소유한다. Working, candidate, selected, superseded와 rejected를 구분하고 selection은 revision bytes를 바꾸는 대신 expected current revision에 대한 새 decision으로 기록한다.

Difference report는 common ancestor에서 clip add·remove·replace·reorder, trim·retime, transition, marker, effect, picture·sound range와 duration delta를 semantic identity로 비교한다. Merge는 양쪽 변경이 같은 decision 또는 overlapping film consequence를 건드리는지 판정하며, 충돌을 배열 순서나 last writer로 해소하지 않는다. Selection race는 compare-and-select precondition으로 거절하여 늦은 작업이 current를 되돌리지 못하게 한다.

Unknown parent, cycle, duplicate revision identity, unresolved merge conflict, stale selection precondition과 incomplete selected closure는 거절한다. 독립 candidate는 보존하고 conflict set과 사용자 선택지를 보고한다. Selected revision 변경은 정확한 dependency graph로 conform, media, review와 publication을 stale로 만들며 이전 revision의 historical evidence는 삭제하지 않는다.

## Media reference, relink와 conform {#spec-editorial-conform-relink}
<!-- @evidence requirements/editorial/conform-and-media-references.md#editorial-conform-media-references Conform과 media reference 계약을 정밀화한다. -->
<!-- @evidence requirements/editorial/conform-and-media-references.md#editorial-reference-resolution Reference resolution을 정밀화한다. -->
<!-- @evidence requirements/editorial/conform-and-media-references.md#editorial-image-sequence-movie Image sequence와 movie source의 구분을 정밀화한다. -->
<!-- @evidence requirements/editorial/conform-and-media-references.md#editorial-proxy-final-conform Proxy와 final conform을 정밀화한다. -->
<!-- @evidence requirements/editorial/conform-and-media-references.md#editorial-media-relink Relink 안전 조건을 정밀화한다. -->
<!-- @evidence requirements/editorial/conform-and-media-references.md#editorial-time-channel-conform Time과 channel conform을 정밀화한다. -->
<!-- @evidence requirements/editorial/conform-and-media-references.md#editorial-partial-conform-recovery Partial conform recovery를 정밀화한다. -->
<!-- @evidence requirements/editorial/conform-and-media-references.md#editorial-conform-publication Conform publication을 정밀화한다. -->
<!-- @evidence requirements/editorial/conform-and-media-references.md#editorial-conform-refusal Conform 거절 조건을 정밀화한다. -->

Media reference는 logical role, source artifact identity, immutable digest, media kind, exact timebase, available range, dimensions 또는 channel facts와 locator policy를 가진다. Resolution은 locator에서 actual bytes를 열고 identity와 facts를 다시 확인하며, image sequence는 pattern·start·count·per-frame digest를, movie는 probed streams·timestamps·duration을 각각 검증한다. Proxy는 final source와 명시적 lineage와 mapping을 가지며 비슷한 filename이나 duration만으로 final이 될 수 없다.

Conform은 selected edit의 각 source request를 current final media range와 channel에 mapping하고 first·last sample, trim, retime, transition handle, audio sample, text cue와 output duration을 검증한다. Relink는 old logical reference와 candidate bytes의 stable identity, technical facts, content relation과 user-approved replacement 범위를 확인한 새 activity다. 다른 bytes를 같은 source identity로 덮어쓰거나, final이 없을 때 proxy를 조용히 publish하지 않는다.

Conform state는 planned, resolving, partial, conformed, verified, stale와 failed를 구분하고 entry별 expected·resolved·missing·mismatched를 제공한다. Independent verified entry는 재개에 사용할 수 있지만 selected edit fingerprint가 같고 actual bytes receipt가 current일 때만 재사용한다. Missing range, mixed revision, wrong rate·dimensions·channel, digest mismatch와 unsafe locator는 거절하며 publication은 complete conform의 immutable receipt와 readback 뒤에만 current가 된다.

## Editorial validation과 recovery {#spec-editorial-validation-recovery}
<!-- @evidence requirements/editorial/validation.md#editorial-validation Editorial validation의 단계와 verdict를 정밀화한다. -->
<!-- @evidence requirements/editorial/validation.md#editorial-structural-validation 구조 closure 검증을 정밀화한다. -->
<!-- @evidence requirements/editorial/validation.md#editorial-story-coverage Story coverage 검증을 정밀화한다. -->
<!-- @evidence requirements/editorial/validation.md#editorial-sequence-review Sequence review 의무를 정밀화한다. -->
<!-- @evidence requirements/editorial/validation.md#editorial-film-review Film review 의무를 정밀화한다. -->
<!-- @evidence requirements/editorial/validation.md#editorial-validation-boundaries Boundary validation을 정밀화한다. -->
<!-- @evidence requirements/editorial/validation.md#editorial-validation-recovery 수정 뒤 recovery 범위를 정밀화한다. -->
<!-- @evidence requirements/editorial/validation.md#editorial-validation-status Validation 상태를 정밀화한다. -->
<!-- @evidence requirements/editorial/validation.md#editorial-validation-refusal 불충분한 검증의 거절 조건을 정밀화한다. -->
<!-- @evidence requirements/acceptance/case-matrix-and-counterexamples.md#acceptance-case-triad Editorial boundary는 positive, negative와 boundary case로 검증한다. -->

Validation request는 exact edit identity, scope, profile과 expected composition closure를 고정한다. Structural pass는 시간·track·clip·transition·marker·effect·source mapping의 completeness, overlap, gap과 duration을 검사하고, story coverage는 required beat와 information event가 selected film range에 연결되는지 확인한다. Sequence review는 모든 cut 양쪽, action과 audiovisual continuity를, film review는 전체 재생의 narrative completion, pacing, 시작과 ending을 실제 current presentation에서 관찰한다.

각 criterion은 method, observed value, expected value, time·view·channel scope, evidence identity와 pass, fail, indeterminate, not-run, unsupported 또는 stale verdict를 가진다. First sample, end-exclusive boundary, reverse·retime, transition start·end, J-cut·L-cut, empty track, missing source와 mixed timebase의 positive·negative·boundary case를 포함한다. Numeric closure가 visual 또는 audible review를 대신하거나 one-frame pass가 interval 전체를 대표하지 않는다.

Overall status는 planned, partial, validated, reviewed, failed와 stale을 구분하며 하위 verdict를 숨기지 않는다. 수정 뒤 dependency relation으로 affected check와 downstream review만 다시 실행하고 unchanged evidence의 identity와 재사용 근거를 남긴다. Expected scope, source truth, criterion, current evidence 또는 authority가 모호하면 pass를 만들지 않으며 자동 fallback 결과는 별도 candidate edit로 검증한다.
