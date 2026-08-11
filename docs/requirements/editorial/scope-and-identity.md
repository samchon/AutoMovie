# Timeline 범위와 Identity

## Film Presentation의 정본 {#editorial-scope-identity}

편집본은 안정된 timeline identity, revision, film timebase, 명시된 시작과 종료, ordered composition, source reference, transition, marker, effect, picture와 sound 관계, 선택 상태를 가져야 한다. 같은 identity와 revision은 항상 같은 편집 결정을 가리켜야 하며, 내용이 바뀌면 새 revision으로 식별해야 한다.

### Story와 Film Order {#editorial-story-film-order}

Story time과 causal order는 관객에게 제시되는 film order와 분리되어야 한다. Flashback, flash-forward, intercut, montage, replay는 원래 사건의 identity와 story 위치를 잃지 않은 채 presentation placement를 명시해야 한다.

### Source Preservation {#editorial-source-preservation}

Edit는 source shot, performance event, sound event와 state transition을 참조해야 하며 trim, offset, retime 또는 재배치가 원본 사실을 덮어써서는 안 된다. 관객에게 보이지 않게 된 소스도 삭제와 비선택을 구분할 수 있어야 한다.

### Authored Cut {#editorial-authored-cut}

Shot order, duration, transition, picture와 sound edit point, intentional gap과 overlap은 사용자가 승인할 수 있는 authored decision이어야 한다. 시스템은 구조 오류를 찾거나 대안을 제시할 수 있지만 pacing이나 film grammar를 임의로 최적화하여 current cut을 바꾸어서는 안 된다.

### Duration과 Closure {#editorial-duration-closure}

Timeline의 duration은 활성화된 모든 필수 picture, sound, transition과 tail의 경계를 포함하는 하나의 값으로 계산되어야 한다. Open-ended source나 미정 종료를 가진 draft는 partial임을 표시해야 하며 final cut으로 선택할 수 없어야 한다.

### Identity 경계 {#editorial-identity-boundary}

Timeline identity는 source media identity, render artifact identity, delivery package identity와 구분되어야 한다. 같은 cut을 다른 해상도나 codec으로 내보낸 결과는 새 편집본이 아니며, clip order나 range가 바뀐 결과는 같은 출력 이름을 사용해도 새 edit revision이다.

### Missing Timeline {#editorial-missing-refusal}

Unordered shot list, 디렉터리 파일명 순서, 수정 시각, 남아 있는 render 파일이나 마지막 성공 실행을 finished timeline으로 간주해서는 안 된다. 정본 revision, timebase 또는 composition closure가 없으면 사용 가능한 partial source와 정확한 미결 항목을 보고하고 편집 완료를 거절해야 한다.
