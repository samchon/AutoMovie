# 제품 요구사항과 명세

## 역할 {#role}

`requirements/`는 automovie가 약속하는 제품 계약이고 `specifications/`는 각 패키지가 그 약속을 어떻게 검증 가능하게 구현하는지 적는다. 패키지 source가 specification 절을 JSDoc으로 인용하므로 구현되지 않은 명세와 근거 없는 요구사항은 컴파일 단계에서 거부된다. 더 깊은 설계 기록은 `.wiki/06-architecture/workspace-evidence-graph.md`에 있다.

## 인용 형식 {#citation-shape}

관리 대상인 모든 H2와 H3에는 명시적인 ASCII anchor가 있다. 각 specification 절은 정확히 하나의 requirement 절을 Markdown `@evidence` 주석으로 인용하고, package source symbol은 자신이 구현하는 specification 절을 JSDoc `@evidence` 태그로 인용한다.

## 소유권 {#ownership}

아래 표는 package lint config가 선언한 분할의 사람이 읽는 사본이다. `test_workspace_evidence_partition`이 실제 설정의 중복 소유와 미소유 specification directory를 거부한다.

| Specification directory | Package |
| --- | --- |
| `bootstrap` | `@automovie/create-automovie` |
| `contracts` | `@automovie/interface` |
| `delivery` | `@automovie/render` |
| `external` | `@automovie/ingest` |
| `face` | `@automovie/face` |
| `inspection` | `@automovie/playground` |
| `orchestration` | `@automovie/mcp` |
| `presentation` | `@automovie/viewer` |
| `project` | `@automovie/cli` |
| `runtime` | `@automovie/engine` |
| `subjects` | `@automovie/archetypes` |

## 기여 규칙 {#contribution}

새 requirement 또는 specification H2와 H3에는 명시적인 anchor와 실제 evidence edge를 함께 추가한다. `pnpm.cmd run lint:docs`로 문서 edge를, 해당 package build로 source edge를 검증하고 package ownership을 바꾸면 위 표도 함께 고친다.

`research/`는 근거를 기록하지만 제품 계약을 정하지 않는다. 로컬 `.wiki/`는 작업 지식과 결정을 보존하지만 새 checkout의 package consumer에게 제공되지 않으므로 requirement와 specification은 그 내용을 전제로 삼지 않는다.
