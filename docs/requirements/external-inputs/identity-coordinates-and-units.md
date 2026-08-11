# Import Identity, 좌표와 단위

## 위치와 무관한 Import Identity {#external-import-identity}

채택된 외부 입력은 logical source identity, 정확한 source revision, import 또는 interpretation identity와 consumer identity를 구분해야 한다. File path, URL, provider response name와 display label이 바뀌어도 같은 bytes와 같은 해석은 relink할 수 있고, 같은 이름의 다른 bytes는 자동으로 같은 revision이 되지 않아야 한다.

### 원본과 Revision의 구분 {#external-identity-source-revision}

Raw bytes, structured response, archive member와 dependency마다 digest와 source position을 식별하고, mutable source의 서로 다른 취득 결과를 별도 revision으로 보존해야 한다. 새 revision은 이전 revision의 기록을 덮어쓰지 않으며 작품이 어느 revision을 읽는지 명확해야 한다.

### Content와 Provenance Identity {#external-identity-content-provenance}

같은 bytes를 서로 다른 source, license 또는 acquisition에서 얻은 경우 content digest는 공유할 수 있지만 source와 provenance identity를 합치지 않아야 한다. 반대로 metadata-only 차이가 해석, 권리 또는 consumer 결과를 바꾸면 raw media bytes가 같아도 별도 import revision으로 구분해야 한다.

### 내부 Element와 Dependency Identity {#external-identity-elements-dependencies}

Scene node, mesh, material, image, animation, audio stream, motion track, spatial feature, text record와 metadata entity는 가능한 범위에서 source-local identity와 import 결과의 대응을 유지해야 한다. 순서 변경이나 filename 변경만으로 안정된 element가 무관한 새 대상이 되거나 두 element가 하나로 충돌하지 않아야 한다.

### 공간 좌표와 단위 {#external-identity-spatial-coordinates-units}

Spatial input은 source axis, handedness, origin, length와 angle unit, transform order, geographic reference 또는 local datum, bounds와 precision을 선언하고 project space로의 관계를 명시해야 한다. 선언이 없거나 모순되면 보기 좋은 크기와 위치를 추측하지 않고 사용자 결정이 필요한 unknown으로 남겨야 한다.

### 시간, Sample과 Rate {#external-identity-time-units}

Video, audio, motion, observation과 timed metadata는 source clock, rational rate 또는 sample rate, start, duration, range boundary, timestamp basis와 synchronization 관계를 가져야 한다. Frame index, second, sample index와 wall-clock time을 암묵적으로 섞거나 반올림 차이를 숨기지 않아야 한다.

### Color, Channel과 값 의미 {#external-identity-value-interpretation}

Image, video, material, audio와 numeric dataset은 color space, transfer, alpha mode, channel layout, scalar unit, no-data value, normalization과 encoding처럼 값의 의미를 바꾸는 조건을 선언해야 한다. Metadata 누락을 임의의 default로 보정했다면 원본 사실이 아니라 명시적 degradation 또는 reinterpretation으로 추적해야 한다.

### Identity 충돌과 Ambiguity {#external-identity-collision-ambiguity}

Duplicate id, ambiguous element mapping, digest mismatch, incompatible coordinate reference와 서로 다른 source가 주장하는 같은 authority를 탐지해야 한다. 충돌 상태에서 한 후보를 순서나 최근성만으로 선택하지 않고 사용자가 비교하고 해소할 수 있게 해야 한다.
