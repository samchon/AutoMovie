# 주체 표면과 검사

## 주체 검사 시스템 {#review-system-subject-inspection}

### 주체 Record와 구성 {#review-system-subject-record}

<!-- @evidence requirements/review/subject-inspection.md#review-subject-identity 주체를 안정된 identity, revision과 구성 관계를 가진 record로 정밀화한다. -->

주체 record는 주체 kind, 안정된 identity, revision 또는 content identity, 소유 상위 주체와 구성 member set을 가진다. kind는 자산, actor, formation, 공간, element와 part를 구분하고 표시 이름은 identity가 아니다.

구성 관계는 상위 주체를 resolve하지 않고도 member를 직접 열 수 있어야 한다. 공간과 그 공간에 속한 element, 자산과 그것을 이루는 part, 자산과 그 자산을 배치한 element, formation과 그 slot placement, instance set과 그 instance placement는 각각 독립된 record이며 원형 record 하나가 placement record 여럿을 소유한다.

Placement record는 자신이 참조하는 원형 identity를 별도 field로 보존하고 원형 record의 관찰 결과를 자신의 관찰 결과로 복사하지 않는다.

### 검사 Target에서 관찰 단위로의 해석 {#review-system-subject-target-parity}

<!-- @evidenceObligation subject-target-parity 동일 subject target을 구조 관찰과 viewer 관찰에서 같은 identity로 해석하는 계약. -->

<!-- @evidence requirements/review/subject-inspection.md#review-observable-judgeable-parity 제품이 공개한 모든 주체 검사 target이 실제 관찰 단위로 해석되게 만든다. -->
<!-- @evidence requirements/acceptance/review-surfaces-and-sampling.md#acceptance-subject-surface 주체를 shot과 독립된 acceptance 표면으로 정의한다. -->

Resolver는 제품이 공개한 주체 검사 target을 안정된 주체 record와 observation 단위로 해석한다. 해석하지 못하거나 실제 artifact를 만들 host가 없으면 결과는 `unsupported`이며, 그 대상을 담은 shot이나 frame의 관찰로 대체하지 않는다.

주체 표면은 자신의 target identity, viewpoint plan, observation과 coverage를 가진다. 같은 주체를 담은 frame은 주체 observation을 대신하지 않고 주체 observation도 delivery frame evidence로 쓰이지 않는다.

### 시점 Plan의 소유 {#review-system-subject-viewpoint-plan}

<!-- @evidenceObligation viewpoint-plan-record 시점 plan이 담는 내용과 결정적 identity·순서, 그리고 authored camera·shot 경계·film time을 입력으로 받지 않는다는 것. -->
<!-- @evidenceObligation delivery-evidence-separation 주체 관찰이 delivery evidence 개체군에 들어가지 않고, 주체를 담은 shot frame이 그 주체의 표본으로 계상되지 않는다는 것. -->
<!-- @evidenceObligation topology-derived-population required 개체군을 compiled topology에서 파생하는 것과 노출·facade/roof/underside·exterior/reentrant corner 분류 규칙. -->
<!-- @evidenceObligation interior-station-containment interior station이 그 space 자신의 진술된 volume 안에 있음을 증명하는 것과, 증명하지 못한 station을 identity만 남긴 채 미해결로 보고하는 것. -->
<!-- @evidenceObligation population-non-shrinkable 호출자가 station을 더할 수는 있어도 뺄 수 없다는 것과, 같은 record가 어느 호출자에게나 같은 station identity와 순서를 만든다는 것. -->
<!-- @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership 검사가 시점을 소유한다는 불변식을 viewpoint plan으로 고정한다. -->
<!-- @evidence requirements/acceptance/review-surfaces-and-sampling.md#acceptance-spatial-view-sampling 형상, 접촉, occlusion과 deformation을 드러내는 각도와 구조 view를 요구한다. -->

주체 검사의 viewpoint plan은 주체 identity, 각 시점의 방향과 거리, projection, 적용 pose와 state, 필요한 render pass와 결정적 시점 선택 규칙을 가진다. Plan은 저작된 camera, shot 경계와 film time을 입력으로 받지 않으며 같은 입력과 plan은 같은 시점 identity와 순서를 만든다.

Frame과 구간 표면은 반대로 저작된 camera state를 그대로 사용하고 자체 시점을 선택하지 않는다. 주체 검사가 만든 관찰은 delivery evidence population에 들어가지 않으며, 주체를 담은 shot frame은 그 주체의 viewpoint plan을 충족한 표본으로 계상되지 않는다.

Required viewpoint 개체군은 caller input이 아니라 compiled topology에서 파생한다. Bounded rigid subject는 여섯 canonical face와 서로 반대인 두 oblique을 지불하고, 건물 unit은 자기 envelope에서, volume을 진술한 각 logical space는 자기 interior에서 개체군을 얻는다. 노출 여부는 하나의 space만 감싸는 separation인지로 정하고, facade·roof·underside 구분은 그 separation의 outward normal이 수평보다 수직에 가까운지로 정하며, corner의 exterior·reentrant 구분은 두 facade가 만나는 점에서 각 facade의 몸이 다른 facade의 outward plane 뒤에 있는지로 정한다. 각 space는 자기 interior centre에서 네 cardinal station, 자기 extent의 네 corner에서 안쪽을 향한 station, 자기 boundary에 뚫린 opening마다 threshold station 하나를 얻는다.

Interior station의 position은 그 space 자신의 진술된 volume 안에 있음이 증명된 점이어야 한다. 증명하지 못한 station은 개체군에서 사라지지 않고 identity만 남긴 채 미해결로 보고되며, 호출자 입력은 station을 더할 수 있고 뺄 수 없다. 같은 record는 어느 호출자에게나 같은 station identity와 같은 순서를 만든다.

### 주체 검사의 요청 표면 {#review-system-subject-inspection-reach}

<!-- @evidenceObligation subject-inspection-reach 안정된 subject와 viewpoint identity로 실제 viewer 검사를 요청하는 표면. -->

<!-- @evidence requirements/review/subject-inspection.md#review-subject-inspection-reach 화면을 볼 수 없는 당사자가 검사를 요청할 수 있어야 한다는 요구를 요청 표면 계약으로 고정한다. -->

주체 검사 요청 표면은 주체 target, viewpoint plan 선택 규칙과 raster 크기를 입력으로 받고, 해석된 주체 record, plan, 각 시점의 해석된 camera state, 그 시점에서 생산된 관찰 artifact와 coverage를 반환한다. 표면은 저작된 camera, shot 경계와 film time을 입력으로 받지 않으며, 같은 주체, plan 선택 규칙과 raster 크기는 어느 요청자에게나 같은 시점 identity와 같은 camera state를 만든다.

표면이 반환하는 관찰은 delivery evidence로 표시될 수 없어야 하며 그 사실은 반환 형태 자체가 고정해야 한다. 관찰 artifact는 delivery render bundle 밖에 놓여 frame evidence 수집 경로에 들어가지 않아야 하고, 관찰 receipt는 host가 생산한 exact bytes의 digest와 그 관찰이 파생된 compile identity를 함께 가져야 한다.

관찰 artifact를 생산하는 host 기구가 없거나 그 산출물이 검증을 통과하지 못하면 표면은 관찰을 만들지 않고 거부하며, 거부는 없는 기구와 그 조달 방법을 이름으로 말한다.

### 주체 Observation Record {#review-system-subject-observation}

<!-- @evidenceObligation subject-observation 관찰 조건, 상태, artifact 또는 facts와 digest를 구분해 기록하는 portable record. -->

<!-- @evidence requirements/review/subject-inspection.md#review-subject-evidence 주체 관찰의 evidence 구성과 필수 표본 누락 상태를 정의한다. -->

주체 검사는 current plan record와 observation record를 분리한다. Plan record는 주체 target, compiled revision, compile fingerprint, ordered viewpoint population과 각 viewpoint의 direction, distance, projection, pose와 state를 가진다. 각 observation record는 주체 identity와 revision, required viewpoint identity, 실제 camera pose, artifact identity와 digest, compile fingerprint를 가진다.

필수 시점이 없거나 읽을 수 없으면 coverage는 complete가 될 수 없다. 결과는 원인에 따라 not-run, unsupported, indeterminate 또는 partial이며 관찰된 시점의 좁은 결과를 별도로 보존한다.

### 주체 Freshness {#review-system-subject-freshness}

<!-- @evidenceObligation subject-freshness 현재 compile, source, design, plan과 관찰 runtime identity에 묶인 freshness 검증. -->

<!-- @evidence requirements/review/subject-inspection.md#review-subject-evidence 주체 검토가 stale로 전환되는 조건을 freshness key로 고정한다. -->
<!-- @evidence requirements/review/subject-inspection.md#review-subject-time-noninterchange 시간 축 검토와 주체 검토가 서로의 freshness를 회복하지 못하게 한다. -->

주체 검토의 freshness key는 compiled subject revision, compile fingerprint와 current published viewpoint plan의 전체 내용이다. 주체나 구성 member, plan population 또는 관찰 조건이 바뀌면 current plan을 먼저 게시하고 그 plan의 observation sweep을 새로 생산한다. 이전 revision이나 fingerprint의 observation은 stale이며 current plan에 없는 viewpoint observation은 unplanned다.

Shot render, rendition 교체와 delivery 재생성은 주체 freshness key에 들어가지 않으므로 주체 observation을 current로 만들지 않는다. 반대로 주체 관찰의 갱신은 frame, 구간과 전체 작품 evidence를 current로 만들지 않는다.

### 주체 Coverage 집계 {#review-system-subject-coverage}

<!-- @evidence requirements/review/subject-inspection.md#review-subject-coverage 계획한 개체군과 실제 관찰한 개체군을 분리해 집계한다. -->
<!-- @evidence requirements/review/subject-inspection.md#review-subject-time-noninterchange 시간 축 coverage와 주체 coverage를 합산하지 못하게 한다. -->

주체 coverage는 선언된 개체군 정의, 그 정의가 만든 계획 대상 집합, 실제 관찰한 집합, 미관찰 집합과 표본 선택 규칙을 가진다. 개체군 정의가 없으면 completeness는 계산되지 않고 상태는 indeterminate다.

원형 개체군과 placement 개체군은 서로 다른 coverage 축이며 하나의 비율로 합치지 않는다. 주체 coverage와 frame·구간·전체 작품 coverage도 서로 다른 축이며, 한 축의 완결성 주장이 다른 축의 미관찰 범위를 덮지 않는다.

### Library 전달 관찰 집계 {#review-system-library-delivery-coverage}

Compiler는 graph-selected owner edge를 실행 전에 확인하고, maps/contexts, models/models, spaces/environments의 branch별 nonempty 결과만 materialize한다. Empty, cross-branch, unsupported 결과는 completed owner나 review denominator가 되지 않으며, 각 environment, model, context 파일의 generated manifest target은 materialized owner index의 정확히 하나인 branch/H2로 역해석되어야 한다.

<!-- @evidenceObligation library-delivery-observation-closure The production consumer closes every graph-derived map, model, space, material, instance, motion, and system delivery owner against its exact current plan, source, compile, runtime, evidence, and terminal-verdict identity. -->

<!-- @evidence requirements/review/subject-inspection.md#review-library-delivery-coverage Library의 graph-selected 전달 owner와 branch별 유한 current observation을 review denominator로 고정한다. -->

Library review resolver는 동일한 typed authoring declaration에서 active design branch, reviewed source binding, exact design document와 H2 digest를 읽고, 별도 domain 목록 없이 map·model·space·material·instance·motion·system owner 개체군을 만든다. Active branch는 owner가 0개여도 보존되어 empty population을 실패시키며, disabled branch와 selected binding 밖 파일은 filesystem residue만으로 승격하지 않는다. Map owner는 current extent와 coordinate, terrain·water·network·site interface를 plan·section·elevation·traversal 같은 declared finite observation으로 닫는다. Film과 brief는 이 resolver를 사용하지 않고 compiled shot·formation·model consumer에서 기존 review 개체군을 계산한다.

Library compiler는 review 이전에 그 개체군의 재료를 만든다. `design` 위의 모든 scope에서 reviewed source binding이 선택한 각 파일을 film shot source와 같은 deterministic sandbox에서 link·inspect·transpile·evaluate하고, `design`과 `build`를 가진 각 export를 하나의 exact design document/H2 주소에 묶는다. Active 선언이 소유하지 않는 주소, 한 owner를 등록하는 두 export, 두 owner가 발행한 같은 artifact id는 각각 자기 주소에서 거부한다. 반환된 built environment와 model은 shot source와 같은 engine validator를 통과해야 하며, 통과한 결과만 compiler-owned bytes로 원자적으로 발행된다. 발행물은 generated manifest에 소유·digest·source target으로 등재되어 stale과 tamper가 film 경로와 동일하게 판정되고, lint scope는 같은 기대 bytes를 검증하되 쓰지 않는다. 발행된 owner 색인은 각 artifact를 그것을 만든 branch, H2, source 파일, export와 source digest에 연결하므로, offline 관찰 명령이 source를 다시 실행하지 않고 compiler와 같은 required 개체군을 얻는다.

각 H2에 인접한 versioned plan은 manifest-derived source population 안의 exact source subset과 finite observation id·kind를 선언한다. Owner freshness identity는 H2 digest, normalized selected source bytes, compile fingerprint와 receipt를 제외한 canonical plan digest로 구성한다. Artifact receipt는 project text 또는 render bytes의 digest를, facts receipt는 canonical structured-fact digest를, model turntable receipt는 compiler가 정한 current whole-model view 집합과 적용 가능한 rig range를 다시 연다. 모든 receipt는 observation runtime identity와 passed, failed, unsupported 또는 not-run verdict를 가지며 current identity에 정확히 하나의 reopened passed receipt가 없으면 `review-evidence-missing`이다. 모호함은 current identity의 passed receipt 수로 센다. 같은 identity의 non-passed receipt는 관찰 history로 보존되어 완료를 만들지 않고 완료를 무효화하지도 않으므로, 새 결과를 기록하는 경로는 현재 accepted된 passed receipt만 대체하고 실패·미지원·미실행 기록은 삭제하지 않는다. Plan/receipt file은 물리 관찰의 locator이고 approval, waiver 또는 finding lifecycle ledger가 아니다.
