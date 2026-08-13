# 시각 변경 보고

## Digest catalog 비교

### Revision snapshot 계약 {#review-system-visual-revision-snapshot}

<!-- @evidence requirements/review/visual-change-reporting.md#review-visual-change-catalog-identity 비교가 받아들이는 catalog, revision, 주체, view, digest identity를 정의한다. -->
<!-- @evidence requirements/review/visual-change-reporting.md#review-visual-change-digest-reuse 형식이 잘못되었거나 모호한 snapshot을 비교 전에 거부하도록 요구한다. -->

시각 revision snapshot은 비어 있지 않은 revision identity, 비어 있지 않은 catalog identity, 그리고 0개 이상의 주체-view record를 가진다. 각 record는 비어 있지 않은 주체 문자열과 view 문자열, 그리고 소문자 16진수 64자리를 가진 `sha256:` digest 하나를 가진다. 생성자는 view identity가 대표하는 관측 기준을 revision을 가로질러 고정하고, viewpoint, 시각, pass 또는 표현 조건이 바뀌면 다른 identity를 발행한다. 순서쌍 `(subject, view)`는 하나의 snapshot 안에서 유일하다. 입력 순서는 의미를 갖지 않으며 비교는 두 snapshot을 어느 쪽도 변경하지 않는다.

두 snapshot은 같은 catalog identity를 가져야 한다. 이 동일성은 두 모집단이 비교 가능하다는 호출자의 선언이며, 그것이 catalog를 납품 검토 표면으로 만들거나 그 view가 어떻게 생성되었는지를 정의하지는 않는다.

### 결정론적 4상태 비교 {#review-system-visual-change-states}

<!-- @evidence requirements/review/visual-change-reporting.md#review-visual-change-four-states changed, unchanged, new, gone의 남김 없는 분류를 정의한다. -->

비교는 두 snapshot의 주체-view identity 합집합을 만들고, 주체를 먼저 view를 나중에 두어 code unit 순서로 정렬한다. 양쪽 snapshot에 모두 있는 identity는 digest가 같으면 `unchanged`, 다르면 `changed`이다. 나중 snapshot에만 있으면 `new`, 이전 snapshot에만 있으면 `gone`이다. 보고는 각 항목에 이전과 이후 digest를 담고 없는 쪽에는 `null`을 담으며, 네 개수의 합은 반환된 전체 항목 모집단과 같다.

`unchanged` 항목은 결과에서 걸러지지 않는다. 개수와 항목 목록 양쪽에 남아, 아직 작업이 닿지 않은 표면을 진행 사실로 읽을 수 있게 한다.

### 기존 digest 실행 경계 {#review-system-visual-change-digest-boundary}

<!-- @evidence requirements/review/visual-change-reporting.md#review-visual-change-digest-reuse byte를 다시 render, decode, 읽기, hash하지 않고 기존 image identity를 재사용한다. -->

비교는 snapshot record에 대한 순수 fold이다. filesystem, renderer, decoder, image, camera, 주체 resolve, hash 연산을 전혀 수행하지 않는다. 공급된 digest가 그것이 주장하는 byte를 가리킨다는 증명 책임은 생성자에게 남는다.

### 증거 및 구조 diff와의 분리 {#review-system-visual-change-evidence-separation}

<!-- @evidence requirements/review/visual-change-reporting.md#review-visual-change-evidence-boundary 진행 보고를 검토 freshness, 완료, 품질, 구조 변경과 분리한 채로 유지한다. -->
<!-- @evidence requirements/review/visual-change-reporting.md#review-visual-change-catalog-identity 납품 모집단과 조사 모집단을 각자의 catalog identity로 구별한다. -->

보고는 검토 판정, criterion, receipt, freshness 상태, 완료 주장을 담지 않는다. 그 status는 오직 소속 여부와 byte digest 동일성만을 기록한다. 또한 구조적 이동이나 형상 범주도 담지 않는다. 모델에서 무엇이 바뀌었는지를 알아야 할 때 호출자는 compiled 주체 구조 diff를 쓰고, 어떤 render된 관측이 바뀌었는지를 알아야 할 때 이 보고를 쓴다.
