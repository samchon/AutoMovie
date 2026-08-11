# 시공, Phase와 Alternative

## Contract units {#spec-construction-phases-and-alternatives-contract-units}

### Installation, maintenance와 safety state {#interior-space-installation-maintenance-safety}

<!-- @evidence requirements/interior/construction-maintenance-and-safety.md#interior-construction-maintenance-safety Requires installation, maintenance, and temporary safety facts. -->
<!-- @evidence requirements/interior/construction-maintenance-and-safety.md#interior-installation-disassembly Requires assembly and removal order. -->
<!-- @evidence requirements/interior/construction-maintenance-and-safety.md#interior-construction-tolerance-stack Requires typed contributions, datum, assembly order, combination method and a reproducible stack receipt. -->
<!-- @evidence requirements/interior/construction-maintenance-and-safety.md#interior-maintenance-access Requires access and service envelopes. -->
<!-- @evidence requirements/interior/construction-maintenance-and-safety.md#interior-temporary-hazard-state Requires temporary hazards to follow phase state. -->
<!-- @evidence requirements/interior/construction-maintenance-and-safety.md#interior-safety-claim-boundary Requires professional safety analysis to remain distinct from authored checks. -->

Element와 assembly는 install·remove predecessor, fastener·support, access direction, lifting·staging envelope, inspection·replacement interval와 temporary protection·opening·hazard state를 입력으로 가질 수 있다. 시스템은 phase별 present·visible·collidable·supported·accessible 상태, blocked maintenance volume와 disassembly dependency를 파생한다.

Tolerance stack 입력은 하나의 datum과 측정 방향, stable assembly order, 각 contribution의 source identity, `material-dimension`·`fabrication`·`installation`·`movement`·`survey-uncertainty` semantic kind, signed value·interval 또는 distribution, unit, correlation과 적용 조건을 가져야 한다. Combination method는 `worst-case`, 명시된 distribution·dependency·confidence를 사용하는 `statistical` 또는 공식과 parameter가 있는 project-declared method 중 하나이며 포함·제외하는 contribution kind와 순서를 고정해야 한다. Numeric comparison tolerance는 resolved residual을 판정하는 별도 threshold이고 authored aesthetic variation은 사용자가 승인한 resolved geometry 입력이므로 어느 것도 물리 stack contribution과 교환하거나 불리한 fit·clearance 결과를 줄이는 값으로 사용할 수 없다.

Stack result receipt는 design·phase·alternative revision, datum, assembly order, ordered typed contributions, unit conversions, combination method와 parameter, correlation assumption, nominal result, lower·upper 또는 distribution result, measured residual, comparison threshold와 joint·fit·clearance·replacement 판정을 결속해야 한다. Contribution, datum, assembly order 또는 combination method가 바뀌면 새 receipt를 만들고 이전 maintenance, quantity, drawing, analysis와 review를 stale로 표시해야 한다.

Removed support에 매달린 element, 닫힌 access, impossible sequence, incompatible unit, datum·assembly order·combination method가 없는 stack, tolerance kind 교환, 허용오차 초과, unguarded temporary void와 phase에 존재하지 않는 service를 current로 표시하는 행위는 failure다. 이 구조 검증은 공사 안전·구조·소방 전문 승인을 대신하지 않으며 계산하지 않은 안전 성능은 `unknown` 또는 `not-run`이다.

### Existing condition과 survey uncertainty {#interior-space-existing-condition-uncertainty}

<!-- @evidence requirements/interior/existing-conditions-phases-and-alternatives.md#interior-existing-phases-alternatives Requires existing, demolition, temporary, and new states. -->
<!-- @evidence requirements/interior/existing-conditions-phases-and-alternatives.md#interior-existing-survey-uncertainty Requires observation confidence and unresolved conditions. -->

Existing condition은 source observation, measured 또는 inferred geometry, confidence·uncertainty, survey date, inaccessible region과 stable element·space·boundary identity를 입력으로 가져야 한다. Observed line, scan, image와 drawing은 설계 truth가 아니라 근거이며 사용자가 확정한 interpretation과 구분한다. 출력은 resolved existing state와 unresolved·conflicting observation을 함께 보존하고 새 survey가 들어와도 이전 source revision을 덮어쓰지 않는다. Uncertainty 밖 강제 정합, 가려진 구조·서비스의 발명과 서로 다른 observation을 근거 없이 합치는 행위는 failure이며 unknown은 downstream clearance·quantity·phase 결과를 incomplete로 만든다.

### Phase graph와 design alternative {#interior-space-phase-alternative-graph}

<!-- @evidence requirements/interior/existing-conditions-phases-and-alternatives.md#interior-construction-renovation-phases Requires phase-ordered element states. -->
<!-- @evidence requirements/interior/existing-conditions-phases-and-alternatives.md#interior-design-alternatives Requires alternatives over a shared base rather than destructive replacement. -->
<!-- @evidence requirements/interior/existing-conditions-phases-and-alternatives.md#interior-change-impact Requires dependency-aware staleness. -->
<!-- @evidence requirements/interior/existing-conditions-phases-and-alternatives.md#interior-canonical-state Requires one unambiguous selected state for each output. -->

Phase는 named node, predecessor, valid interval 또는 order와 identity별 existing·retain·demolish·temporary·new·relocate·inactive state를 입력으로 받고, alternative는 common base revision 위의 explicit change set으로 분리한다. 한 output은 정확히 하나의 design revision, phase, alternative, operation state, asset closure와 analysis setting을 읽어야 하며 서로 다른 대안의 결과를 하나의 current interior에 섞지 않는다. 변경 영향은 geometry, host·support, opening, pattern, furnishing, service, quantity, drawing, analysis, render와 review dependency를 stale로 표시한다. Cycle, overlapping exclusive state, missing predecessor, demolished host의 retained child와 selection 없는 multi-alternative output은 failure이며 migration은 이전 대안과 phase provenance를 보존한다.
