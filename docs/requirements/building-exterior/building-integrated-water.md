# 건물 결합 수공간

## 건물에 속하는 외부 물 요소 {#building-integrated-water}

Courtyard, terrace, rooftop, facade와 exterior stair에 결합된 pond, pool, basin, channel, fountain, water wall, waterfall와 runoff feature를 building exterior에 배치된 bounded water feature로 표현할 수 있어야 한다.

### 건물과의 관계 {#building-water-relationship}

Container, rim, water boundary, waterproofing, source, drain, overflow와 service가 building structure, envelope, opening, circulation 및 linked interior의 wet·dry boundary와 어떤 identity로 연결되는지 표현할 수 있어야 한다.

### 유체 State {#building-water-state}

Standing water, free surface, flow, spray, falling water, inflow, outflow, level change, wetness와 overflow 중 film이 요구하는 bounded authored 또는 simulated state를 확인할 수 있어야 한다. 실행하지 않은 3D fluid simulation이나 수리 성능을 주장하지 않아야 한다.

### Map 수계와의 경계 {#building-water-map-boundary}

건물에 직접 결합되지 않은 자연 lake, river, canal, reservoir와 park water는 map이 소유한다. 건물 수공간이나 runoff가 연결된 경우 양쪽 water body·port identity, coordinate, level datum, direction, capacity 범위, phase와 flow interface를 명시해야 한다.

### 누수와 넘침 {#building-water-validation}

Negative depth, container 밖 initial volume, source 없는 증가, drain 없는 영구 유출, blocked overflow와 water가 intended boundary를 벗어나 exterior circulation, opening, linked interior, structure와 service에 영향을 주는지 검토할 수 있어야 한다.

### Water Quantity와 시간 {#building-water-quantity-time}

Container volume, fill level, water volume, inflow, outflow와 bounded mass balance는 실제 geometry, unit와 sample time을 가져야 한다. Phase, weather, pump·valve state와 film event가 바뀌면 water quantity, surface, wetness와 overflow evidence를 함께 갱신해야 한다.
