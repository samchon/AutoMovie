# 시각 변경 보고

## Revision 간 시각 진행

### 안정된 시각 catalog identity {#review-visual-change-catalog-identity}

사용자는 같은 시각 catalog의 두 revision을 비교할 수 있어야 한다. catalog의 모든 항목은 하나의 안정된 주체 identity, 하나의 안정된 view identity, 그리고 이미 생성된 image byte의 정확한 digest를 가져야 한다. view identity는 revision을 가로질러 하나의 관측 기준을 유지해야 하며, 여기에는 해당 viewpoint, 시각, pass와 표현 조건이 포함된다. 그 기준이 바뀌면 다른 view identity를 써야 한다. 하나의 revision snapshot 안에서 주체-view 쌍은 많아야 한 번 나타나야 하고, 이름이 다른 두 catalog를 같은 관측 집합인 것처럼 비교해서는 안 된다.

catalog는 납품 검토 view를 서술할 수도 있고 별도로 생성한 조사 집합을 서술할 수도 있다. catalog는 camera를 만들지 않고, frame을 render하지 않으며, 프로덕션이 어떤 view를 선언해야 하는지 결정하지 않는다.

### 네 가지 명시적 변경 상태 {#review-visual-change-four-states}

두 revision 중 어느 한쪽에라도 존재하는 모든 주체-view identity에 대해, 비교는 `changed`, `unchanged`, `new`, `gone` 중 정확히 하나를 보고해야 한다. 양쪽에 공통인 identity는 image byte digest가 정확히 같을 때만 `unchanged`이고 그렇지 않으면 `changed`이다. 나중 revision에만 있는 identity는 `new`이고, 이전 revision에만 있는 identity는 `gone`이다.

보고는 unchanged 항목을 포함해 모든 항목을 보존해야 하며, 결정론적 순서와 네 상태 각각의 정확한 개수를 돌려주어야 한다.

`unchanged`는 누락이 아니라 사실이다. 바뀌지 않은 view의 집합은 어떤 표면이 이전 revision 이후 아무 작업도 받지 않았는지를 말하며, 바뀐 집합과 동등한 무게로 읽을 수 있어야 한다. 따라서 unchanged 항목을 생략하거나 요약에서 빼는 표현은 이 요구사항을 만족하지 못한다.

### digest 재사용과 revision 무결성 {#review-visual-change-digest-reuse}

비교는 render 또는 조사 경로가 이미 생성한 digest를 소비해야 한다. image byte를 다시 render하거나 decode하거나 hash해서는 안 된다. 비어 있는 revision, catalog, 주체, view identity와 형식이 잘못된 digest, 그리고 중복된 주체-view identity는 조용히 정규화하거나 덮어쓰지 말고 거부해야 한다.

### 진행은 검토 증거가 아니다 {#review-visual-change-evidence-boundary}

시각 변경 보고는 진행과 provenance에 관한 사실이며, 어떤 view가 옳거나 최신이거나 완전하거나 검토되었다는 증명이 아니다. `unchanged`는 그 자체로 판정을 보존하지 않고, `changed`는 개선이나 퇴행을 뜻하지 않는다. 납품 검토 증거와 조사 산출물은 같은 비교 알고리즘으로 요약될 수 있더라도 서로 구별된 채로 남는다.

소스가 바뀌었다는 것과 산출물이 바뀌었다는 것은 다른 사실이다. 저작 측이 서술한 진행은 대응하는 view의 digest가 실제로 움직였다는 사실을 대체하지 못하며, 시각 변경 보고는 그 두 사실을 구별하기 위해 존재한다.

구조적 주체 diff와 시각 변경 보고는 서로 다른 질문에 답한다. 어느 쪽도 다른 쪽의 대체물로 제시되어서는 안 된다.
