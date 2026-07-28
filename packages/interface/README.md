# `@automovie/interface`

automovie의 타입 허브. 캐릭터·사물의 형상·포즈·모션·표정·머티리얼·씬을 기술하는 모든 AST 구조체의 단일 진실 공급원이다. LLM이 보는 structured-output 스키마가 곧 이 패키지의 타입이다.

런타임 의존은 없다. `typia`도, `three.js`도 없다. 순수 타입 선언만 담는다. 제약은 필드 JSDoc으로 문서화하고 `@automovie/engine`의 런타임 검증기가 강제한다. 빌드 도구(`ttsc`/`typescript`/`rimraf`/`@ttsc/lint`)는 devDependency일 뿐이다.

## 좌표계 · 단위 규약

automovie는 **glTF / VRM 규약**을 따른다.

- **공간:** 오른손 좌표계, **y-up**. +x = 캐릭터 기준 좌(left), +y = 위, +z = 앞(front). glTF 2.0 / VRM 1.0과 동일.
- **길이:** **미터(float).** VRM 휴머노이드가 미터 스케일이다. (interia가 정수 mm인 것과 대비: 캐릭터 공간은 작고 부동소수 누적이 문제되지 않는다.)
- **각도:** LLM이 보는 표면은 **의미 각도(도, degree)**: 굴곡/외전/축회전. 엔진이 본 로컬축 기준 쿼터니언으로 변환한다.
- **시간:** **초(seconds, float).**
- **정규화 가중치:** **0..1** (블렌드쉐입, 머티리얼 계수 등).

## 네이밍 컨벤션

- 인터페이스: `IAutoMovie*` (예: `IAutoMoviePose`).
- 열거형·이름공간: `AutoMovie*` (예: `AutoMovieHumanoidBone`, `AutoMovieEasing`).
- production MCP 도구: `IAutoMovieX.IProps` 입력과 `IAutoMovieX` 결과를 한 계약 쌍으로 둔다. canonical `AutoMovieApplication`의 공개 메서드는 이 쌍만 노출한다.
- discriminated union 판별자 필드에는 `/** Discriminator. */`.
- optional `T?` 대신 `T | null` + JSDoc으로 null 의미 명시.
- **타입은 러프하게.** 원시값은 `string`/`number`를 **그대로** 쓴다. `AutoMovieUuid = string`, `AutoMovieNormalized = number` 같은 **원시 래퍼 별칭을 만들지 않는다.** 수치 범위·배열 최소길이·ID 포맷 같은 제약도 타입에 박지 않는다(typia `tags` 미사용). 인터페이스는 데이터의 **모양**만 정하고, 의미·범위·단위는 필드 JSDoc으로 문서화한다. 실제 제약 강제와 `// ❌` 피드백은 `@automovie/engine`의 런타임 검증기가 책임진다(이게 automovie의 차별점인 ROM 검증이 사는 곳). 닫힌 union(본명·표정 preset·이징 등 `AutoMovie*` 열거형)만이 "잘못된 값이 구조적으로 불가능"을 보장한다. 이건 래퍼가 아니라 허용값 집합 정의라서 유지한다.

## 도메인 폴더

| 폴더 | 내용 |
|---|---|
| `core/` | 씬그래프·애니메이션 기반: 노드(`IAutoMovieNode`, `AutoMovieNodeKind`), 트랙·클립·채널(`IAutoMovieTrack`, `IAutoMovieChannel`, 값 타입·보간·한계), 드라이버·드리븐 커브, `IAutoMovieNamedId`, `IAutoMovieProfile` |
| `geometry/` | 3D 수학 원시 (`IAutoMovieVector3`, `IAutoMovieQuaternion`, `IAutoMovieEuler`, `IAutoMovieTransform`) |
| `color/` | 색 (`IAutoMovieColor`) |
| `model/` | **3D 모델**: 프리미티브/메쉬 형상(`AutoMoviePrimitiveShape`, `IAutoMovieMesh`, `IAutoMovieGeometry`), 파트(`IAutoMovieModelPart`), 모델(`IAutoMovieModel`). 스켈레톤 유무로 캐릭터/사물 통합 |
| `skeleton/` | 휴머노이드 본 열거형, 스켈레톤·본·관절 제약(ROM) 타입 |
| `pose/` | 정적 포즈: 휴머노이드 의미 각도 |
| `production/` | 코딩 에이전트 제작 계약: `application/`의 15개 MCP 입력·결과 쌍, 설계, 컴파일 소유권, 기하 질의, 증거 기반 리뷰, 렌더 번들 |
| `expression/` | 표정: ARKit 52 채널, VRM expression preset |
| `face/` | **Dormant boundary**: 결정 001 이후 보존만 하는 face/head 파라미터 문서. 현재 motion-first 하니스의 주 저작 표면은 아니며, face editor 재개 시 호환 자산으로 쓴다. |
| `motion/` | 시간 모션: 키프레임 + 이징 |
| `material/` | PBR 머티리얼 |
| `scene/` | 씬그래프: 모델/카메라/조명 배치 |
| `cinematics/` | 촬영·편집: 샷·카메라 인텐트·커버리지(대체 앵글 테이크), 시퀀스·전환·트림, 렌더 스펙, 인터랙션 이벤트, 포즈 키포인트, 가이드 패스 |
| `harness/` | LLM 함수호출 계약: 스테이지별 `IAutoMovie*Application.IWrite`, 액션 콜·타겟, 컨텍스트 요청. MCP 스키마의 소스 |
| `validation/` | 검증 봉투 + 제약 위반 리포트 (engine ↔ harness 계약) |

> 함수호출(application) 스키마 레이어는 `harness/`에 있다. `IAutoMovie*Application` 인터페이스 자체는 통합 표면에서 은퇴했지만(`.agents/skills/mcp`), 그 `IWrite`/`IProps` 데이터 모양이 MCP 도구 입력의 계약이다.

타입 하나하나의 의미·단위·범위는 필드 JSDoc이 정본이다. 왜 그렇게 나뉘었는지는 위의 네이밍 컨벤션과 도메인 폴더 표가 담고 있다.
