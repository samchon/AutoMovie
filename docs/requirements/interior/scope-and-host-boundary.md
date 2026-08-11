# 범위와 Host 경계

## 실제 외장 안에서 성립하는 Interior {#interior-host-bounded-scope}

Interior는 연결된 building exterior의 footprint, storey, level, envelope thickness, opening, shaft와 roof 또는 floor boundary 안에서 실제 치수로 성립해야 한다. 촬영 편의를 위한 벽 제거와 set extension은 원래 공간을 몰래 확대하지 않고 별도의 filming state로 표현해야 한다.

### 현재 제품 범위 {#interior-current-product-scope}

`automovie-mcp`는 building interior의 저작과 검증을 지원한다. 선박, 항공기와 우주선 같은 다른 host의 내부는 같은 공간 원리를 설명하는 예가 될 수 있지만 현재 MCP 지원을 약속하지 않는다.

### Host Identity {#interior-host-identity}

각 interior는 자신을 제한하는 building, storey, mass, envelope와 opening의 identity를 참조하고, 같은 외관에 연결되지 않은 독립 stage set는 그 scope와 가상 boundary를 명시해야 한다.

### Exterior가 없는 Interior {#interior-without-exterior}

Interior-only set를 저작할 수 있으나 외장 면적, 층고와 창밖 맥락을 검증했다고 주장하지 않는다. 가상 외피, 허용 extent와 출입 경계를 별도로 선언해야 한다.

### Scope 밖 추정의 거부 {#interior-scope-refusal}

보이지 않는 room, 구조, service, 인접 층과 외관을 자동으로 완성된 사실처럼 만들지 않으며 unknown, omitted와 intentionally absent를 구분해야 한다.
