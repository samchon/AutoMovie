# 토지, 정착지와 공공 공간

## 토지와 장소의 상태 {#world-site-land-place-state}

### 필지 경계 provenance와 topology {#world-site-parcel-boundary-topology}

<!-- @evidence requirements/map/parcels-and-land-use.md#map-parcels-land-use Defines parcels and land use as sourced spatial state. -->
<!-- @evidence requirements/map/settlements-and-urban-form.md#map-settlement-urban-form Defines settlement form without shipping a settlement catalogue. -->
<!-- @evidence requirements/map/parks-and-public-space.md#map-parks-public-space Defines public space through function, access and state. -->

시스템은 필지, 토지 이용, 권리 overlay, 정착지 hierarchy와 도시 형태, 공원과 공공 공간을 서로 참조하는 stable feature로 표현한다. 특정 국가의 지적 체계, 용도지역 명칭, 도시 시대나 공원 시설을 내장하지 않고 사용자 어휘, 출처, 유효 시각과 공간 관계를 보존한다. 법적 주장과 물리적 표현은 별도 상태다.

<!-- @evidence requirements/map/parcels-and-land-use.md#map-parcel-boundary-provenance Requires surveyed, interpreted and illustrative boundaries to remain distinguishable. -->
<!-- @evidence requirements/map/parcels-and-land-use.md#map-parcel-boundary-topology Requires parcels to close, share edges consistently and expose gaps or overlaps. -->

필지 경계는 출처, 조사 또는 해석 방법, 좌표 기준, 유효 시각, 정확도와 법적·비법적 성격을 가진다. polygon은 닫히고 self-intersection이 없어야 하며, 인접 경계는 허용 공차 안에서 같은 edge를 공유하거나 의도된 gap·overlap으로 분류된다. 그림용 경계나 불확실한 해석을 확정 지적선으로 출력하지 않는다.

### 토지 이용과 물리 관계 {#world-site-land-use-physical-relation}

<!-- @evidence requirements/map/parcels-and-land-use.md#map-land-use-state Requires existing, proposed, permitted and temporary uses to be phased. -->
<!-- @evidence requirements/map/parcels-and-land-use.md#map-land-use-physical-relation Requires land-use claims to reference physical sites without becoming geometry. -->

토지 이용은 적용 feature 또는 extent, 상태 종류, 시작·종료, 출처와 open classification을 가진다. 기존, 제안, 허가, 임시와 폐지 상태는 동시에 비교할 수 있지만 한 시각의 canonical alternative는 하나여야 한다. 용도는 건물·식생·도로·물 같은 물리 feature를 참조할 수 있으나 그 geometry나 존재를 대신하지 않는다.

### 권리 overlay와 용량 {#world-site-land-right-capacity}

<!-- @evidence requirements/map/parcels-and-land-use.md#map-land-rights-overlays Requires easements, restrictions and rights to retain source and precedence. -->
<!-- @evidence requirements/map/parcels-and-land-use.md#map-land-use-capacity Requires capacity claims to state measure, assumptions and support level. -->

easement, 접근권, 보호구역, setback과 사용자 정의 제한은 독립 overlay identity, 출처, 우선순위, 유효 기간과 대상 feature를 가진다. 면적, 밀도, 수용 인원과 개발 가능량은 계산 geometry, 단위, 포함 규칙과 가정을 출력한다. 시스템은 명시된 규칙을 평가할 수 있으나 외부 법령이나 허가 기준을 자동으로 안다고 주장하지 않는다.

### 필지 충돌과 실패 {#world-site-parcel-conflict-failure}

<!-- @evidence requirements/map/parcels-and-land-use.md#map-parcel-conflict Requires overlapping claims and incompatible uses to remain diagnosable. -->

서로 배타적인 canonical 용도, 우선순위가 없는 충돌 overlay, 중복 parcel identity, 닫히지 않은 경계와 출처 revision 불일치는 자동 병합하지 않는다. 출력은 충돌 feature, 겹치는 extent, 관련 출처, 시각과 필요한 사용자 결정을 포함하며, 결정 전 파생 면적·용량·배치 산출물은 current로 내보내지 않는다.

### 정착지 기능과 hierarchy {#world-site-settlement-function-hierarchy}

<!-- @evidence requirements/map/settlements-and-urban-form.md#map-settlement-place-functions Requires authored functions and service relations for named places. -->
<!-- @evidence requirements/map/settlements-and-urban-form.md#map-settlement-hierarchy Requires containment and network hierarchy among settlement units. -->

정착지, district, neighborhood, block과 사용자 정의 place는 기능, 중심 또는 extent, parent·child 관계, 연결 network와 service dependency를 가진다. hierarchy는 cycle이 없어야 하고 각 feature는 같은 시각에 모순되지 않는 하나의 canonical parent 관계를 가진다. 크기나 명칭만으로 village, city 또는 역사 지구 같은 종류를 추론하지 않는다.

### 밀도, skyline과 반복 {#world-site-density-skyline-repetition}

<!-- @evidence requirements/map/settlements-and-urban-form.md#map-density-skyline Requires density and skyline to cite measurable extents and viewpoints. -->
<!-- @evidence requirements/map/settlements-and-urban-form.md#map-settlement-repetition Requires deterministic bounded repetition instead of authored duplication. -->

밀도는 분자 집단, 분모 면적·체적, 시각, 포함 기준과 해상도를 가지며 skyline은 관찰 위치·방향, horizon 범위, 차폐 geometry와 revision을 포함한다. 반복 건물, 필지, 시설과 가로 요소는 prototype, seed, 배치 법칙, variation과 상한으로 파생되고 같은 입력에서 같은 슬롯을 낸다. proxy 반복을 개별 역사 자산이나 법적 필지로 오인하지 않는다.

### 성장, 쇠퇴와 기반 관계 {#world-site-settlement-change-infrastructure-relation}

<!-- @evidence requirements/map/settlements-and-urban-form.md#map-settlement-growth-decline Requires expansion, contraction and vacancy to preserve phases and lineage. -->
<!-- @evidence requirements/map/settlements-and-urban-form.md#map-settlement-terrain-service-relation Requires settlement form to cite terrain, transport, water and utilities. -->

확장, 합병, 분할, 쇠퇴, 공실, 철거와 재개발은 place identity의 phase 또는 successor lineage로 기록된다. 정착지 상태는 지형 수용력, 물, 교통 접근과 설비 dependency를 참조하며 관련 기반 상태가 바뀌면 downstream 적합성과 산출물이 stale이 된다. 인구·수요 model이 없으면 보이는 건물 수만으로 성장률이나 서비스 충분성을 계산하지 않는다.

### 정착지 콘텐츠 경계 {#world-site-settlement-content-boundary}

<!-- @evidence requirements/map/settlements-and-urban-form.md#map-settlement-content-boundary Prevents system capability from becoming prebuilt historical or regional content. -->

시스템은 장소 identity, 형태, 관계, population과 변화 규칙을 제공하지만 특정 시대의 도시, 랜드마크, 건축 catalog, street furniture 또는 주민 구성을 공급하지 않는다. 예시는 형식과 검증 방법만 가르치고 재사용 가능한 완성 장소를 배포하지 않으며, 외부 또는 사용자 자산은 provenance가 있는 입력으로만 등장한다.

### 공공 공간 zone과 접근 {#world-site-public-space-zone-access}

<!-- @evidence requirements/map/parks-and-public-space.md#map-public-space-zones Requires functional zones and ownership to be addressable. -->
<!-- @evidence requirements/map/parks-and-public-space.md#map-public-space-circulation-access Requires entrances, paths and accessible routes to join wider networks. -->

공원, 광장, 보행 공간과 기타 public space는 extent, 관리 또는 이용 identity, 기능 zone, 출입구와 내부 route를 가진다. 출입구는 외부 도로·path·교통 node와 연결되고, 접근 가능한 route는 traveler envelope, 경사, 폭, 표면과 시간 상태로 검증된다. 열린 공간처럼 보인다는 이유로 공공 접근권이나 무장애성을 추론하지 않는다.

### 시설, 행사와 일상 상태 {#world-site-public-facility-event-state}

<!-- @evidence requirements/map/parks-and-public-space.md#map-public-space-facilities Requires facilities to cite support, service, clearance and ownership. -->
<!-- @evidence requirements/map/parks-and-public-space.md#map-public-space-events Requires event overlays to declare temporary layout and capacity. -->
<!-- @evidence requirements/map/parks-and-public-space.md#map-public-space-routine-event-state Requires routine and event states to share one canonical place. -->

시설, 가구, 조명, 놀이·운동 요소와 사용자 정의 설치물은 지지 surface, 점유·유지보수 clearance, 설비 dependency와 stable identity를 가진다. 행사 상태는 기간, 점유 zone, 임시 route·폐쇄·시설·population과 원상복구 상태를 선언한다. 일상과 행사는 같은 공공 공간의 alternative state이며, 임시 geometry를 영구 정본에 복제하지 않는다.

### 공원과 자연 범위의 구별 {#world-site-park-nature-distinction}

<!-- @evidence requirements/map/parks-and-public-space.md#map-park-nature-distinction Separates managed public-space state from ecological classification. -->

관리 공원 zone과 habitat·식생·수문 feature는 서로 참조할 수 있지만 같은 분류가 아니다. 관리 상태나 public access 변경은 생태 feature를 삭제하지 않고, 생태 보호 또는 위험 상태는 public route의 접근 상태에 dependency로 작용한다. 어느 쪽 자료가 없는 경우 시스템은 외관만으로 다른 쪽의 존재나 법적 성격을 만들어내지 않는다.
