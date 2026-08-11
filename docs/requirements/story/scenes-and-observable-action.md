# Scene과 관찰 가능한 행동

## 촬영 가능한 Scene 계약 {#story-scenes-observable-action}

Scene은 장소, story time, 참여자, 시작 상태, 종료 상태, 포함 beat와 화면 또는 소리에서 관찰할 수 있는 행동을 선언해야 한다.

### 장소와 시간 {#story-scene-place-time}

각 scene은 world identity, interior 또는 exterior context, 시간대, 날씨와 시간 연속성에 필요한 사실을 가질 수 있어야 한다.

### 입장과 퇴장 State {#story-scene-entry-exit-state}

인물, prop, 공간, light, sound와 damage의 시작 state와 scene 뒤 넘겨주는 state를 추적하여 edit 경계에서 임의 reset이 일어나지 않아야 한다.

### 관찰 가능성 {#story-scene-observability}

감정과 의도는 표정, 행동, 대사, 침묵, 공간 변화, sound와 다른 observable cue로 드러날 수 있어야 하며 카메라가 볼 수 없는 내면 사실만으로 acceptance를 쓰지 않아야 한다.

### Scene과 Shot 분리 {#story-scene-shot-separation}

하나의 scene은 여러 shot과 edit로 표현될 수 있고 한 shot이 여러 story moment를 담을 수 있으므로 scene identity를 촬영 단위와 동일시하지 않아야 한다.

### 촬영 불가능한 Scene {#story-unfilmable-scene-refusal}

장소·참여자·행동이 정해지지 않은 scene, 상충하는 시작 state, 존재하지 않는 subject를 요구하는 action과 관찰 수단 없는 핵심 beat를 named finding으로 남겨야 한다.
