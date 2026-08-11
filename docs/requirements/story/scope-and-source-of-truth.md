# 이야기 범위와 정본

## 저작된 이야기의 정본 {#story-source-of-truth}

작품의 이야기 정본은 project가 추적하는 명시적 screenplay source이며 chat 기억, 생성 도구의 이전 답변, filename과 render 결과에서 역으로 추정하지 않아야 한다.

정본은 현재 승인된 revision, 작성자 또는 승인자, 적용 범위와 상태를 식별할 수 있어야 한다. 초안, 검토 중인 대안, 승인본과 폐기본이 같은 디렉터리에 있다는 이유만으로 동등한 권위를 얻지 않아야 한다.

### Source Authority와 우선순위 {#story-source-authority}

Project는 premise, logline, treatment, sequence, beat, scene와 dialogue 중 어느 source가 어떤 사실을 소유하는지 선언하고, 같은 사실이 충돌할 때 적용할 승인 규칙을 사용자가 확인할 수 있어야 한다. 더 하류의 문서가 상위 약속을 몰래 바꾸거나 render 결과가 screenplay 사실을 새로 만들지 않아야 한다.

### 안정된 단위 Identity {#story-stable-unit-identity}

Sequence, beat, scene, character, relation, utterance와 semantic event는 문구와 파일 위치가 바뀌어도 추적 가능한 안정 identity를 가져야 한다. 동일 identity를 두 단위가 동시에 주장하거나 다른 단위를 같은 대상으로 오인하게 하는 alias 충돌을 검출해야 한다.

### 단계별 구체화 {#story-progressive-refinement}

Premise, logline, treatment, sequence, beat와 scene은 같은 내용을 반복하는 문서가 아니라 상위 약속을 더 좁은 인과, 시간, 장소와 관찰 가능한 행동으로 구체화해야 한다.

각 단계는 자신이 답하는 바로 위 단위를 식별하고 무엇을 구체화하는지 설명할 수 있어야 한다. 연결되지 않은 하류 단위와 어느 하류 단위도 답하지 않는 상위 약속을 서로 다른 미지급 관계로 보고해야 한다.

### 의도와 Production의 구분 {#story-production-distinction}

이야기는 무엇이 왜 일어나야 하는지를 소유하고 shot, camera, motion, sound와 edit은 그것을 어떻게 관찰하게 할지를 소유한다. 제작 선택을 이야기 사실로 되돌려 쓰지 않아야 한다.

Production의 한 표현이 실패하거나 교체되어도 story identity와 성공 조건은 유지되어야 하며, 이야기 변경이 필요하면 명시적인 revision으로 처리해야 한다. 하나의 이야기 단위가 여러 staging, shot, edit 또는 전달 방식으로 실현될 수 있어야 한다.

### 열린 장르와 형식 {#story-open-form}

극영화, 다큐멘터리형 구성, 광고, 뮤직 비디오, 교육, 실험, 무성 작품과 project-defined 형식을 지원하되 한 장르 template를 모든 작품에 강제하지 않아야 한다.

전통적인 protagonist, dialogue 또는 3막 구조가 없는 작품도 주체, 변화, 시간, 관찰 수단과 수용 조건을 project가 정의할 수 있어야 한다. 장르 관습은 선택 가능한 저작 규칙이지 자동으로 채워지는 이야기 content가 아니어야 한다.

### 불명확성의 보존 {#story-unknown-preservation}

의도적으로 미정인 동기, 사건, 결말과 해석은 unknown 또는 alternative로 보존하고 저작 에이전트가 임의 사실로 채우지 않아야 한다.

Unknown은 owner, 영향을 받는 단위, 결정에 필요한 입력과 진행 차단 여부를 가질 수 있어야 한다. 미정 상태를 빈 문자열, 임시 문구 또는 사실처럼 보이는 생성 내용으로 감추지 않아야 한다.

### 사실, 인용과 창작의 경계 {#story-fact-fiction-provenance}

역사적 주장, 실제 인물, 직접 인용, 번역, 각색과 사용자 제공 자료를 사용하는 이야기는 원자료의 위치, 식별 가능한 판본, 관찰 또는 인용한 범위, 작성자의 해석과 창작된 부분을 구분할 수 있어야 한다. 출처가 없는 사실 주장과 확인되지 않은 인용을 screenplay 정본이 자동으로 보증하지 않아야 한다.

### Capability와 선제 Content의 경계 {#story-capability-content-boundary}

제품은 사용자가 premise부터 acceptance까지 저작하고 연결하고 검토할 능력을 제공하되 완성 plot, character, dialogue, genre formula와 결말을 기본 정답으로 제공한다고 약속하지 않아야 한다. 예시가 있더라도 그것은 저작 기법을 설명해야 하며 새 작품의 정본이나 재사용할 줄거리 catalogue가 되지 않아야 한다.
