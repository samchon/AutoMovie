# 허용오차와 의도된 불완전성

## Group 안에서 상관되는 미세 변주 {#interior-tolerances-imperfections}

Tile field, plank run, masonry, panel, furniture set와 handmade assembly는 완전 반복뿐 아니라 group이 공유하는 bounded variation rule로 미묘한 misalignment, rotation, elevation, joint width, gap, color, roughness와 wear 차이를 표현할 수 있어야 한다.

### 사용자 소유의 변주 의도 {#interior-imperfection-authoring-choice}

어느 group에 어떤 오차를 얼마나 허용할지는 사용자와 MCP knowledge and evidence boundary를 통해 계약과 current evidence를 받는 저작 에이전트가 선택해야 한다. 제품은 parameter와 검증을 제공하고 “현실적으로 보인다”는 이유로 임의 noise를 자동 적용하지 않아야 한다.

### 서로 다른 오차의 의미 {#interior-tolerance-kinds}

Numeric comparison tolerance, survey uncertainty, material dimension range, fabrication tolerance, installation tolerance, accumulated movement와 authored aesthetic variation을 별도 값과 unit로 유지해야 한다. 한 종류의 허용 범위를 키워 geometry defect를 숨기거나 의도된 misalignment를 floating-point noise로 제거하지 않아야 한다.

### Seed Hierarchy {#interior-imperfection-seed-hierarchy}

Project, assembly, group, row·course, cluster와 instance seed의 파생 관계를 명시하여 한 group 안의 상관된 경향과 개별 편차를 함께 만들고 관련 없는 변경으로 기존 결과가 다시 섞이지 않게 해야 한다.

Generator와 algorithm version, stable stream key, distribution, clamp, correlation length와 channel composition order를 함께 기록해야 한다. Group의 shared error와 instance-local deviation, grout 또는 gap의 누적 drift와 rare bounded outlier를 같은 독립 난수로 축약하지 않아야 한다.

### 허용오차 Channel {#interior-tolerance-channels}

Position, orientation, scale, level, bow, joint, grout, edge, color와 surface property variation을 독립 channel과 unit, distribution, clamp, correlation과 exclusion으로 선언할 수 있어야 한다.

### Pattern과 경계 보존 {#interior-imperfection-boundaries}

미세 변주 뒤에도 module count, host coverage, opening cut, border, corner, minimum piece, support, collision, waterproofing와 required clearance가 성립해야 한다.

### 정본과 수량 {#interior-imperfection-canonical-result}

최종 instance transform, joint geometry, cut, material state와 waste는 resolved seeded result에서 산출하고 nominal pattern과 실제 배치 수량을 같은 값으로 취급하지 않아야 한다.

Fabrication과 installation tolerance의 stack-up은 datum, assembly order와 combination method를 밝혀야 하고 resolved result가 exterior opening, waterproofing, support, clearance, route와 quantity에 미치는 consequence를 다시 계산해야 한다.

### 오차 거부 {#interior-imperfection-refusal}

Tolerance 밖 변위, 닫히지 않은 surface, 겹친 tile, 음수 joint, drain·opening 침범, floating piece와 budget 초과를 aesthetic variation으로 숨기지 않아야 한다.
