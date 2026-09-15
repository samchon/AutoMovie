# 제작 언어 module

## 선택과 물질화 {#spec-authoring-production-language}

### 닫힌 module identity {#spec-authoring-production-language-module}

<!-- @evidence requirements/agent-authoring/production-language.md#agent-production-language-contract 선택, 물질화, 재개가 하나의 닫힌 언어 identity를 보존하게 한다. -->

입력은 `chinese`, `english`, `japanese`, `korean`의 단일 정본 tuple에서 고른 값이다. Parser, CLI와 scaffold renderer는 그 tuple과 predicate를 직접 소비하며 별도 literal 목록을 만들지 않는다.

각 module은 고정된 discovery, principles와 obligations 파일, 각 파일의 H1과 explicit H2 anchor, localized review-question 및 source terminal label, structured rule의 id, status와 safe application으로 식별된다. Loader는 strict UTF-8 regular file만 읽고 누락, 추가 entry, symbolic link, 다른 언어 residue, anchor와 id 불일치, 비활성 rule의 graph 투영을 전체 materialization 전에 거부한다.

생성 전의 shipped scaffold 선언은 production kind, active branch, local claim, materialized language pack이 모두 없는 상태로만 평가되며, 그 상태에서 언어 값은 render placeholder여도 graph는 언어 claim 없이 성립한다. Branch 선택이나 pack의 존재는 정본 module identity를 요구하고 다른 값은 거부한다.

최초 설치는 선택 identity를 tracked 설정에 두고 해당 언어 module의 정확한 계약 bytes를 프로젝트에 설치한다. 이후 identity와 계약 변경은 프로젝트의 version control로 기록한다. 패키지 변경이나 프로젝트 재개가 설치된 지침·언어 계약을 재생성하거나 교체하지 않는다. 현재 선언과 언어 module을 읽는 graph는 identity가 없거나 서로 다르면 암묵적인 module 교체 대신 실패한다.
