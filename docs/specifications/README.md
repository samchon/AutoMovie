# AutoMovie 시스템 명세

이 디렉터리는 AutoMovie의 사용자 관찰 가능한 요구사항을 구현 기술과 package 배치에 독립적인 시스템 계약으로 정밀화한다.

## 명세의 역할 {#specifications-role}

<!-- @evidence requirements/README.md#requirements-role 이 단원은 사용자 약속과 구현 사이에서 명세가 맡는 역할을 정한다. -->

명세는 입력과 출력, identity, 상태 전이, 좌표와 시간, 허용 범위, 결정성, 실패와 거부, 검증 가능한 결과를 정한다.

명세는 특정 package, 파일, 공개 symbol이나 내부 알고리즘을 구현 정답으로 고정하지 않는다.

## 시스템 경계와 구현 독립성 {#specifications-system-boundaries}

<!-- @evidence requirements/README.md#requirements-cross-cutting-boundaries 이 단원은 작품 저작 주제와 모든 주제에 걸친 계약을 시스템 경계로 분리한다. -->

각 폴더는 서로 대체할 수 없는 하나의 시스템 경계를 소유하며, 경계를 넘는 데이터와 상태는 양쪽 명세가 공유 identity와 불변 조건을 합의해야 한다.

후속 구현은 관련 requirement와 specification을 모두 직접 인용하고, 같은 계약을 여러 구현체가 나누어 수행할 수 있으며, 하나의 구현체가 여러 계약을 수행할 수도 있다.

## 명세 지도 {#specifications-topics}

<!-- @evidence requirements/README.md#requirements-topics 이 단원은 요구사항 주제를 구현 독립적인 시스템 계약 경계로 재구성한다. -->

- [저작과 권한](./authoring-and-authority/README.md)
- [서사와 의도](./narrative-and-intent/README.md)
- [자산과 표현](./asset-and-representation/README.md)
- [교환과 채택](./interchange-and-adoption/README.md)
- [세계와 대지](./world-and-site/README.md)
- [건물 외피](./building-envelope/README.md)
- [실내 공간](./interior-space/README.md)
- [연기·동작·장면 배치](./performance-motion-and-staging/README.md)
- [카메라·조명·가시성](./camera-light-and-visibility/README.md)
- [시뮬레이션·효과·음향](./simulation-effects-and-sound/README.md)
- [편집·렌더링·전달](./editorial-render-and-delivery/README.md)
- [검증과 진단](./validation-and-diagnostics/README.md)
- [실행과 복구](./execution-and-recovery/README.md)
- [증거와 provenance](./evidence-and-provenance/README.md)
- [검토와 acceptance](./review-and-acceptance/README.md)

## 추적과 문서 언어 {#specifications-traceability}

<!-- @evidence requirements/README.md#requirements-language-trace 이 단원은 언어가 바뀌어도 요구사항에서 명세와 구현으로 이어지는 identity를 보존한다. -->

모든 H2와 H3는 저장소 전체에서 고유한 명시적 ASCII anchor를 가지며, 각 단원은 자신이 정밀화하는 requirement 단원을 직접 인용한다.

README도 이 규칙의 대상이며 파일 이름만으로 증거 모집단에서 제외하지 않는다.

현재 초안은 한국어로 작성하지만 언어 자체를 계약으로 고정하지 않고, 확정 뒤 번역하더라도 anchor와 추적 관계를 보존한다.
