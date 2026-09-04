# `@automovie/evidence`

AutoMovie 제작 저작용 증거 계약을 재사용하는 패키지다. 하나의 제작 종류, 저작 분기별 단계와 선택적인 작품 전용 claim을 `@ttsc/evidence` 그래프로 바꾸고, lint가 시작되기 전에 실제 저작 구조를 검증한다.

이 패키지는 공통 discovery·upstream·principle·obligation target inventory, film·brief·library 호환성, 단계 전이, 비활성 폴더 잔여물, target identity, 계보, 소유 cardinality와 작품 전용 claim의 추가 합성을 맡는다. 작품의 결정이나 제작 문장은 소유하지 않는다.

## 원칙과 의무

Principle은 선택된 모든 저술 H2/H3/H4가 각 항목을 자기 자신에 대해 답하는 무배제 checklist다. 한 강한 단위나 파일 앞 주석이 약한 형제를 대신할 수 없다. Obligation은 한 계층의 primary H2 모집단이 항목의 의미가 요구하는 수만큼 소유자를 나누어 갖는 무배제 coverage다. 같은 obligation을 여러 계층이 선택하면 각 계층이 자기 산출물의 언어로 다시 충족하지만, H3/H4 모집단마다 같은 항목을 반복하지 않는다. TypeScript source 계약은 H2 대신 해당 family의 선택된 public export 모집단이 coverage를 진다.

진단 방향도 반대다. 답하지 않은 principle은 그 단위가 자기 질문을 하지 않았다는 뜻이므로 그 단위를 고친다. 답하지 않은 obligation은 계층에 그 역할의 소유자가 없다는 뜻이므로 population의 소유 구조를 고친다. 모든 공용 reference는 한 builder에서 `checklist`와 exclusion 허용 여부를 명시해 이 차이를 드러낸다.

Upstream은 실제 부모를 상속하는 design·brief·서사 H2/H3/H4와 source export가 각각 답하는 exclusion 허용 checklist다. 하위 작업이 부모 결함을 드러내면 가장 이른 부모에서 고친 사실을 양의 evidence로 기록하고, 부모가 충분했다면 실제 부모와 시험한 결정을 구체적으로 밝힌 exclusion을 기록한다. Settings와 research는 저술 부모가 없어 이 family를 선택하지 않는다. Upstream은 부모의 충분성을 묻고, 무배제 parent-differentiation principle은 자식이 자기 층의 결정을 더했는지를 별도로 묻는다.

## 작품별 발견

Discovery는 저술 unit에 반복하는 checklist나 H2 모집단 coverage가 아니라 별도 작품 계약 감사면의 file-level coverage다. 모든 활성 Markdown 계층은 `docs/contracts/*.md`에서 `discovery/core/common.md`를 답하고, settings는 settings discovery를, 각 model·space·material·instance·motion·system 분기는 designs와 자기 layer discovery를, treatments·scripts·screenplays는 films와 자기 layer discovery를, brief는 brief discovery를 더한다. Research는 common만 답해 외부 근거 채택과 design boundary 탐색을 합치지 않는다. 결과가 있으면 평면 계약 파일이 가장 이른 의미 소유자와 현재 실현을 증명한다. 결과가 정말 없으면 `docs/contracts/index.md`만 조사한 구체적 입력·위험과 충분한 기존 소유자를 밝힌 계층 단위 제외를 소유한다. 저술 H2/H3/H4는 제작 내용을 기술할 뿐 감사를 증언하지 않는다. 발견 claim은 저술 계층의 draft부터 활성화되고 review에서 현재 fingerprint를 요구한다. Settings discovery는 실제 delivery를 역산하며 settings obligation은 독립적으로 결과를 바꾸는 operative subject를 빠짐없이 분류한다.

## 공개 표면

| Export | 역할 |
| --- | --- |
| `createAutoMovieEvidenceConfig` | 하나의 제작 선언을 검증하고 증거그래프를 반환한다. |
| `IAutoMovieEvidenceConfigProps` | 제작 종류, 분기 단계, 위치와 추가 claim을 선언한다. |
| `AutoMovieProductionKind` | 상호 배타적인 `film`, `brief`, `library` 형태를 정의한다. |
| `AutoMovieEvidenceStage` | `disabled -> draft -> evidence -> review` 생명주기를 정의한다. |
| `readAutoMovieProductionEvidence` | 활성 owner와 authored unit, 그리고 graph가 선택한 정확한 source path/export/target/digest/review edge를 하나의 runtime carrier로 읽는다. |
| `evidence` | 단일 typed `lint.config.ts`에서 쓸 `@ttsc/evidence` lint plugin을 내보낸다. |

## 경계

생성 프로젝트는 완전한 제작 선택과 evidence graph를 typed `lint.config.ts` 하나에 둔다. 이 파일이 내보내는 같은 `productionEvidence` 값을 lint, instruction sync, runtime review가 소비하므로 별도 sidecar나 이중 제작 선택이 없다. 저자는 그 선언의 `claims`를 추가할 수 있지만 공통 reference를 교체하거나 cardinality를 바꾸거나 잔여물·topology 검사를 끌 수 없다.

공통 discovery, upstream, principle과 obligation은 scaffold가 생성 프로젝트의 `docs` 안에 그대로 넣는 평범한 Markdown이다. Graph는 설치 package를 다시 찾지 않고 그 project-local exact inventory를 읽으며, 작품 전용 발견 결과와 target은 같은 root의 평면 `docs/contracts`에 남는다. 이 패키지는 공통 inventory, 계약 디렉터리의 평면성, index-only 제외, H1 앞 발견 태그, additive target 선택과 실제 문서 집합을 검사할 뿐, 작품 문장을 숨기거나 생성하지 않는다.
