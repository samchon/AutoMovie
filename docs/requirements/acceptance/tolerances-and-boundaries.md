# Acceptance 허용오차와 경계

## 허용오차의 명시 {#acceptance-tolerance-declaration}

정확한 일치를 요구하지 않는 criterion은 허용오차의 종류, 값, 단위, 기준값, 적용 방향과 경계 포함 여부를 명시해야 한다.

허용오차가 없다는 뜻과 허용오차를 아직 정하지 않았다는 뜻을 구분해야 한다. 전자는 exact criterion이고 후자는 invalid criterion이므로 둘을 모두 0으로 해석하지 않아야 한다.

### 절대와 상대 허용오차 {#acceptance-absolute-relative-tolerance}

절대 허용오차는 기준과 같은 단위를 사용하고, 상대 허용오차는 분모와 0 근처의 처리 규칙을 밝혀야 한다. 두 허용오차를 함께 쓰면 하나만 만족하면 되는지 모두 만족해야 하는지 명시해야 한다.

### 비대칭과 방향 허용오차 {#acceptance-asymmetric-directional-tolerance}

상한 초과와 하한 미달의 위험이 다르면 양쪽 허용오차를 따로 정할 수 있어야 한다. 늦음과 빠름, 침범과 여유, 과다와 부족을 절댓값 하나로 숨기지 않아야 한다.

### 각도, 공간과 시간 허용오차 {#acceptance-spatiotemporal-tolerance}

각도는 회전 주기와 최단 방향, 공간은 좌표계와 거리 정의, 시간은 story time, presentation time, frame 또는 sample 기준을 명시해야 한다. 서로 다른 기준의 값을 변환 근거 없이 비교하지 않아야 한다.

## 경계의 판정 {#acceptance-boundary-semantics}

모든 범위 criterion은 최소값과 최대값의 포함 여부, 정확히 경계에 놓인 값의 기대 verdict와 측정 해상도보다 작은 차이의 처리 방식을 밝혀야 한다.

### 반올림과 양자화 {#acceptance-rounding-quantization}

표시값이 아니라 판정에 사용한 정밀도와 반올림 또는 양자화 규칙을 확인할 수 있어야 한다. 반올림된 화면값이 같다는 이유로 실제 범위 밖 값을 통과시키지 않아야 한다.

### 이산 표본 경계 {#acceptance-discrete-sample-boundary}

Frame, audio sample, event 또는 상태 전이처럼 이산적인 대상은 시작과 끝의 포함 규칙과 가장 가까운 표본 선택 규칙을 명시해야 한다. 한 표본의 경계 이동이 verdict를 바꾸는 경우 양쪽 표본을 boundary evidence로 다뤄야 한다.

### 지각 허용오차 {#acceptance-perceptual-tolerance}

시각·청각 허용오차는 기준 reference, 비교 조건, target raster 또는 playback 조건과 허용 가능한 차이의 관찰 언어를 가져야 한다. “눈에 띄지 않음”은 관찰자와 조건이 정의되지 않으면 허용오차가 될 수 없어야 한다.

## Profile이 소유하는 수치 {#acceptance-profile-owned-thresholds-group}

### Profile이 소유하는 수치 {#acceptance-profile-owned-thresholds}

해상도, frame rate, loudness, 색, caption timing, 접근성 치수와 품질 threshold처럼 목적에 따라 달라지는 값은 적용 profile이 소유해야 한다.

관할, 매체, audience 또는 delivery가 다른 profile의 수치를 보편 기본값으로 적용하지 않아야 한다.
