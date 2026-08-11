# 날씨와 계절

## 공간과 시간에 놓인 환경 상태 {#map-weather-seasons}

Sun, sky, cloud, wind, temperature, humidity, rain, snow, fog, dust와 storm을 location, time interval, intensity와 transition을 가진 environment state로 표현할 수 있어야 한다.

### 공간적 변화 {#map-weather-spatial-variation}

광역 map 안에서 cloud, fog, precipitation, wind와 visibility가 region별로 달라질 수 있어야 하며 하나의 global 값만으로 모든 장소를 강제하지 않는다.

### 지표와 수계 consequence {#map-weather-surface-consequence}

Rain, snow, freeze, heat와 wind는 wetness, puddle, runoff, snow cover, vegetation motion, wave, dust와 visibility에 선언된 범위에서 영향을 줄 수 있어야 한다.

### Film continuity {#map-weather-film-continuity}

Scene와 shot 사이의 날씨·계절·태양 state는 film timeline에서 추적되어 같은 시간과 장소의 불연속을 찾을 수 있어야 한다.

### 예측 주장 제한 {#map-weather-forecast-refusal}

Authored weather와 bounded simulation을 실제 기상 예측이나 완전한 fluid atmosphere로 주장하지 않는다.
