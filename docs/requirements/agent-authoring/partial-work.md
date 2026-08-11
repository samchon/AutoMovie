# 부분 작업과 원자적 결과

## 정직한 미완성 상태 {#agent-honest-partial-work}

영화는 일부 scene, shot, interval, subject, asset, sound 또는 environment가 아직 선언되지 않은 상태로 존재할 수 있으며, 미완성 범위가 정규 timeline과 evidence에서 명시되어야 한다.

### 선언된 omission {#agent-declared-omission}

미완성 구간은 시작·끝, 이유, 영향 대상과 다음 저작 단계를 가진 omission으로 남아야 하며, 검은 화면이나 임의의 placeholder를 완성된 shot으로 세지 않는다.

### 원자적 compile {#agent-atomic-compilation}

한 compile 결과는 성공한 전체 artifact 또는 구조화된 실패여야 한다. 이전 성공의 일부와 현재 실패의 일부를 섞은 결과를 현재 film state로 제공하지 않는다.

### 부분 검증의 범위 {#agent-partial-verification-scope}

부분 target의 성공은 그 target과 입력에만 유효하다. 전체 film, 다른 view 또는 다른 플랫폼의 성공으로 확대하지 않는다.

### 재개 가능한 작업 {#agent-resumable-authoring}

저자는 미완성 source와 진단에서 작업을 재개할 수 있어야 하며, 재개를 위해 숨은 session state나 특정 이전 agent의 기억을 요구해서는 안 된다.
