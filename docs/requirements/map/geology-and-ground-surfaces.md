# 지질과 지표

## 지면의 재료와 상태 {#map-geology-ground}

암반, 토양, 모래, 점토, 자갈, 진흙, 눈, 얼음, 포장과 잔해는 색만 다른 texture가 아니라 이동, 흔적, 배수, 반사와 변형에 영향을 주는 지표 상태로 구분할 수 있어야 한다.

### 지질 단위와 지반 영역 {#map-geology-units-ground-zones}

Bedrock, sediment, fill, made ground, unstable slope, cavity와 project-defined geological zone을 경계, 깊이 범위, confidence와 source를 가진 공간으로 표현할 수 있어야 한다. 실제 조사가 없는 영역은 inferred 또는 authored state로 구분해야 한다.

### 토양 단면과 성질 {#map-soil-profile-properties}

Topsoil, subsoil, organic layer, gravel, clay와 mixed fill의 층서, 두께, moisture, permeability, bearing capacity, erosion, compaction와 contamination 같은 필요한 성질을 project가 선언할 수 있어야 한다. 이러한 값은 이동, 식생, 배수, 굴착 또는 foundation 판단에 사용한 범위와 단위를 가져야 한다.

### 지층과 노출 {#map-strata-exposure}

절벽, 절개지, 동굴과 굴착부는 필요한 경우 지층, 두께, 경계, 균열과 노출 단면을 표현할 수 있어야 한다.

### 지표 피복 {#map-ground-cover}

낙엽, 풀, 이끼, 자갈, 눈, 먼지와 잔해 같은 얇은 피복은 바탕 지형 identity를 유지하면서 영역과 두께, 밀도와 상태를 가질 수 있어야 한다.

### 지표와 지반의 관계 {#map-surface-subsurface-relation}

Surface material, thin cover와 subsurface layer를 분리하여 비가 젖힌 표면, 진흙층, 포장 아래 fill과 노출 암반을 같은 한 색이나 한 material로 합치지 않아야 한다. 굴착, 침식과 파괴가 일어나면 새로 드러난 층과 발생한 잔해를 추적할 수 있어야 한다.

### 시간에 따른 지표 {#map-ground-temporal-state}

비, 가뭄, 동결, 전투, 차량 통행과 공사에 따른 진창, 바퀴 자국, 발자국, 침식, 퇴적과 파손을 선언된 시간 또는 단계에 연결할 수 있어야 한다.

### 지표 물량 {#map-ground-quantity}

영역별 면적, 절토·성토 체적, 피복량과 변경량은 같은 resolved surface에서 산출할 수 있어야 한다.

### 지반 주장 범위 {#map-ground-analysis-bound}

Authored 또는 참고자료 기반 ground property를 geotechnical survey나 engineering certification으로 주장하지 않아야 한다. Film blocking을 넘어선 안정성, 오염, 침하와 foundation 판단이 필요하면 검증되지 않은 범위와 필요한 외부 분석을 명시해야 한다.
