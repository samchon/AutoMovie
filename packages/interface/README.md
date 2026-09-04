# `@automovie/interface`

## 필름 전역 효과 런타임

`IAutoMovieCompiledFilmEffect`는 기존의 결정론적 효과 스트림에 필름 소유자, 전체 해상도 타임라인 프레임 시계, 현재 컴파일 및 편집 식별자를 결합한다. 프록시와 최종 렌더러는 이 동일한 공개 DTO를 사용하며 샷 로컬 효과를 대체하지 않는다.

## Film-grammar intent

`IAutoMovieShotContract.styleIntent` is a unique list of deliberate editorial
exceptions such as `jump-cut` or `eyeline-break`. It does not disable visual
review wholesale: the engine maps every marker to exactly one diagnostic, so
unrelated geometry and continuity findings remain visible.

## Typed object capabilities and instances

`IAutoMovieProfile.gaits` remains the typed locomotion capability.
`IAutoMovieProfile.traits` carries closed `mountable` and `destructible` data.
Seat, payload, durability, and impact-body facts are typed; names and legacy
free-form capability labels do not authorize a capability-gated engine verb.

`IAutoMovieWorldDesign.instanceSets` owns compact non-formation crowds,
vegetation, props, and debris. Grid, disk-scatter, and route layouts retain
only count, seed, model reference, and bounded variation law. Compiled slots
derive stable scale, palette, and numeric traits without expanding scene nodes.

`IAutoMovieSubjectReviewObservation` is a portable passed receipt, not a loose image reference.
It carries the production and exact subject target, revision, compile and whole-plan identities, viewpoint and resolved pose, artifact digest, complete capture runtime including actual graphics, and the literal non-delivery boundary needed to decide whether the observation is current.

automovie의 타입 허브. 캐릭터·사물의 형상·포즈·모션·표정·머티리얼·씬과 production 증거 계약을 기술하는 모든 AST 구조체의 단일 진실 공급원이다. 코딩 에이전트는 이 타입을 tracked TypeScript에서 직접 소비한다.

런타임 의존은 없다. `typia`도, `three.js`도 없다. 순수 타입 선언만 담는다. 제약은 필드 JSDoc으로 문서화하고 `@automovie/engine`의 런타임 검증기가 강제한다. 빌드 도구(`ttsc`/`typescript`/`rimraf`/`@ttsc/lint`)는 devDependency일 뿐이다.

## 좌표계 · 단위 규약

automovie는 **glTF / VRM 규약**을 따른다.

- **공간:** 오른손 좌표계, **y-up**. +x = 캐릭터 기준 좌(left), +y = 위, +z = 앞(front). glTF 2.0 / VRM 1.0과 동일.
- **길이:** **미터(float).** VRM 휴머노이드, 건축 요소, 장면 배치가 하나의 미터 기반 좌표계를 사용한다.
- **각도:** LLM이 보는 표면은 **의미 각도(도, degree)**: 굴곡/외전/축회전. 엔진이 본 로컬축 기준 쿼터니언으로 변환한다.
- **시간:** **초(seconds, float).**
- **정규화 가중치:** **0..1** (블렌드쉐입, 머티리얼 계수 등).

## 네이밍 컨벤션

- 인터페이스: `IAutoMovie*` (예: `IAutoMoviePose`).
- 열거형·이름공간: `AutoMovie*` (예: `AutoMovieHumanoidBone`, `AutoMovieEasing`).
- production 진입점: `IAutoMovieX.IProps` 입력과 `IAutoMovieX` 결과를 한 계약 쌍으로 둔다.
- discriminated union 판별자 필드에는 `/** Discriminator. */`.
- optional `T?` 대신 `T | null` + JSDoc으로 null 의미 명시.
- **타입은 러프하게.** 원시값은 `string`/`number`를 **그대로** 쓴다. `AutoMovieUuid = string`, `AutoMovieNormalized = number` 같은 **원시 래퍼 별칭을 만들지 않는다.** 수치 범위·배열 최소길이·ID 포맷 같은 제약도 타입에 박지 않는다(typia `tags` 미사용). 인터페이스는 데이터의 **모양**만 정하고, 의미·범위·단위는 필드 JSDoc으로 문서화한다. 실제 제약 강제와 `// ❌` 피드백은 `@automovie/engine`의 런타임 검증기가 책임진다(이게 automovie의 차별점인 ROM 검증이 사는 곳). 닫힌 union(본명·표정 preset·이징 등 `AutoMovie*` 열거형)만이 "잘못된 값이 구조적으로 불가능"을 보장한다. 이건 래퍼가 아니라 허용값 집합 정의라서 유지한다.

## 도메인 폴더

| 폴더          | 내용                                                                                                                                                                                                             |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/`       | 씬그래프·애니메이션 기반: 노드(`IAutoMovieNode`, `AutoMovieNodeKind`), 트랙·클립·채널(`IAutoMovieTrack`, `IAutoMovieChannel`, 값 타입·보간·한계), 드라이버·드리븐 커브, `IAutoMovieNamedId`, `IAutoMovieProfile` |
| `geometry/`   | 3D 수학 원시 (`IAutoMovieVector3`, `IAutoMovieQuaternion`, `IAutoMovieEuler`, `IAutoMovieTransform`)                                                                                                             |
| `color/`      | 색 (`IAutoMovieColor`)                                                                                                                                                                                           |
| `model/`      | **3D 모델**: 프리미티브/메쉬 형상(`AutoMoviePrimitiveShape`, `IAutoMovieMesh`, `IAutoMovieGeometry`), 파트(`IAutoMovieModelPart`), 모델(`IAutoMovieModel`). 스켈레톤 유무로 캐릭터/사물 통합                     |
| `skeleton/`   | 휴머노이드 본 열거형, 스켈레톤·본·관절 제약(ROM) 타입                                                                                                                                                            |
| `pose/`       | 정적 포즈: 휴머노이드 의미 각도                                                                                                                                                                                  |
| `authoring/`  | 코드 저작 정본: stage, blocking, performance, forge/review/edit 계획과 하나의 등록된 shot program                                                                                                                |
| `production/` | 코딩 에이전트 제작 계약: asset provenance 원장, 대본 scene/beat/catalog/lock 인덱스, 캡쳐와 리페인트 계약, 설계, 컴파일 소유권, 기하 질의, 렌더·배송 번들                                                |
| `expression/` | 표정: ARKit 52 채널, VRM expression preset                                                                                                                                                                       |
| `face/`       | **Dormant boundary**: 결정 001 이후 보존만 하는 face/head 파라미터 문서. 현재 motion-first 하니스의 주 저작 표면은 아니며, face editor 재개 시 호환 자산으로 쓴다.                                               |
| `motion/`     | 시간 모션: 키프레임 + 이징                                                                                                                                                                                       |
| `material/`   | 세 층으로 나뉜 재료: 빛에만 답하는 PBR 표면(`IAutoMovieMaterial`), 밀도·열전도·비열·흡음·투습저항·내용연수를 담는 물질(`IAutoMovieMaterialSubstance`), 적층 방향·기준면 오프셋·노출면·개구부 감쌈을 가진 구성 적층(`IAutoMovieMaterialAssembly`, `IAutoMovieMaterialLayer`)                                                                                                                                                                                                     |
| `scene/`      | 씬그래프: 모델/카메라/조명 배치                                                                                                                                                                                  |
| `architecture/` | 건물 동 소유권과 두 계층: 여러 독립 건물 단위를 담는 `IAutoMovieBuiltEnvironment`, 보이는 요소 계층과 논리 공간 계층, 경계·개구부·연결자·지지면 그래프, 설계가 인용만 하고 대체되지는 않는 관찰 근거 `IAutoMovieDesignReference`, 어떤 그래프의 stable id에도 붙는 공사 단계·설계 대안·파생 계보 `IAutoMovieDesignLineage` |
| `render/`     | 렌더 예산과 의미 증거: 삼각형·드로우·텍스처·그림자·인스턴스·유체 예산과 초과 소유자, 순서에 의존하지 않는 시맨틱 마스크, 대상 지문과 경계 있는 리포트                                                            |
| `service/`    | 건물이 공급받는 배분 그래프: 급수·급탕·배수·통기·순환·전기·공조·소방의 port와 network, 젖은 구역과 방수 범위, 관통 슬리브와 유지보수 부피. 간섭은 run 전체가 아니라 직선 leg마다 판정한다 |
| `soft/`       | 커튼·러그·쿠션 같은 연성체와 실내 식재의 상태: 고정 스텝 상태와 결정적 시드, 충돌, 군집 배치 |
| `drawing/`    | 하나의 설계에서 파생되는 산출물: 평면·입면·단면·상세, 주석, 창호/마감 일람, 물량. 파생물은 설계의 두 번째 진실이 되지 않는다 |
| `analysis/`   | 읽기 전용 대지 문맥(태양·하늘·기준 지면·인접 차폐 매스)과 채광·열·습기·공기·음향 분석 아티팩트. 지원하지 않거나 실행하지 않은 값은 `unsupported`/`not-run`으로 이유와 함께 남고 숫자를 지어내지 않는다 |
| `fluid/`      | 건축과 독립된 유체 도메인: 고정 격자·고정 스텝 shallow-water 설계(`IAutoMovieFluidDomain`), 절대 스텝 상태·표면·분무·예산(`IAutoMovieFluidState`), 건물이 논리 공간에 묶는 수경 바인딩(`IAutoMovieWaterFeature`)                                       |
| `cinematics/` | 촬영·편집: 샷·카메라 인텐트·커버리지(대체 앵글 테이크), 시퀀스·전환·트림, 렌더 스펙, 인터랙션 이벤트, 포즈 키포인트, 가이드 패스                                                                                 |
| `harness/`    | 저수준 액션 콜·타겟·beat-end 엔진 어휘와 레거시 slate/context 호환 타입. 현재 stage/block/perform 입력은 `authoring/`이 소유하며 이 폴더의 Request 모양은 공개 진입점이 아님                                                      |
| `validation/` | 검증 봉투 + 제약 위반 리포트 (engine  harness 계약)                                                                                                                                                             |

> 코드 저작의 정본은 `authoring/`이며 `@automovie/engine`의 `defineShot`이 이를 실행한다. `harness/`에서 엔진이 계속 소비하는 것은 action/target/beat-end 같은 저수준 어휘뿐이며, 외부 에이전트는 이를 tracked TypeScript 안에서 사용한다.

타입 하나하나의 의미·단위·범위는 필드 JSDoc이 정본이다. 왜 그렇게 나뉘었는지는 위의 네이밍 컨벤션과 도메인 폴더 표가 담고 있다.
