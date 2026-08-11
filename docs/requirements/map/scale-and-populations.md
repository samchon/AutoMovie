# 축척과 반복 Population

## 광역 규모의 bounded multiplicity {#map-bounded-populations}

숲, 농경지, 군대, 건물군, 차량, 가로등, 포장과 잔해처럼 많은 요소는 compact rule, representative model, spatial partition과 budget으로 저작할 수 있어야 한다.

### 규모별 표현 {#map-scale-representation}

멀리서는 mass나 population으로, 가까이서는 group과 instance로 표현할 수 있으나 story-relevant identity, 위치와 상태가 level change에서 사라지지 않아야 한다.

### Population bound {#map-population-bound}

Generated count, visible count, simulation count, collision count와 evidence sample count를 구분하여 모든 비싼 연산의 최대 population을 선언하고 보고해야 한다.

### 공간 partition {#map-spatial-partition}

Region, tile, cell, corridor와 view range로 작업 범위를 나누되 경계에서 geometry, path, water, pattern와 identity가 불연속이 되지 않아야 한다.

### 결정론적 density {#map-deterministic-density}

Density, exclusion, clustering과 variation은 stable seed와 local coordinate를 사용하여 관련 없는 map 변경이 기존 population을 임의로 다시 섞지 않게 해야 한다.
