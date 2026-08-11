# 세계와 사이트 시스템 사양

<!-- @evidence requirements/map/README.md#맵과-세계-요구사항 세계와 site의 좌표, 지형, 수계, 이동과 시간 상태 약속을 시스템 계약으로 정밀화한다. -->

## 시스템 경계 {#world-site-system-boundary}


이 폴더는 사용자가 제공한 공간 근거와 제작 의도를 좌표, 지형, 물, 생태, 기반 시설, 토지, 이동, 시간, 표현 단계와 검증 상태가 서로 모순 없이 참조하는 하나의 세계·사이트 정본으로 해석하는 시스템 계약을 정의한다. 시스템은 특정 시대, 지역, 기후, 식생 종, 도로 형식이나 정착지 자산을 미리 제공하지 않으며, 입력으로 선언되지 않은 전문 지식이나 분석 결과를 지어내지 않는다.

## 계약 색인 {#world-site-contract-index}


- [공간 기준과 identity](./spatial-reference-and-identity.md)
- [지형, 지반과 지질](./terrain-ground-and-geology.md)
- [수문, 해안과 지하수](./hydrology-coast-and-groundwater.md)
- [생태, 날씨와 달력](./ecology-weather-and-calendar.md)
- [교통, 횡단부와 설비](./transport-crossings-and-utilities.md)
- [토지, 정착지와 공공 공간](./land-settlements-and-public-space.md)
- [이동과 가시성](./traversal-and-visibility.md)
- [공간 입력과 배치](./spatial-imports-and-placement.md)
- [분할, LOD, 스트리밍과 접합](./partition-lod-streaming-and-seams.md)
- [시간 상태, 대안과 staleness](./temporal-state-and-staleness.md)
- [산출물과 검증](./delivery-and-validation.md)

## 공통 호환성 원칙 {#world-site-common-compatibility}


모든 하위 계약은 stable identity, 명시적 단위와 좌표 해석, 출처와 revision, 결정론적 파생 순서, 보존된 원본과 변환 계보를 공통으로 요구한다. 기존 제작물이 새 필드를 선언하지 않으면 기존 해석을 유지하며, 새 자료가 기존 의미를 바꾸는 경우에는 조용히 재해석하지 않고 영향받은 상태와 산출물을 stale로 표시한다. 세계 경계를 참조하는 건물과 내부는 좌표, 접촉, 동선, 물과 설비 접점만 공유하고 서로의 소유 geometry나 콘텐츠를 흡수하지 않는다.
