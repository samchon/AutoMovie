# 저술 문서 참조

## 현재 저술 원문의 선택적 참조 {#agent-reference-navigation}

저자는 production의 현재 저술 Markdown을 계층, 파일, 절 순서로 발견하고 필요한 본문을 읽을 수 있어야 한다. 이 참조 경로는 편집 가능한 원문을 정본으로 유지하며 증거 감사나 전체 모집단 리뷰의 범위를 바꾸지 않는다.

### 저술 계층과 정확한 절 발견 {#agent-reference-selection}

Settings, research, 일곱 design 계층, treatments, scripts, screenplays와 briefs의 실제 파일 구조와 heading 관계를 탐색할 수 있어야 한다. H1 없는 문서와 H2 없는 group index를 허용하고, 명시적 anchor가 없는 draft를 주소가 있는 절로 가장하지 않는다. 절 읽기는 선택 heading의 하위 본문만 반환하며 다음 동급 또는 상위 heading의 본문을 섞지 않는다.

### 현재 원문의 보존과 판본 식별 {#agent-reference-source}

참조 본문은 읽은 bytes에서 실제 HTML comment만 제외한 원문이어야 한다. 공백, 줄바꿈, 일반 HTML, 코드 예제, scene carrier와 timing 표기를 보존한다. 파일 identity, source revision과 정확한 위치를 제공하며 파일 변경 시 과거 주소와 새 본문을 결합하지 않는다. Annotation을 제거한 참조 결과는 evidence 감사, 승인 receipt 또는 reader edition을 대신하지 않는다.

### 제한된 응답과 명시적 실패 {#agent-reference-bounds}

기본 탐색 응답은 본문과 주석별 상세 위치를 반복하지 않는 작은 인덱스여야 한다. 큰 모집단에는 continuation을 표시하고 budget을 넘는 본문은 잘라서 완전한 결과처럼 반환하지 않는다. 주소, revision, 읽기 권한, 물리 identity와 decoding 실패를 구분하며 오류로 annotation 내용을 노출하지 않는다.

### Production에 결속된 읽기 전용 경로 {#agent-reference-isolation}

참조 경로는 시작 시 선택한 하나의 production 안에서 허용된 저술 Markdown만 읽는다. 링크, 경로 별칭과 교체로 다른 bytes를 반환하지 않으며 credentials, operator brief, 저장소 이력, private 작업 노트와 source TypeScript를 읽지 않는다. 참조 요청은 파일, graph, stage, fingerprint와 review 상태를 변경하지 않으며 lint, compile, render, 외부 실행이나 설치를 시작하지 않는다.

### Client 교체 가능한 참조 {#agent-reference-transports}

MCP client와 로컬 JSON 명령은 같은 참조 요청과 결과를 사용해야 한다. 설치된 production package만으로 동작하고 registry에서 새 package를 자동 설치하지 않는다. Client 등록과 지침은 일반 참조 경로를 발견하게 하되 다른 사용자 설정을 보존하며 충돌과 최초 trust 단계를 명시한다.
