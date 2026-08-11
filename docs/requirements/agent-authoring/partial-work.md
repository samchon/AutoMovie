# 부분 작업과 원자적 결과

## 정직한 미완성 상태 {#agent-honest-partial-work}

영화는 일부 scene, shot, interval, subject, asset, sound 또는 environment가 아직 선언되지 않은 상태로 존재할 수 있다. 선언된 부분 target은 더 넓은 film이 미완성이어도 검증할 수 있어야 하며, 미완성 범위는 정규 timeline과 evidence에서 명시되어야 한다.

### 선언된 omission {#agent-declared-omission}

미완성 구간은 시작·끝, 이유, 영향 대상과 다음 저작 단계를 가진 omission으로 남아야 한다. 사용자가 placeholder를 선택할 수는 있지만 그 잠정 상태를 유지해야 하며 검은 화면이나 임의의 placeholder를 완성된 shot으로 세지 않는다.

### 원자적 compile {#agent-atomic-compilation}

한 compile 결과는 선언된 target에 대해 완전한 성공 artifact 또는 구조화된 실패여야 한다. Target 밖의 선언된 omission은 그 성공을 막지 않지만 target 안의 누락을 이전 성공 bytes나 임의의 대체물로 채워 현재 film state처럼 제공해서는 안 된다.

### 부분 검증의 범위 {#agent-partial-verification-scope}

부분 target의 성공은 그 target과 입력에만 유효하다. 전체 film, 다른 view 또는 다른 플랫폼의 성공으로 확대하지 않는다.

### 부분 결과의 채택과 폐기 {#agent-partial-result-control}

사용자는 검증된 부분 결과를 checkpoint로 채택하고 계속 저작하거나, 수정을 요청하거나, 폐기할 수 있어야 한다. 부분 채택은 미완성 범위를 최종 delivery로 승인했다는 뜻이 아니며 시스템이 나머지 범위를 자동 생성하도록 허가하지 않는다.

### 저작 미완성과 capability gap의 구분 {#agent-partial-work-gap-distinction}

아직 저작하지 않은 작품 사실, 의도적으로 보류한 범위와 AutoMovie가 표현하거나 검증할 수 없는 capability gap을 구분해야 한다. Gap을 숨기기 위해 외부 서비스나 catalogue 결과를 자동으로 끼워 넣지 않아야 한다.

### 재개 가능한 작업 {#agent-resumable-authoring}

저자는 versioned source, 선택된 input identity, omission과 진단에서 작업을 재개할 수 있어야 하며, 재개를 위해 숨은 session state나 특정 이전 agent의 기억을 요구해서는 안 된다.
