# Source 저작 반복

## Project source가 정본인 반복 {#agent-source-owned-loop}

영화는 공개된 project 시작 구조에서 출발하여 source 편집, 원자적 compile, 좁은 검증, 결정론적 capture, evidence-first review와 delivery를 반복하며 발전해야 한다.

### 일반적인 코드 저작 {#agent-ordinary-code-authoring}

저자 에이전트는 특수한 숨은 editor 상태가 아니라 읽고 diff하고 review할 수 있는 project source에서 장면과 자산을 저작해야 한다.

### 검토 가능한 source 변경 {#agent-reviewable-source-change}

코딩 에이전트가 만든 변경은 사용자나 다음 저작 에이전트가 변경된 작품 사실, 선택과 외부 의존성을 식별하고 유지, 수정 또는 폐기할 수 있는 source diff로 남아야 한다.

### 가장 좁은 유효 검증 {#agent-narrowest-valid-check}

반복 비용은 현재 질문에 답하는 가장 좁은 shot, frame, subject, drawing, analysis 또는 test를 선택하여 줄일 수 있어야 한다. 좁은 검증은 답하지 않은 범위의 성공을 주장하지 않는다.

### Source와 결과의 연결 {#agent-source-result-link}

Compile artifact, render, drawing, 진단과 review receipt는 어떤 source revision과 입력 bytes에서 나왔는지 추적할 수 있어야 한다.

실행되는 top-level export는 evidence graph가 선택하고 검토한 정확한 source path, export 이름, authored target과 동일해야 하며, 결과도 그 target과 source digest를 함께 보존해야 한다. 같은 population 안의 다른 유효한 owner나 helper export로 바꾸는 것은 동일한 source를 사용한 것으로 간주하지 않는다.

### 변경 영향의 가시성 {#agent-change-impact-visibility}

한 source 변경이 영향을 주는 자산, shot, frame interval, drawing, quantity와 evidence를 식별할 수 있어야 하며 관련 없는 결과를 임의로 다시 생성하지 않아야 한다.
