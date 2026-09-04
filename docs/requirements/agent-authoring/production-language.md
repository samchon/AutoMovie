# 제작 언어

## 생성 프로젝트의 언어 계약 {#agent-production-language}

### 명시적 선택과 고정된 module {#agent-production-language-contract}

Project 생성은 `chinese`, `english`, `japanese`, `korean` 중 정확히 하나의 제작 언어를 명시적으로 선택해야 한다. 선택 누락이나 지원하지 않는 값은 host locale 또는 English 기본값으로 대체하지 않고 생성 전에 거부한다.

생성 결과에는 선택한 언어의 탐색 질문, 단위 원칙과 완성 population 의무만 존재해야 한다. 다른 언어 module의 파일이나 structured rule이 남아 있거나 선택한 module의 필수 파일, anchor 또는 metadata가 빠지면 전체 생성을 거부한다.

지원하는 선택지는 CLI와 공개 타입에서 같은 정본을 소비하고, 생성된 tracked 설정과 저작 router가 선택 identity를 다시 확인할 수 있어야 한다. 새 checkout과 refresh는 이 identity를 보존하며 사용자의 명시적 migration 없이 다른 언어로 바꾸지 않는다.
