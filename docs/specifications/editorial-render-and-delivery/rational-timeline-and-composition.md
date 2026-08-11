# Rational timeline과 composition

## Contract units {#spec-rational-timeline-composition-contract-units}

### Canonical film clock과 range algebra {#spec-editorial-rational-timeline}
<!-- @evidence requirements/editorial/rational-time-and-ranges.md#editorial-rational-time-ranges Film clock의 exact rational basis를 정밀화한다. -->
<!-- @evidence requirements/editorial/rational-time-and-ranges.md#editorial-canonical-time Canonical time 표현과 비교 규칙을 정밀화한다. -->
<!-- @evidence requirements/editorial/rational-time-and-ranges.md#editorial-time-ranges Range의 시작 포함과 끝 제외 계약을 정밀화한다. -->
<!-- @evidence requirements/editorial/rational-time-and-ranges.md#editorial-time-transforms Source와 film time 변환을 정밀화한다. -->
<!-- @evidence requirements/editorial/rational-time-and-ranges.md#editorial-frame-grid Film clock과 frame grid의 관계를 정밀화한다. -->
<!-- @evidence requirements/editorial/rational-time-and-ranges.md#editorial-mixed-timebases 서로 다른 timebase의 변환 경계를 정밀화한다. -->
<!-- @evidence requirements/editorial/rational-time-and-ranges.md#editorial-range-operations Range 연산의 closure를 정밀화한다. -->
<!-- @evidence requirements/editorial/rational-time-and-ranges.md#editorial-time-refusal 잘못된 시간 입력의 거절 조건을 정밀화한다. -->

System은 모든 편집 시간을 기약된 정수 numerator와 양의 denominator로 표현하고, film origin, source origin, presentation origin과 frame 또는 sample grid를 서로 다른 coordinate로 유지한다. Canonicalization은 부호를 numerator에만 두고 영과 동치 fraction을 하나의 표현으로 축약하며, equality와 ordering은 decimal formatting이나 locale이 아니라 overflow가 검출되는 exact arithmetic으로 판정한다. Range는 항상 start-inclusive, end-exclusive이고 empty range는 명시적으로 허용된 선택 결과가 아닌 한 실행 대상이 될 수 없다.

Trim, offset, rate와 reverse는 source range에서 film range로 가는 명시적 affine relation과 그 inverse 가능 범위를 만든다. Concatenate, intersect, subtract, clamp와 split은 입력 coordinate와 boundary convention을 보존하며, 서로 다른 rate나 sample grid는 공통 rational basis로 변환한 뒤에만 비교한다. Frame과 audio sample 선택은 각각 선언된 grid의 nearest 또는 directed rounding 규칙을 기록하고, 표시용 decimal을 다시 identity 계산에 넣지 않는다.

결과는 canonical timebase, normalized ordered ranges, transform lineage, exact duration과 grid mapping을 포함한다. Zero denominator, non-finite 또는 비정수 입력, overflow, reversed required range, non-invertible required transform, grid 밖 강제 snap과 모호한 origin은 계획 전에 거절한다. 일부 독립 range만 유효하면 invalid range와 downstream 영향 범위를 함께 반환하는 partial plan으로 남기고, 실패 항목을 삭제한 새 cut으로 자동 승격하지 않는다.

### Integer production frame predicate {#spec-editorial-frame-grid-predicate}

<!-- @evidence requirements/editorial/rational-time-and-ranges.md#editorial-frame-grid declared frame rate가 authored time의 integer frame grid membership을 결정한다. -->

Frame-grid predicate는 authored time과 positive finite frame rate의 product가 machine precision을 고려한 integer frame에 해당하는지만 판정한다. Decimal display, clip transform, mixed timebase conversion 또는 range repair를 이 predicate가 수행했다고 주장하지 않으며 grid 밖 값은 가장 가까운 frame으로 자동 snap하지 않는다.

### Track, stack과 nested composition {#spec-editorial-track-composition}
<!-- @evidence requirements/editorial/tracks-stacks-and-composition.md#editorial-tracks-stacks-composition Track과 stack 합성의 system 경계를 정밀화한다. -->
<!-- @evidence requirements/editorial/tracks-stacks-and-composition.md#editorial-sequential-tracks 순차 track의 점유 불변식을 정밀화한다. -->
<!-- @evidence requirements/editorial/tracks-stacks-and-composition.md#editorial-layered-stacks Layered stack의 합성 순서를 정밀화한다. -->
<!-- @evidence requirements/editorial/tracks-stacks-and-composition.md#editorial-picture-composition Picture 합성 의미를 정밀화한다. -->
<!-- @evidence requirements/editorial/tracks-stacks-and-composition.md#editorial-sound-composition Sound 합성 의미를 정밀화한다. -->
<!-- @evidence requirements/editorial/tracks-stacks-and-composition.md#editorial-enable-alternatives Enable과 alternative 선택 상태를 정밀화한다. -->
<!-- @evidence requirements/editorial/tracks-stacks-and-composition.md#editorial-nested-composition Nested composition의 시간 결속을 정밀화한다. -->
<!-- @evidence requirements/editorial/tracks-stacks-and-composition.md#editorial-composition-refusal 잘못된 composition의 거절 조건을 정밀화한다. -->

Composition은 stable identity를 가진 ordered track 집합이고, 각 track은 picture, audio, text 또는 metadata role, enable 상태, exclusivity, layer order와 clip population을 선언한다. Sequential track은 같은 exclusive lane에서 transition으로 설명되지 않은 overlap을 허용하지 않고, layered stack은 앞뒤 순서, opacity·blend 또는 gain·bus 같은 합성 operator와 빈 영역의 의미를 명시한다. Track 배열의 열거 순서가 의미를 소유하지 않으며 동일 order key 충돌은 임의로 해소하지 않는다.

한 film instant의 picture result는 활성 clip, transition과 layer operator의 ordered evaluation으로, sound result는 독립적인 source intervals, gain, routing과 mix relation으로 resolve된다. Disabled, muted, alternate-selected, intentionally empty와 missing은 서로 다른 상태다. Nested composition은 child timebase, child selected revision과 parent-to-child transform을 고정하고 cycle 없이 dependency closure를 만들며, child 수정은 실제로 소비하는 parent span만 stale로 만든다.

Resolution 결과는 instant 또는 requested range별 활성 entry, provenance, composition order와 excluded reason을 관찰 가능하게 제공한다. Duplicate identity, hierarchy cycle, 모호한 order, incompatible role, undeclared overlap, missing selected alternative와 child range escape는 거절한다. 독립 track의 성공은 보존할 수 있지만 required track이 실패하면 전체 composition은 partial이고, 성공 track만 출력한 결과를 selected film으로 표기하지 않는다.

### Clip source range, handle과 replacement {#spec-editorial-clip-boundaries}
<!-- @evidence requirements/editorial/clips-source-ranges-and-handles.md#editorial-clips-source-ranges-handles Clip이 source와 film range를 연결하는 계약을 정밀화한다. -->
<!-- @evidence requirements/editorial/clips-source-ranges-and-handles.md#editorial-source-film-range Source와 film 범위 mapping을 정밀화한다. -->
<!-- @evidence requirements/editorial/clips-source-ranges-and-handles.md#editorial-clip-handles Transition handle의 가용 범위를 정밀화한다. -->
<!-- @evidence requirements/editorial/clips-source-ranges-and-handles.md#editorial-clip-retime-direction Retime과 재생 방향을 정밀화한다. -->
<!-- @evidence requirements/editorial/clips-source-ranges-and-handles.md#editorial-missing-generated-media Missing media 상태를 정밀화한다. -->
<!-- @evidence requirements/editorial/clips-source-ranges-and-handles.md#editorial-clip-replacement Replacement의 identity 경계를 정밀화한다. -->
<!-- @evidence requirements/editorial/clips-source-ranges-and-handles.md#editorial-clip-boundary-result Clip boundary 결과를 정밀화한다. -->
<!-- @evidence requirements/editorial/clips-source-ranges-and-handles.md#editorial-clip-refusal Clip 입력 거절 조건을 정밀화한다. -->

Clip은 source artifact와 revision, source range, destination film range, time transform, track role, enabled state와 optional handle reservation을 하나의 immutable decision identity로 묶는다. Available source extent와 requested source range를 먼저 검증하고, head와 tail handle은 본편 사용분과 분리하여 transition이 실제로 소비할 수 있는 exact range로 계산한다. Forward, reverse와 supported rate는 sample order와 duration을 바꾸지만 source bytes 또는 semantic event identity를 바꾸지 않는다.

Clip resolution은 film instant를 source instant와 sample selection으로 연결하고, 첫 sample, end-exclusive boundary, 마지막 제시 sample과 transition-only handle을 구분한다. Generated 또는 external media가 missing, stale, partial, undecodable 상태이면 placeholder를 current source로 만들지 않는다. Replacement는 대체 source의 lineage와 compatibility를 검증한 새 decision이며, old clip을 변경하지 않고 affected edit, sound, caption, render와 review를 stale로 만든다.

Boundary report는 requested·available·used source range, destination range, transform, handles, first·last selected sample와 out-of-range cause를 제공한다. Missing required source, insufficient handle, zero 또는 non-finite rate, unsupported reverse, duration mismatch와 ambiguous source origin은 거절한다. 이미 유효한 clip은 partial edit에서 유지할 수 있으나 missing clip의 film interval과 downstream 금지 목적을 명시한다.

### Transition와 overlap evaluation {#spec-editorial-transition-overlap}
<!-- @evidence requirements/editorial/transitions-and-overlaps.md#editorial-transitions-overlaps Transition과 overlap의 합성 경계를 정밀화한다. -->
<!-- @evidence requirements/editorial/transitions-and-overlaps.md#editorial-transition-handles Transition handle 소비를 정밀화한다. -->
<!-- @evidence requirements/editorial/transitions-and-overlaps.md#editorial-picture-sound-transition Picture와 sound transition의 독립성을 정밀화한다. -->
<!-- @evidence requirements/editorial/transitions-and-overlaps.md#editorial-transition-timing Transition timing을 정밀화한다. -->
<!-- @evidence requirements/editorial/transitions-and-overlaps.md#editorial-overlap-composition Overlap 합성 순서를 정밀화한다. -->
<!-- @evidence requirements/editorial/transitions-and-overlaps.md#editorial-transition-boundary-samples Boundary sample 판정을 정밀화한다. -->
<!-- @evidence requirements/editorial/transitions-and-overlaps.md#editorial-transition-partial-state Partial transition 상태를 정밀화한다. -->
<!-- @evidence requirements/editorial/transitions-and-overlaps.md#editorial-transition-refusal Transition 거절 조건을 정밀화한다. -->

Transition은 outgoing과 incoming clip identity, film overlap range, 양쪽 source handle, picture operator, optional sound operator와 normalized progress function을 선언한다. Overlap duration은 destination duration에서 정확히 한 번 차감되고, 양쪽 clip의 source sample은 같은 film instant에서 독립 transform으로 resolve된다. Picture dissolve가 sound crossfade를 암시하지 않으며 J-cut과 L-cut은 picture boundary를 바꾸지 않는다.

Progress는 overlap start에서 정의된 첫 값과 end-exclusive 직전의 마지막 값을 가지며, hard cut instant에는 정확히 하나의 live picture owner가 있다. Multi-layer overlap은 track order와 operator associativity가 선언된 경우에만 평가하고, evaluation order가 결과에 영향을 주면 그 order는 transition identity에 포함된다. Chunk 또는 direct seek는 같은 film instant의 clip set, sample times와 weights를 얻어야 한다.

Result는 transition range, source ranges, progress samples, active layers, consumed handles와 picture·sound boundary를 반환한다. Missing handle, duration 초과, reversed overlap, unsupported operator, cyclic dependency, ambiguous live owner와 incompatible color 또는 audio domain은 거절한다. 한쪽 source만 준비된 transition은 complete frame이 아니며, unaffected hard-cut 구간만 reusable로 표시하고 경계 구간은 missing 또는 partial로 격리한다.
