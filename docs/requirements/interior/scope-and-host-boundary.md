# 범위와 Host 경계

## 실제 외장 안에서 성립하는 Interior {#interior-host-bounded-scope}

Interior는 연결된 building exterior의 footprint, storey, level, envelope thickness, opening, shaft와 roof 또는 floor boundary 안에서 실제 치수로 성립해야 한다. 촬영 편의를 위한 벽 제거와 set extension은 원래 공간을 몰래 확대하지 않고 별도의 filming state로 표현해야 한다.

Building mass, site contact, 건축면적과 연면적, storey elevation, floor-to-floor height, structural depth, core, shaft, facade·roof opening와 envelope extent는 exterior가 소유하는 host constraint다. Interior가 계산한 net area, clear height와 finish build-up은 그 constraint 안에서 성립해야 하며 서로 다른 정의의 면적이나 level datum을 같은 값으로 취급하지 않아야 한다.

### 현재 제품 범위 {#interior-current-product-scope}

MCP knowledge and evidence boundary는 building interior의 저작 계약, current host evidence와 검토 결과를 저작 에이전트에게 제공한다. 선박, 항공기와 우주선 같은 다른 host의 내부는 같은 공간 원리를 설명하는 예가 될 수 있지만 현재 MCP 지원을 약속하지 않는다.

AutoMovie는 interactive editor가 아니라 project source를 저작 에이전트가 수정하고 결정적으로 compile, inspect, render와 review하는 시스템이다. MCP는 source를 직접 쓰는 저작 API가 아니라 계약과 host-produced evidence의 경계다. 요구 능력은 화면 조작 widget이 아니라 에이전트가 명시적으로 선택할 수 있는 authoring freedom, stable identity, bounded execution과 재현 가능한 evidence로 관찰되어야 한다.

### Host Identity {#interior-host-identity}

각 interior는 자신을 제한하는 building, storey, mass, envelope와 opening의 identity를 참조하고, 같은 외관에 연결되지 않은 독립 stage set는 그 scope와 가상 boundary를 명시해야 한다.

각 identity는 이름이나 배열 순서와 독립적이어야 하며 unit, origin, axis convention, local-to-building transform와 revision을 가져야 한다. 여러 도면, reference image와 imported asset의 좌표를 결합하면 대응점, transform, residual error와 unresolved conflict를 기록해야 한다.

### Exterior가 없는 Interior {#interior-without-exterior}

Interior-only set를 저작할 수 있으나 외장 면적, 층고와 창밖 맥락을 검증했다고 주장하지 않는다. 가상 외피, 허용 extent와 출입 경계를 별도로 선언해야 한다.

### Scope 밖 추정의 거부 {#interior-scope-refusal}

보이지 않는 room, 구조, service, 인접 층과 외관을 자동으로 완성된 사실처럼 만들지 않으며 unknown, omitted와 intentionally absent를 구분해야 한다.

Input observation, measured or transformed value, inferred hypothesis, user-confirmed fact와 design decision을 구분하고 source region, confidence와 confirmation history를 추적해야 한다. Reference image와 render의 유사성만으로 host dimension, hidden assembly 또는 exterior consistency를 검증했다고 주장하지 않아야 한다.
