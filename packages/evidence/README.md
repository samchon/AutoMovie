# `@automovie/evidence`

AutoMovie 제작 저작용 증거 계약을 재사용하는 패키지다. 하나의 제작 종류, 저작 분기별 단계와 선택적인 작품 전용 claim을 `@ttsc/evidence` 그래프로 바꾸고, lint가 시작되기 전에 실제 저작 구조를 검증한다.

이 패키지는 공통 target inventory, film·brief·library 호환성, 단계 전이, 비활성 폴더 잔여물, target identity, 계보, 소유 cardinality와 작품 전용 claim의 추가 합성을 맡는다. 작품의 결정이나 제작 문장은 소유하지 않는다.

## 공개 표면

| Export | 역할 |
| --- | --- |
| `createAutoMovieEvidenceConfig` | 하나의 제작 선언을 검증하고 증거그래프를 반환한다. |
| `IAutoMovieEvidenceConfigProps` | 제작 종류, 분기 단계, 위치와 추가 claim을 선언한다. |
| `AutoMovieProductionKind` | 상호 배타적인 `film`, `brief`, `library` 형태를 정의한다. |
| `AutoMovieEvidenceStage` | `disabled -> draft -> evidence -> review` 생명주기를 정의한다. |
| `evidence` | 짧은 `lint.config.ts`에서 함께 쓸 `@ttsc/evidence` lint plugin을 내보낸다. |

## 경계

생성 프로젝트는 완전한 제작 선택을 `lint.config.ts` 하나에 둔다. scaffold 내부의 별도 config module은 없다. 이 파일은 재사용 그래프 동작과 lint plugin을 이 패키지에서 가져온다. 저자는 `claims`를 추가할 수 있지만 공통 reference를 교체하거나 cardinality를 바꾸거나 잔여물·topology 검사를 끌 수 없다.

Principle과 obligation은 생성 프로젝트의 단일 `docs/` 트리에 있는 평범한 편집 가능 Markdown으로 남는다. 이 패키지는 안정된 공통 inventory를 알고 실제 문서 집합이 그대로인지 검사할 뿐, 문장을 숨기거나 생성하지 않는다.
