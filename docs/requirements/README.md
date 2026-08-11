# AutoMovie 요구사항

이 디렉터리는 AutoMovie가 사용자의 영화 저작에서 제공해야 하는 결과와 지켜야 하는 경계를 주제별로 정의한다. 각 주제는 독립된 폴더를 가지며, 폴더 안의 각 문서는 하나의 검토 가능한 요구사항 단원을 소유한다.

## 요구사항의 역할 {#requirements-role}

요구사항은 특정 package, 자료구조, 함수, 렌더러나 실행 절차를 정하지 않는다. 사용자가 무엇을 저작할 수 있어야 하는지, 어떤 결과를 관찰할 수 있어야 하는지, 어떤 변형을 허용해야 하는지, 무엇을 추정하지 말고 거부해야 하는지를 정한다.

## 능력과 콘텐츠의 구분 {#requirements-capability-content}

저장소는 특정 시대, 장소, 인물이나 작품의 완성 자산을 제공하지 않는다. 대신 저자 에이전트가 자신이 소유한 자료와 일반적인 형상·재료·동작·시간·관계 표현을 조합하여 필요한 자산과 장면을 만들고, 같은 입력에서 같은 결과를 검증·렌더·검토할 수 있게 해야 한다.

## 문서 언어와 추적 {#requirements-language-trace}

현재 초안은 개념을 충분히 정립하기 위해 한국어로 작성하지만 문서 언어 자체를 제품 계약으로 고정하지 않는다. 각 H2와 H3의 명시적 ASCII anchor와 그 의미가 요구사항 identity이며, specifications와 후속 구현 증거는 이 identity를 인용하고 확정 뒤 영어로 번역하더라도 같은 추적 관계를 보존해야 한다.

## 현재 주제 {#requirements-topics}

- [제품 계약](./product/README.md)
- [에이전트 저작](./agent-authoring/README.md)
- [자산 저작](./asset-authoring/README.md)
- [이야기 저작](./story/README.md)
- [Production Design](./production-design/README.md)
- [Actor](./actors/README.md)
- [동작](./motion/README.md)
- [Formation](./formations/README.md)
- [장면 연출](./staging/README.md)
- [Camera](./camera/README.md)
- [맵과 세계](./map/README.md)
- [건물 외관](./building-exterior/README.md)
- [실내 공간](./interior/README.md)

조명, 음향, 타임라인, 렌더, 전달, 접근성, 증거, 진단, 외부 입력과 repaint는 각각 독립 주제 폴더로 이어서 정의한다.
