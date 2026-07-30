# 오브젝트·리깅·인스턴싱 표준 조사

이 문서는 AutoMovie의 오브젝트 계약을 설계할 때 업계 표준에서 재사용할 부분과 의도적으로 분리할 부분을 정리한다. 결론은 특정 DCC나 게임 엔진의 객체 모델을 복제하는 것이 아니라, 콘텐츠 주소로 고정된 자산, 명시적 의미 프로파일, 결정론적 인스턴스, 검증 가능한 프록시를 결합하는 것이다.

## <a id="gltf-runtime-asset-contract"></a>glTF는 런타임 전달 포맷이다

Khronos는 glTF를 런타임 3D 에셋 전달 포맷으로 정의하고 현재 규격을 2.0.1로 유지한다. glTF의 node/mesh/skin/animation 구조는 외부 바이트를 AutoMovie AST로 결정론적으로 변환하는 입력으로 적합하지만, 영화 제작의 정체성·라이선스·충돌 프록시·리뷰 상태까지 소유하는 프로젝트 레코드는 아니다. 따라서 `@automovie/ingest`는 바이트가 이미 파싱된 문서를 순수 변환하고, 파일 계층이 원본 SHA-256과 출처를 소유한다.

출처: [Khronos glTF Registry](https://registry.khronos.org/glTF/), [glTF 2.0 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html).

## <a id="vrm-humanoid-canonicalization"></a>VRM은 휴머노이드 정규화 프로파일이다

VRM은 glTF 위에 오른손 Y-up, 미터 단위, 휴머노이드 본, T-pose, +Z 전방, 표정·시선·spring-bone 의미를 얹는다. 이 정보는 이름 추측보다 강한 명시 계약이므로 VRM 1.0 humanoid를 AutoMovie 휴머노이드 정규화의 우선 입력으로 쓴다. Mixamo·Unreal·일반 glTF 본은 별칭 테이블이나 사용자가 기록한 매핑을 거쳐 같은 정규 본 집합으로 흡수한다. 이름만으로 매핑을 확정하지 못하면 실패시키고 명시 매핑을 요구한다.

VRM 0.x와 1.0은 전방·정규화 방식이 다르므로 버전을 fingerprint 입력에 포함한다. import 뒤의 rest pose와 축 관례는 별도 검증하며, 포맷 라벨만으로 ROM 적합성을 인증하지 않는다.

출처: [VRM features and contents](https://vrm.dev/en/vrm/vrm_features/), [VRM development](https://vrm.dev/en/vrm/vrm_development/).

## <a id="mixamo-unreal-retargeting"></a>Mixamo와 Unreal은 이름이 아니라 대응 관계를 요구한다

Adobe Mixamo auto-rigger는 wrist, elbow, knee, groin 표지를 사용자에게 받아 자체 skeleton으로 매핑하고, 이미 rig된 입력은 FBX만 받는다. 이는 `mixamo`라는 공급자 이름만으로 본 구조를 인증할 수 없다는 뜻이다. AutoMovie importer는 실제 source bone, parent, rest transform과 정규 target bone의 대응표를 저장해야 한다.

Unreal IK Rig도 서로 다른 본 수·이름·방향을 허용하되 source/target 양쪽에 retarget chain을 정의한다. chain은 start/end bone으로 범위를 정하고, pelvis를 별도로 지정해 root motion과 비례 translation을 옮긴다. 접촉 보존이 필요하면 IK goal을 붙이며, T-pose와 A-pose 같은 rest-pose 차이는 retarget pose로 보정한다. Unreal의 fuzzy chain-name matching과 auto mapping은 편집 보조이지 확정 규격이 아니므로 결과를 사람이 확인하라는 공식 지침도 있다.

따라서 AutoMovie의 리타게팅 프로파일은 최소한 `sourceConvention`, `sourceVersion`, `boneMap`, `chainMap`, `pelvis`, `root`, `restPose`, `forwardAxis`, `scale`, `contactGoals`를 기록한다. 자동 추측 결과는 진단 후보일 뿐이며, 저장된 명시 매핑과 극단 포즈 검토가 성공하기 전에는 휴머노이드 capability를 부여하지 않는다.

출처: [Adobe Mixamo custom-character rigging](https://helpx.adobe.com/creative-cloud/help/mixamo-rigging-animation.html), [Unreal IK Rig retargeting](https://dev.epicgames.com/documentation/unreal-engine/ik-rig-animation-retargeting-in-unreal-engine), [Unreal retargeted animation setup](https://dev.epicgames.com/documentation/en-us/unreal-engine/using-retargeted-animations-in-unreal-engine).

## <a id="usd-reference-variant-instance"></a>USD의 참조·variant·instance 분리를 따른다

OpenUSD의 reference는 에셋을 장면에 합성하고, payload는 필요할 때만 로드하는 지연 참조이며, VariantSet은 원본을 파괴하지 않는 열거형 변형을 제공한다. native prim instancing은 깊은 개별 편집이 필요 없는 반복을 압축한다. AutoMovie는 이 구분을 다음처럼 번역한다.

| USD 개념 | AutoMovie 계약 |
|---|---|
| reference | 콘텐츠 주소 에셋 id를 씬·샷이 참조 |
| payload | 렌더·검토 단계에서만 필요한 고비용 메시를 지연 로드 |
| VariantSet | 팔레트·LOD·의상처럼 유한하고 이름 붙은 variant |
| instance | 한 자산과 per-instance transform/seed/variant 선택 |
| stronger override | 원본을 수정하지 않는 프로덕션 로컬 override |

instance에 임의 구조 변경을 허용하면 공유 prototype과 지문 계산의 의미가 무너지므로, 구조 변경은 새 variant나 새 에셋으로 승격한다. per-instance 데이터는 transform, scale, palette/variant id, seed, 동작 위상처럼 명시적으로 열거된 값으로 제한한다.

출처: [Introduction to USD](https://openusd.org/22.08/intro.html), [USD performance guidance](https://openusd.org/24.08/maxperf.html).

## <a id="prefab-override-provenance"></a>prefab override는 원본과 소비자 변형을 분리한다

Unity Prefab Variant는 base prefab을 상속하고 변경을 override로 보존한다. 중첩 prefab에서는 같은 override를 어느 원본 계층에 적용할지 명시해야 하며, base를 바꾸면 그 값을 override하지 않은 모든 인스턴스에 파급된다. AutoMovie의 공유 자산 수정이 여러 프로덕션을 stale시키는 이유도 같다.

AutoMovie는 override가 속한 계층을 지문에 기록한다. 프로젝트 공유 자산 변경은 모든 소비 프로덕션을 stale시키고, 프로덕션 로컬 variant 변경은 그 프로덕션만 stale시킨다. 원본과 override를 합쳐 저장하지 않는다.

출처: [Unity Prefab Variants](https://docs.unity3d.com/2018.3/Documentation/Manual/PrefabVariants.html), [Unity overrides at multiple levels](https://docs.unity3d.com/2019.4/Documentation/Manual/PrefabOverridesMultiLevel.html).

## <a id="unreal-blueprint-inheritance"></a>Unreal Blueprint의 데이터 상속과 동작 상속을 구분한다

Unreal의 Blueprint Class는 parent class의 property와 동작을 상속한다. Data-Only Blueprint는 새 실행 그래프 없이 상속한 variable/component 값만 조정해 archetype 변형을 만든다. 반면 child Blueprint의 function override는 동작을 바꾸며, parent 구현을 자동 합성하지 않고 필요할 때 명시적으로 호출한다. child Animation Blueprint의 asset override는 더 좁아서 parent graph를 유지한 채 animation sequence만 교체하며 skeleton 변경은 지원하지 않는다.

AutoMovie의 variant는 Data-Only Blueprint와 같은 열거된 데이터 override까지만 허용한다. 행동 그래프나 capability 구현이 달라지면 같은 variant로 숨기지 않고 새 object definition으로 등록한다. animation clip 교체는 rig compatibility 검증을 통과한 motion variant로 표현한다.

출처: [Unreal Blueprint Class Assets](https://dev.epicgames.com/documentation/unreal-engine/blueprint-class-assets-in-unreal-engine), [Unreal Blueprint interface overrides](https://dev.epicgames.com/documentation/en-us/unreal-engine/implementing-blueprint-interfaces-in-unreal-engine), [Unreal Animation Blueprint Override](https://dev.epicgames.com/documentation/en-us/unreal-engine/animation-blueprint-override-in-unreal-engine).

## <a id="instance-scale-and-lod"></a>인스턴싱과 LOD는 서로 다른 축이다

Unreal의 ISM/HISM 문서는 반복 static mesh가 개별 actor 복제보다 효율적이며, LOD와 culling 전략은 움직임과 수량에 따라 달라진다고 설명한다. AutoMovie는 인스턴스 수를 늘리는 API와 LOD 선택을 한 기능으로 묶지 않는다. 인스턴스 집합은 prototype과 변주를 소유하고, renderer가 화면 크기·거리와 등록 LOD를 사용해 표현을 선택한다.

외부 모델에 LOD가 없을 때 자동 생성이 성공했다고 가장하지 않는다. 최종 렌더에 필요한 LOD를 명시 등록하거나, 작은 장면에서는 원본만 쓰거나, proxy tier에서 결정론 프록시를 쓰는 세 경로 중 하나를 선택한다.

출처: [Unreal Engine Instanced Static Mesh Component](https://dev.epicgames.com/documentation/en-us/unreal-engine/instanced-static-mesh-component-in-unreal-engine).

## <a id="procedural-world-methods"></a>절차 생성 방법은 해결하는 제약이 다르다

| 방법 | 강점 | 실패 조건 | AutoMovie 용도 |
|---|---|---|---|
| L-system·도시 문법 | 장거리 도로망과 반복적 계층 성장 | 지역 충돌·접근성은 별도 제약이 필요 | route와 구획의 초안 |
| CGA shape grammar | mass→facade→detail의 의미 계층, 문·창 충돌 같은 context rule | 내부 동선·물리는 자동 보장되지 않음 | 건물 shell과 의미 anchor |
| model synthesis/WFC | 인접 타일의 국소 허용 관계를 만족 | 전역 목적지 연결·서사 landmark를 보장하지 않음 | 바닥·벽·식생 패턴 보조 |
| scatter/grid/along-route | 단순하고 예측 가능한 대량 배치 | 복잡한 공간 문법을 표현하지 못함 | 나무·병사·가로 시설의 기본 stdlib |

절차 생성기는 seed와 정규화된 입력을 받아야 하며, 생성 결과가 route를 막거나 건물을 띄우거나 landmark를 고립시키면 엔진 검증이 실패한다. 랜덤 성공까지 재시도하는 비결정론 루프 대신 최대 시도 횟수와 seed 파생 규칙을 고정한다.

출처: [Parish and Müller, Procedural Modeling of Cities](https://people.eecs.berkeley.edu/~sequin/CS285/PAPERS/Parish_Muller01.pdf), [Müller et al., Procedural Modeling of Buildings](https://doi.org/10.1145/1179352.1141931), [Paul Merrell, Model Synthesis](https://paulmerrell.org/model-synthesis/).

## <a id="crowd-agent-boundary"></a>군중 에이전트는 상태와 규칙을 소유한다

군중을 하나의 미리 구운 클립으로 취급하면 장애물·위협·대형 붕괴에 반응할 수 없고, 매 프레임 전체 개체를 직접 저작하면 재현성과 규모를 잃는다. AutoMovie는 개체별 정체성 seed, compact state, 감지 가능한 이웃·장애물, 유한한 행동 규칙을 분리한다. 엔진은 입력과 seed에서 같은 이벤트를 만들고, 에이전트 코드는 전술적 정책을 작성한다.

Massive Prime은 매 프레임 sight·hearing 입력을 brain에 공급하고, 재사용 가능한 brain part와 fuzzy activation으로 여러 반응을 동시에 혼합하며, 선택된 action 사이를 motion blending으로 잇는다. Golaem은 Behavior와 시작·종료 Trigger를 그래프로 조합하고, Go To·Navigation·Locomotion을 병렬로 실행한다. Navigation은 perception shape와 sensor를 읽고 Extrapolation, Social Force, RVO 중 명시된 회피기를 사용하며, Locomotion은 현재 위치·속도를 따라 motion clip을 동적으로 혼합한다.

두 제품에서 가져올 경계는 “군중”이라는 한 덩어리 기능이 아니라 다음의 분리다.

| 계층 | 소유하는 값 |
|---|---|
| perception | 이웃·장애물·명령·위협의 결정론 snapshot |
| decision | 명시 state와 규칙에서 action activation 또는 전이를 계산 |
| navigation | route, desired velocity, collision avoidance |
| locomotion | velocity/action을 rig-compatible motion과 phase로 변환 |
| appearance | palette, geometry variant, scale처럼 판단에 영향 없는 변주 |
| event log | 입력, 선택, 전이, hit·break 같은 검증 가능한 결과 |

시각 다양성은 행동 판단과 분리한다. palette, scale, gait phase 같은 변주는 전술 상태를 몰래 바꾸지 않으며, 사기·탄약·부상처럼 행동에 영향을 주는 값은 명시 state로 기록한다. Massive식 연속 activation을 채택하더라도 결과는 seed와 정규 입력에서 재현되어야 하고, Golaem식 trigger callback처럼 외부 스크립트가 숨은 상태를 바꾸게 두지 않는다.

출처: [Massive Prime](https://massivesoftware.com/massiveprime.html), [Massive brain design](https://www.massivesoftware.com/why-choose-massive.html), [Golaem moving-character setup](https://golaem.com/content/doc/golaem-crowd-documentation/basic-behavior-setup-moving-characters), [Golaem navigation](https://golaem.com/content/doc/golaem-crowd-documentation/navigation), [Golaem locomotion](https://golaem.com/content/doc/golaem-crowd-documentation/locomotion).

## <a id="external-model-binding"></a>외부 모델은 등록 메시와 결정론 프록시를 결합한다

외부 glTF/GLB/VRM은 원본 콘텐츠 지문, 라이선스, 포맷·버전, ingest 매핑, 명시 LOD, 선택한 결정론 프록시를 에셋 매니페스트에 등록한다. viewer는 최종 메시를 표시하고 asset review는 그 메시의 턴테이블과 극단 포즈를 본다.

충돌, 도달 거리, ROM, 지면 접촉처럼 임의 메시에서 안정적으로 유도할 수 없는 의미는 등록 프록시가 소유한다. 프록시는 메시를 대충 닮은 숨은 자동 추정치가 아니라, 어떤 측정과 capability를 증명하는지 명시한 계약이다. 필요한 프록시가 없으면 해당 capability를 거부한다.

이 결합은 최종 외형의 천장을 열면서도 엔진 사실을 메시 topology의 우연에 맡기지 않는다.

## <a id="object-contract-decisions"></a>AutoMovie 설계 결정

1. 휴머노이드 정규 본 집합은 VRM 1.0을 우선 기준으로 삼고, Mixamo·Unreal·일반 glTF는 명시 별칭으로 흡수한다.
2. capability는 문자열 라벨이 아니라 프로파일 데이터의 실존과 유효성으로 증명한다.
3. 외부 자산 정체성은 파일 경로가 아니라 원본 바이트 SHA-256이며, 경로는 현재 위치일 뿐이다.
4. 공유 자산과 프로덕션 로컬 override를 분리해 stale 범위를 계산한다.
5. 인스턴스는 prototype을 공유하고 per-instance 변주를 열거한다. 구조 변경은 variant 또는 새 자산이다.
6. 절차 생성은 seed, 최대 시도, 실패 진단을 계약으로 갖는다.
7. 고정 메시가 증명하지 못하는 물리·ROM·측정은 명시 프록시가 소유한다.

## <a id="object-implementation-questions"></a>구현자가 답해야 할 질문

- 이 에셋은 프로젝트 공유인가, 프로덕션 로컬 override인가?
- 정규화된 좌표계, 단위, 전방, rest pose가 무엇이며 어떤 바이트와 매핑에서 나왔는가?
- 어떤 capability가 어떤 프로파일 필드와 검증으로 증명되는가?
- 최종 메시와 결정론 프록시 중 어느 쪽이 각 측정을 소유하는가?
- 인스턴스마다 달라지는 값이 시각 변주인가, 행동 state인가?
- LOD가 명시되어 있는가? 없다면 어떤 렌더 tier에서 어떤 대체 표현을 쓰는가?
- 절차 생성 실패가 seed 변경으로 은폐되지 않고 재현 가능한 진단으로 남는가?
