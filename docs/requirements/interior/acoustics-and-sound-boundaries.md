# 음향과 소리 경계

## 공간 형상에 답하는 소리 {#interior-acoustics-sound-boundaries}

Room volume, opening, boundary material, furnishing, actor, source와 listener가 direct path, occlusion, reflection와 bounded room response에 미치는 관계를 같은 interior state에서 표현할 수 있어야 한다.

### 공간 연결과 전달 {#interior-sound-transmission}

Door, window, opening, wall, floor, ceiling, shaft와 exterior boundary의 open·closed state가 인접 공간 사이 sound path와 attenuation에 반영되어야 한다.

### 흡음과 잔향 입력 {#interior-absorption-reverberation}

Surface area, material absorption, room volume, furnishing와 occupancy를 supported acoustic estimate의 input으로 사용할 수 있고 source와 unit를 기록해야 한다.

재료의 흡음, 산란과 투과 값은 주파수 범위, 두께, 설치 상태, 출처와 불확실성을 가져야 한다. 필요한 값이 없으면 외관이 비슷한 재료에서 몰래 채우지 않고 해당 분석을 unknown 또는 unsupported로 남겨야 한다.

### Film Sound와 공간 정합 {#interior-film-sound-alignment}

Sound design의 emitter, listener, cue time와 mix intent는 interior의 resolved position, room identity, opening state와 event를 참조하고 돌 홀과 흡음된 room을 같은 dry space로 다루지 않아야 한다.

### 분석과 Mix 경계 {#interior-acoustic-analysis-boundary}

Direct-path timing, scalar room estimate, impulse response, propagation simulation와 creative mix를 구분하고 계산하지 않은 수준을 물리적으로 검증된 것으로 주장하지 않아야 한다.

### 음향 Zone과 Scenario {#interior-acoustic-zones-scenarios}

Room, open plan의 일부, plenum, shaft와 연결 공간을 겹칠 수 있는 acoustic zone으로 묶고 source spectrum, listener, opening state, furnishing, occupancy, service noise와 film time을 이름 있는 scenario로 고정할 수 있어야 한다. 결과는 관찰 위치, 주파수와 시간 범위, 계산 방법, 수렴 상태와 제외된 경로를 밝혀 같은 공간의 다른 조명·운용 state와 혼동되지 않아야 한다.
