# 제작 언어 module

## 선택과 물질화 {#spec-authoring-production-language}

### 닫힌 module identity {#spec-authoring-production-language-module}

<!-- @evidence requirements/agent-authoring/production-language.md#agent-production-language-contract 선택, 물질화, 재개가 하나의 닫힌 언어 identity를 보존하게 한다. -->

입력은 `chinese`, `english`, `japanese`, `korean`의 단일 정본 tuple에서 고른 값이다. Parser, CLI, scaffold renderer와 contract baseline은 그 tuple과 predicate를 직접 소비하며 별도 literal 목록을 만들지 않는다.

각 module은 고정된 discovery, principles와 obligations 파일, 각 파일의 H1과 explicit H2 anchor, localized review-question 및 source terminal label, structured rule의 id, status와 safe application으로 식별된다. Loader는 strict UTF-8 regular file만 읽고 누락, 추가 entry, symbolic link, 다른 언어 residue, anchor와 id 불일치, 비활성 rule의 graph 투영을 전체 materialization 전에 거부한다.

생성 전의 shipped scaffold 선언은 production kind, active branch, local claim, materialized language pack이 모두 없는 상태로만 평가되며, 그 상태에서 언어 값은 render placeholder여도 graph는 언어 claim 없이 성립한다. Branch 선택이나 pack의 존재는 정본 module identity를 요구하고 다른 값은 거부한다.

생성된 project는 선택 identity와 exact module generation을 tracked 설정과 contract baseline에 기록한다. Initial render, instruction sync와 contract migration은 그 identity를 읽고 보존하며 값이 없거나 current project와 다르면 암묵적인 module 교체 대신 typed failure를 반환한다.
