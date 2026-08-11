# 생태, 날씨와 달력

## 생태와 환경 시간의 상태 {#world-site-ecology-weather-state}

<!-- @evidence requirements/map/vegetation-and-ecology.md#map-vegetation-ecology Defines ecology from authored evidence rather than a shipped species catalogue. -->
<!-- @evidence requirements/map/weather-and-seasons.md#map-weather-seasons Defines weather and season as time-scoped site state. -->

시스템은 식생 구조, habitat 관계, 환경 조건, 달력과 날씨를 canonical site state의 서로 연결된 층으로 표현한다. 종, 군집, 기후대와 계절 명칭은 열린 사용자 어휘이며, 시스템은 특정 장소의 식생 목록이나 기후 자료를 내장하지 않는다. 파생된 모습과 분석은 동일한 시각, 공간 범위, 출처와 revision을 공유한다.

### 식생 층과 형태 입력 {#world-site-vegetation-layer-form-input}

<!-- @evidence requirements/map/vegetation-and-ecology.md#map-vegetation-layers-form Requires canopy, understory and ground layers with explicit form. -->
<!-- @evidence requirements/map/vegetation-and-ecology.md#map-vegetation-individual-cluster Requires stable individuals and deterministic bounded populations. -->

식생 입력은 층, 높이 범위, 밀도, extent, 개체 또는 cluster identity, 형태 규칙, seed와 배치 제약을 선언한다. 개별 식생은 추적 가능한 feature이고 군집은 seed와 슬롯 순서로 재현되는 bounded population이며, 손으로 복제한 좌표 목록만을 생태 관계로 간주하지 않는다. 요청 수량이 간격·범위·예산 안에 들어가지 않으면 겹쳐 넣지 않고 거부된 수를 출력한다.

### 지형·물과 habitat 관계 {#world-site-vegetation-habitat-relation}

<!-- @evidence requirements/map/vegetation-and-ecology.md#map-vegetation-terrain-water Requires planting to cite its support, moisture and water relation. -->
<!-- @evidence requirements/map/vegetation-and-ecology.md#map-habitat-ecological-relations Requires explicit habitat, corridor and dependency relations. -->

식생 배치는 지지 표면, 고도·경사 범위, 토양 또는 피복, 수분·관수, 침수 허용과 필요한 경우 물 domain을 참조한다. habitat, 완충 구역, 이동 corridor, 먹이·차폐·경쟁 관계는 방향과 유효 phase를 가진 graph이며 보이는 근접성만으로 자동 확정하지 않는다. 지지 feature가 사라지거나 물 상태가 허용 범위를 벗어나면 관련 식생과 habitat 판정은 stale 또는 부적합으로 전이한다.

### 생장, 계절과 교란 {#world-site-growth-season-disturbance}

<!-- @evidence requirements/map/vegetation-and-ecology.md#map-vegetation-season-growth Requires growth and seasonal appearance to be deterministic state. -->
<!-- @evidence requirements/map/vegetation-and-ecology.md#map-vegetation-disturbance-recovery Requires disturbance, removal and recovery to preserve lineage. -->

생장 단계, 잎 상태, 개화, 휴면과 사용자 정의 계절 모습은 식생 identity에 결속된 시간 상태이고 같은 단계와 seed에서 같은 구조를 낸다. 벌채, 화재, 침수, 병해, 공사 교란과 복구는 원래 feature를 삭제해 잊는 대신 사건, 영향 범위, 시작·종료, 잔존 상태와 successor lineage를 기록한다. 연속 생장과 불연속 교란 사이를 임의 보간하지 않는다.

### 생태 결손과 지원 한계 {#world-site-ecology-gap-limit}

<!-- @evidence requirements/map/vegetation-and-ecology.md#map-ecology-gap Requires missing evidence and unsupported ecological inference to remain visible. -->

분류, 조사 시각, 공간 범위, 지지 관계나 환경 조건이 부족하면 시스템은 미확인 식생 또는 미해결 habitat 관계로 보존한다. 제공된 형태 규칙으로 식생을 표현할 수 있어도 생존성, 천이, 생물다양성, 위해성이나 법적 보호 상태를 전문적으로 판정했다고 주장하지 않으며, 그런 결과는 출처가 있는 외부 분석으로만 연결한다.

### 달력, 시간과 천체 입력 {#world-site-calendar-time-celestial-input}

<!-- @evidence requirements/map/weather-and-seasons.md#map-calendar-time-celestial-state Requires calendar, timezone, epoch and celestial state to be explicit. -->
<!-- @evidence requirements/map/temporal-change.md#map-state-validity-phase-order Keeps environmental instants ordered on the production timeline. -->

환경 시간 입력은 제작 epoch, 달력 체계, 날짜·시각, timezone 또는 offset, 계절 명명 규칙과 샘플 순서를 명시한다. 태양·달 방향과 조도 같은 천체 상태는 사용자가 제공하거나 출처 있는 derivation으로 계산되며, 좌표 위치와 시간 해석이 빠진 상태에서 시스템이 임의의 장소를 선택하지 않는다. 동일 시각의 모든 환경 소비자는 하나의 resolved instant를 참조한다.

### 계절과 공간별 날씨 {#world-site-season-spatial-weather}

<!-- @evidence requirements/map/weather-and-seasons.md#map-season-climate-context Requires declared seasonal and climate context without bundled climate content. -->
<!-- @evidence requirements/map/weather-and-seasons.md#map-weather-spatial-variation Requires local weather zones and transitions to be explicit. -->

계절과 기후 context는 사용자 정의 label, 기간, 출처, 대표성 및 불확실성을 가지며 특정 기후대 preset에 의존하지 않는다. 기온, 습도, 바람, 강수, 안개, 구름과 적설은 site 전체 값 또는 경계가 있는 zone별 값으로 선언되고, zone 사이 전이는 명시된 보간 또는 불연속 규칙을 따른다. coverage 밖의 값을 가장 가까운 zone에서 자동 복제하지 않는다.

### 날씨 샘플링과 표면 결과 {#world-site-weather-sampling-consequence}

<!-- @evidence requirements/map/weather-and-seasons.md#map-weather-temporal-sampling Requires deterministic temporal sampling and discontinuity handling. -->
<!-- @evidence requirements/map/weather-and-seasons.md#map-weather-surface-consequence Requires wetness, snow, ice and visibility consequences to cite weather state. -->

날씨 상태는 절대 시각 또는 고정된 시간 표본으로 질의되고, 같은 입력과 시각에서 같은 값을 출력한다. 비·눈·결빙·건조·바람과 안개의 결과는 지표 피복, 수문, 식생, 이동 비용, 가시 거리와 외관에 dependency를 생성하지만, 지원된 물리 관계만 파생한다. 장식 입자나 색 변화만 있는 효과는 실제 적설 깊이, 미끄럼 또는 유량 변화로 보고하지 않는다.

### 연속성, 출처와 예보 거부 {#world-site-weather-continuity-source-refusal}

<!-- @evidence requirements/map/weather-and-seasons.md#map-weather-film-continuity Requires shots sharing an instant to share environmental state. -->
<!-- @evidence requirements/map/weather-and-seasons.md#map-weather-source-uncertainty Requires weather provenance, confidence and validity interval. -->
<!-- @evidence requirements/map/weather-and-seasons.md#map-weather-forecast-refusal Prevents authored scenarios from being presented as forecasts. -->

같은 서사 시각과 장소를 공유하는 shot은 동일한 날씨 revision을 읽고, 의도된 변화는 사건 또는 시간 곡선으로 명시한다. 관측, 재분석, 외부 예보와 창작 시나리오는 출처 종류, 발행 시각, 유효 기간, 위치, 불확실성과 license를 보존한다. 유효 기간이 지난 자료나 창작 상태를 현재의 실제 예보로 출력하지 않으며, 예보 기능이 없는 경우 요청을 지원되지 않은 분석으로 거부한다.
