# 역할과 권한

## 분리된 판단 권한 {#agent-separated-authorities}

사람 감독은 의도와 최종 판단을, 저자 에이전트는 project source를, MCP host는 지식과 host-produced evidence를, compiler와 engine은 구조적 진실을, CI는 repository gate를 소유한다.

### 감독의 권한 {#agent-director-authority}

이야기, 미술, 연출 의도와 결과 수용 여부는 사람 감독이 결정한다. 시스템은 검토 가능한 선택지와 증거를 제공하되 취향의 최종 판정을 대신하지 않는다.

### 저자 에이전트의 권한 {#agent-author-authority}

저자 에이전트는 공개 계약에 따라 project source와 project-owned assets를 생성·수정한다. compiler 결과나 evidence receipt를 손으로 위조하여 성공을 만들지 않는다.

### 실행기의 권한 {#agent-runtime-authority}

Compiler와 engine은 입력의 구조, 범위, 수치, 관계와 결정론적 실행 가능성을 판단한다. 저자나 viewer가 실패한 사실을 성공으로 덮어쓰지 않는다.

### 증거 생산자의 권한 {#agent-evidence-producer-authority}

Capture, 분석, validation과 CI 결과는 실제 host 실행이 생산해야 한다. 요청자가 전달한 주장이나 오래된 파일은 현재 실행의 증거로 승격하지 않는다.
