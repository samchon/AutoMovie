# 산출물, 수량과 Validation

## Contract units {#spec-deliverables-and-validation-contract-units}

### Drawing, schedule과 quantity projection {#interior-space-drawing-schedule-quantity}

<!-- @evidence requirements/interior/deliverables-and-quantities.md#interior-deliverables-quantities Requires all deliverables to derive from one resolved interior. -->
<!-- @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Requires plan, reflected ceiling, section, elevation, and discipline views. -->
<!-- @evidence requirements/interior/deliverables-and-quantities.md#interior-schedules Requires schedules to reconcile with occurrence identities. -->
<!-- @evidence requirements/interior/deliverables-and-quantities.md#interior-quantities-waste Requires area, length, count, assembly, cut, and waste basis. -->

Drawing view는 cut plane, projection direction, reflected-ceiling convention, scale, discipline, phase·alternative, spatial·element filter와 annotation target을 입력으로 받고 canonical linework, region, opening mark, dimension, note와 gap을 출력한다. Schedule은 같은 resolved identities를 type별로 묶고 row count 합이 occurrence total과 일치해야 하며 bounded member sample 뒤 omitted count를 기록한다. Quantity는 unit, scope, inclusion·deduction, exact·approximate basis, owner, pattern whole·cut consumption, joint, waste와 hidden assembly layer를 함께 제공한다. 별도 손작성 sheet나 BOM을 source of truth로 역승격하지 않으며 stale target, unmeasured opening, faceted volume, missing assembly 또는 unsupported material take-off는 zero가 아니라 gap으로 남긴다.

### Capture provenance와 deliverable consistency {#interior-space-capture-deliverable-consistency}

<!-- @evidence requirements/interior/deliverables-and-quantities.md#interior-capture-provenance Requires captures to identify the exact source state and settings. -->
<!-- @evidence requirements/interior/deliverables-and-quantities.md#interior-deliverable-consistency Requires drawings, quantities, renders, and schedules to agree by identity. -->

Render, guide pass, drawing, schedule, quantity, analysis와 comparison은 design digest, phase·alternative·state, asset closure, representation, camera 또는 view, settings, generation time와 producer identity를 가진 manifest에 결속되어야 한다. 서로 다른 output은 동일 identity에 대해 geometry, count, opening state, finish region과 quantity가 일치해야 하며 표현 단순화와 measurement truth를 구분한다. Source나 setting이 바뀌면 이전 artifact와 review를 보존하되 stale로 표시하고 current package에 섞지 않는다. Digest 부재, 다른 revision의 capture, 빈 proxy를 final로 표시하는 행위와 sheet·render 불일치를 한쪽 덮어쓰기로 해소하는 행위는 failure다.

### 계층화된 validation과 진단 {#interior-space-layered-validation-diagnostics}

<!-- @evidence requirements/interior/validation-and-iteration.md#interior-validation-iteration Requires repeatable correction and rerun cycles. -->
<!-- @evidence requirements/interior/validation-and-iteration.md#interior-geometry-topology-validation Requires geometry and topology checks. -->
<!-- @evidence requirements/interior/validation-and-iteration.md#interior-host-storey-validation Requires host, mass, area, and level coordination checks. -->
<!-- @evidence requirements/interior/validation-and-iteration.md#interior-placement-usability-validation Requires support, collision, clearance, and operation checks. -->
<!-- @evidence requirements/interior/validation-and-iteration.md#interior-validation-twins Requires positive, negative, and boundary cases. -->
<!-- @evidence requirements/interior/validation-and-iteration.md#interior-addressable-diagnostics Requires stable rule, target, path, observation, and remedy. -->
<!-- @evidence requirements/interior/validation-and-iteration.md#interior-validation-scope-freshness Requires validation scope and freshness. -->
<!-- @evidence requirements/interior/validation-and-iteration.md#interior-visual-review-reproduction Requires reproducible visual review after source correction. -->
<!-- @evidence requirements/interior/validation-and-iteration.md#interior-validation-status Requires passed, failed, unsupported, not-run, unknown, and out-of-scope states. -->
<!-- @evidence requirements/building-exterior/validation-and-interior-consistency.md#building-exterior-validation Requires linked interior checks without replacing either side's own validation. -->

Validation은 구조, geometry·topology, shared host·level·boundary, relation·support, placement·collision·clearance, service·wet, domain analysis, deliverable reconciliation와 actual visual review를 분리된 layer로 실행해야 한다. 각 run은 input revision·scope·representation·tolerance·check version·time을 기록하고 finding은 stable rule id, severity, target identity, source path, location, expected, observed, consequence와 remedy를 가진다. 주요 invariant는 positive, 단일 조건을 깨뜨린 negative twin과 허용 경계 사례로 검증하며 source 수정 뒤 동일 조건을 fresh run과 capture로 재현한다. 일부 layer 통과, 보이지 않는 geometry, 오래된 capture와 미실행 solver를 전체 pass로 승격하지 않고 status를 `passed`, `failed`, `unsupported`, `not-run`, `unknown`, `out-of-scope`로 보존한다.
