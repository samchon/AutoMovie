# 역할과 권한

## 분리된 판단 권한 {#agent-separated-authorities}

사용자는 작품 의도, project source와 결과 채택의 최종 권한을 가진다. 코딩 에이전트는 위임받은 source 변경을 수행하고, host는 공개된 안내와 실제 실행 evidence를 전달하며, 결정론적 실행기는 구조적 유효성을 판단해야 한다.

### 감독의 권한 {#agent-director-authority}

사용자는 감독 역할을 직접 수행하거나 지정한 사람 감독에게 이야기, 미술, 연출 의도와 결과 수용 판단을 위임할 수 있다. 시스템은 검토 가능한 선택지와 증거를 제공하되 취향의 최종 판정을 대신하지 않는다.

### 사용자의 위임 권한 {#agent-user-delegation-authority}

사용자는 목표, 금지 사항, 승인 조건과 직접 결정할 선택을 정하고 나머지를 코딩 에이전트에게 위임할 수 있어야 한다. 보류, 직접 선택과 위임을 구분하며 사용자는 위임한 선택도 검토하고 수정하거나 거부할 수 있어야 한다.

### 코딩 에이전트의 권한 {#agent-author-authority}

코딩 에이전트는 공개 계약과 위임된 범위 안에서 저작 기법, source 구조와 parameter를 선택하고 project source와 project-owned assets를 생성·수정한다. 선택하지 않은 작품 의도나 외부 서비스를 사용자의 결정으로 꾸미거나 실행 결과와 evidence receipt를 위조하여 성공을 만들지 않는다.

### 실행기의 권한 {#agent-runtime-authority}

결정론적 실행기는 입력의 구조, 범위, 수치, 관계와 실행 가능성을 판단한다. 저작 에이전트나 결과 표시 surface가 실패한 사실을 성공으로 덮어쓰지 않는다.

### 증거 생산자의 권한 {#agent-evidence-producer-authority}

Capture, 분석, validation과 delivery gate 결과는 실제 host 실행이 생산해야 한다. 요청자가 전달한 주장이나 오래된 파일은 현재 실행의 증거로 승격하지 않는다.
