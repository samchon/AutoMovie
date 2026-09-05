# AutoMovie 요구사항

이 디렉터리는 AutoMovie가 사용자의 영화 저작에서 제공해야 하는 결과와 지켜야 하는 경계를 주제별로 정의한다. 각 주제는 독립된 폴더를 가지며, 폴더 안의 각 문서는 하나의 검토 가능한 요구사항 단원을 소유한다.

각 요구사항 단원의 실현은 해당 단원을 직접 참조하는 public TypeScript `@evidence`와 package별 evidence claim으로 증명한다. 한 요구사항의 서로 다른 결과를 여러 package가 구현할 수 있으므로 임의의 단일 owner 원장을 두지 않는다. 대신 요구사항, package와 symbol 종류를 고른 lint claim, 실제 public export가 이루는 삼각형을 모두 검증하고, 구현하지 않는 package는 자기 경계에서만 구체적인 `@evidenceExclude`를 남긴다. 선언되지 않거나 public carrier가 없는 단원은 통과한 것으로 기록하지 않고 graph debt로 실패한다. 정확한 모집단과 게이트는 [evidence graph skill](../../.agents/skills/evidence-graph/SKILL.md#required-triangle)이 소유한다.

## 요구사항의 역할 {#requirements-role}

요구사항은 특정 package, 자료구조, 함수, 렌더러나 실행 절차를 정하지 않는다. 사용자가 무엇을 저작할 수 있어야 하는지, 어떤 결과를 관찰할 수 있어야 하는지, 어떤 변형을 허용해야 하는지, 무엇을 추정하지 말고 거부해야 하는지를 정한다.

## 능력과 콘텐츠의 구분 {#requirements-capability-content}

저장소는 특정 시대, 장소, 인물이나 작품의 완성 자산을 제공하지 않는다. 대신 저자 에이전트가 자신이 소유한 자료와 일반적인 형상·재료·동작·시간·관계 표현을 조합하여 필요한 자산과 장면을 만들고, 같은 입력에서 같은 결과를 검증·렌더·검토할 수 있게 해야 한다.

## 문서 언어와 추적 {#requirements-language-trace}

현재 초안은 개념을 충분히 정립하기 위해 한국어로 작성하지만 문서 언어 자체를 제품 계약으로 고정하지 않는다. 각 H2와 H3의 명시적 ASCII anchor와 그 의미가 요구사항 identity이며, specifications와 후속 구현 증거는 이 identity를 인용하고 확정 뒤 영어로 번역하더라도 같은 추적 관계를 보존해야 한다.

## 현재 주제 {#requirements-topics}

- [제품 계약](./product/README.md)
- [에이전트 저작](./agent-authoring/README.md)
- [생성 프로젝트 증거 설정](./production-evidence/README.md)
- [자산 저작](./asset-authoring/README.md)
- [이야기 저작](./story/README.md)
- [Production Design](./production-design/README.md)
- [Actor](./actors/README.md)
- [동작](./motion/README.md)
- [Formation](./formations/README.md)
- [장면 연출](./staging/README.md)
- [Camera](./camera/README.md)
- [조명](./lighting/README.md)
- [Effect와 Simulation](./effects-and-simulation/README.md)
- [음향](./sound/README.md)
- [편집](./editorial/README.md)
- [Rendering](./rendering/README.md)
- [전달과 접근성](./delivery-and-accessibility/README.md)
- [Repaint](./repaint/README.md)
- [맵과 세계](./map/README.md)
- [건물 외관](./building-exterior/README.md)
- [실내 공간](./interior/README.md)
- [외부 입력](./external-inputs/README.md)
- [Acceptance](./acceptance/README.md)
- [Review](./review/README.md)
- [Evidence와 Provenance](./evidence-and-provenance/README.md)
- [진단](./diagnostics/README.md)
- [운영과 복구](./operations-and-recovery/README.md)

## 공간 주제의 경계 {#requirements-spatial-boundaries}

맵은 지형과 수계, 생태, 기반 시설과 건물 배치의 세계 좌표를 소유하고, 건물 외관은 건물의 대지 배치와 외피, 질량, 층과 개구부를 소유하며, 실내 공간은 그 건물 경계 안의 공간과 표면, 설비, 가구와 점유 조건을 소유한다. 내부가 없는 배경 건물은 건물 외관만으로 완결할 수 있고, 내부가 있는 건물은 외관의 물리적 크기와 층별 조건을 실내가 위반하지 않아야 한다.

## 교차 주제의 경계 {#requirements-cross-cutting-boundaries}

외부 입력은 사용자가 가져온 자료의 채택 선택과 경계를, acceptance와 review는 결과 판정과 사람의 의사결정을, evidence와 provenance는 결과와 입력의 계보를, 진단은 거부와 부분 성공의 설명을, 운영과 복구는 장시간 작업의 상태와 실패 이후 진행을 소유한다. 각 교차 주제는 영화 저작 주제의 내용을 대신 정의하지 않고 모든 주제가 따라야 할 사용자 관찰 가능한 약속을 정의한다.
