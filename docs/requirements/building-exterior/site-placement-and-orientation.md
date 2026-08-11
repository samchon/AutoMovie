# 대지, 배치와 방위

## 맵에 놓인 건물 {#building-site-placement}

건물은 map의 parcel, terrain, street, water, service와 주변 건물에 대해 실제 단위의 위치, 방위, footprint와 기준 표고를 가져야 한다.

### 대지 경계와 Setback {#building-site-boundary-setback}

대지 경계, 건축선, setback, easement와 restricted zone을 읽고 건물 mass와 attachment가 어느 범위에 놓이는지 확인할 수 있어야 한다.

### 지면 접촉 {#building-ground-contact}

Foundation, basement, entrance, retaining wall, ramp와 exterior stair는 실제 terrain elevation, slope와 cut·fill 상태에 연결되어야 한다.

### 접근과 출입 {#building-site-access}

주요 출입구, service entrance, loading, parking connection와 emergency access는 map의 road·path network와 관계를 가져야 한다.

### 주변 Context {#building-surrounding-context}

인접 mass, vegetation, water와 terrain이 view, daylight, shadow, reflection와 접근에 미치는 영향을 동일한 map state에서 검토할 수 있어야 한다.
