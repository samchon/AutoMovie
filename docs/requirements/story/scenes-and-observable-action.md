# Scene과 관찰 가능한 행동

## 촬영 가능한 Scene 계약 {#story-scenes-observable-action}

Scene은 장소, story time, 참여자, 시작 상태, 종료 상태, 포함 beat와 화면 또는 소리에서 관찰할 수 있는 행동을 선언해야 한다.

Scene은 무엇이 일어나야 하는지 소유하되 shot count, lens, camera path와 edit pattern을 유일한 실현 방식으로 고정하지 않아야 한다. Project가 의도적으로 screenplay에 넣은 production direction은 이야기 요구와 구분해 표시할 수 있어야 한다.

### 장소와 시간 {#story-scene-place-time}

각 scene은 world identity, interior 또는 exterior context, 시간대, 날씨와 시간 연속성에 필요한 사실을 가질 수 있어야 한다.

Scene heading과 scene index는 같은 장소와 시간 조건을 가리켜야 하며 충돌할 경우 어느 source가 권위인지 식별할 수 있어야 한다. CONTINUOUS, LATER, SAME MOMENT와 같은 관계는 이전 scene과의 실제 story-time 관계를 가져야 한다.

### 입장과 퇴장 State {#story-scene-entry-exit-state}

인물, prop, 공간, light, sound와 damage의 시작 state와 scene 뒤 넘겨주는 state를 추적하여 edit 경계에서 임의 reset이 일어나지 않아야 한다.

Scene이 시작 전에 발생한 변화를 전제로 하면 그 원인 scene, 생략된 사건 또는 외부 초기 조건을 식별해야 한다. 종료 state가 여러 대안으로 열려 있으면 선택 전까지 하나를 current 사실로 노출하지 않아야 한다.

### 관찰 가능성 {#story-scene-observability}

감정과 의도는 표정, 행동, 대사, 침묵, 공간 변화, sound와 다른 observable cue로 드러날 수 있어야 하며 카메라가 볼 수 없는 내면 사실만으로 acceptance를 쓰지 않아야 한다.

필수 cue는 누가 또는 무엇이, 언제, 어떤 변화를 보이거나 들려주는지 식별할 수 있어야 한다. 같은 의미를 여러 cue가 전달할 수 있는 경우 필수와 선택을 구분하여 한 표현 방식의 실패가 이야기 전체의 실패인지 판정할 수 있어야 한다.

### Scene과 Shot 분리 {#story-scene-shot-separation}

하나의 scene은 여러 shot과 edit로 표현될 수 있고 한 shot이 여러 story moment를 담을 수 있으므로 scene identity를 촬영 단위와 동일시하지 않아야 한다.

Scene coverage는 해당 scene을 실현하는 shot과 source interval을 찾을 수 있어야 하며, shot 수나 file 수만으로 coverage를 통과시키지 않아야 한다. 다른 scene의 shot을 재사용할 때도 어떤 story moment를 답하는지 명시해야 한다.

### 촬영 불가능한 Scene {#story-unfilmable-scene-refusal}

장소·참여자·행동이 정해지지 않은 scene, 상충하는 시작 state, 존재하지 않는 subject를 요구하는 action과 관찰 수단 없는 핵심 beat를 named finding으로 남겨야 한다.

### Scene Number와 Soft Lock {#story-scene-number-soft-lock}

Scene은 안정 identity와 사람이 읽는 순서 번호를 구분하고, production이 시작된 뒤 삭제된 번호를 다른 scene에 재사용하지 않아야 한다. 삽입 scene은 기존 하류 연결을 깨지 않는 식별 방식을 사용하고 삭제된 scene은 누락이 아니라 의도된 omission으로 추적할 수 있어야 한다.

### Screenplay Index와 Prose {#story-screenplay-index-prose}

Screenplay index와 catalogue는 stable scene identity를 authoritative prose, sequence와 beat에 연결해야 하며 행동과 dialogue를 축약한 두 번째 screenplay가 되지 않아야 한다. Index와 prose가 heading, 장소, 시간, 참여자 또는 포함 beat에 대해 충돌하면 어느 쪽도 조용히 덮어쓰지 않고 source authority finding으로 보고해야 한다.

Script와 screenplay의 delivery-group index는 numbered unit filename과 H1에서 생성한 canonical ordered link block을 가져야 한다. 같은 renderer의 check mode는 missing, extra, duplicate, wrong-order, wrong-target와 malformed block을 거부하고 authored prose는 unit file에 그대로 남겨야 한다.

### 참여자와 등장 방식 {#story-scene-participant-modes}

Scene은 on-screen actor, off-screen speaker, crowd, object, environmental agent와 referenced-only entity를 구분할 수 있어야 한다. 실제로 참여하지 않는 인물을 cast list에 넣었다는 이유로 scene action의 performer로 간주하지 않아야 한다.

### Scene의 국소 Dramatic Arc {#story-scene-local-arc}

Scene은 local want 또는 question, resistance, turn과 exit value 중 작품 형식에 필요한 관계를 식별할 수 있어야 한다. 시작과 끝의 story value가 동일한 관찰 장면은 정보, 분위기, 리듬 또는 setup 중 어떤 목적을 소유하는지 설명할 수 있어야 한다.

### Scene 의존 대상 {#story-scene-subject-dependencies}

Scene은 행동에 필요한 character, prop, location, state, language와 환경 조건을 식별하여 production design과 subject 명세가 도출될 수 있게 해야 한다. 필요한 대상이 아직 없으면 placeholder asset으로 조용히 대체하지 않고 unresolved dependency로 남겨야 한다.

### Scene 경계와 연속성 {#story-scene-boundary-continuity}

새 장소, 시간 도약, 관점 변화와 상태 단절 중 무엇이 scene 경계를 만드는지 project가 설명할 수 있어야 한다. 같은 연속 사건을 파일 편의상 나눈 경계와 실제 story discontinuity를 구분해야 한다.
