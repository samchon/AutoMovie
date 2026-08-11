# 날씨와 계절

## 공간과 시간에 놓인 환경 상태 {#map-weather-seasons}

Sun, sky, cloud, wind, temperature, humidity, rain, snow, fog, dust와 storm을 location, time interval, intensity와 transition을 가진 environment state로 표현할 수 있어야 한다.

### 달력, 시각과 천체 상태 {#map-calendar-time-celestial-state}

Project는 calendar, timezone 또는 fictional time basis, date, time of day, latitude·orientation과 필요한 sun, moon, star state를 선언할 수 있어야 한다. 현실 천문 계산을 선택한 경우 사용한 위치와 시간 기준을 추적하고, authored sky를 계산된 천문 사실로 주장하지 않아야 한다.

### 계절과 기후 맥락 {#map-season-climate-context}

Season, prevailing weather, daylight range, freeze·thaw, wet·dry period와 project-defined climate context를 현재 weather event와 구분할 수 있어야 한다. Climate context는 plausible authored range를 안내할 수 있지만 모든 날씨를 자동 생성하거나 실제 기후 예측을 대신하지 않아야 한다.

### 공간적 변화 {#map-weather-spatial-variation}

광역 map 안에서 cloud, fog, precipitation, wind와 visibility가 region별로 달라질 수 있어야 하며 하나의 global 값만으로 모든 장소를 강제하지 않는다.

### 시간 변화와 sample {#map-weather-temporal-sampling}

Weather state는 valid interval, transition, gust 또는 event와 sample time을 가져야 하며 임의 frame 순서와 재생 방향에서도 같은 시점의 결과를 재현할 수 있어야 한다. State 사이를 보간하지 않는 discontinuity와 unknown interval을 사용자가 구분할 수 있어야 한다.

### 지표와 수계 consequence {#map-weather-surface-consequence}

Rain, snow, freeze, heat와 wind는 wetness, puddle, runoff, snow cover, vegetation motion, wave, dust와 visibility에 선언된 범위에서 영향을 줄 수 있어야 한다.

### Film continuity {#map-weather-film-continuity}

Scene와 shot 사이의 날씨·계절·태양 state는 film timeline에서 추적되어 같은 시간과 장소의 불연속을 찾을 수 있어야 한다.

### Weather source와 uncertainty {#map-weather-source-uncertainty}

Observed, referenced, forecast-derived, simulated와 authored weather를 구분하고 source time, spatial coverage, resolution와 uncertainty를 추적해야 한다. 서로 다른 source를 합성한 결과는 우선관계와 누락 범위를 사용자에게 보여야 한다.

### 예측 주장 제한 {#map-weather-forecast-refusal}

Authored weather와 bounded simulation을 실제 기상 예측이나 완전한 fluid atmosphere로 주장하지 않는다.
