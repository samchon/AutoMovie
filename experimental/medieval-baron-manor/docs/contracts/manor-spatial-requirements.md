<!--
@evidence discovery/core/common.md#shared-local-boundary 이 저택에서는 같은 본채의 연속 회랑·단일 꺾임계단·일자 복도를 다른 연결 형식으로 교체할 수 없다. 재사용 공간 계약의 일반적인 연결 유효성과 별도로 이 고정 그래프를 아래 보존 항목으로 유지한다.
@evidence discovery/core/common.md#canonical-realization 고정 그래프의 권한은 settings/003-spatial-basis.md에 있고, spaces/001-manor.md#manor-space와 src/spaces/manor.ts#manorSpaceSource가 각각 설계와 등록 source를 맡는다. lint.config.ts의 Manor spatial requirements are realized by the authored space claim이 이 계약을 공간 H2에 연결한다.
@evidence discovery/core/settings.md#directive-promise-subject-requirements 단일 본채와 방별 직접 연결은 settings/003-spatial-basis.md, 가족 배경과 모든 생활 물품은 settings/002-household.md, 이미지 기반 시각적 납품과 관찰 종료는 settings/001-production.md가 소유한다. 실건물의 물리적 적합성은 delivery-scope에서 비요구로 분류한다.
@evidence discovery/core/settings.md#planned-delivery-backcast 실제 공간 carrier와 3D 모델·배치가 공유할 기준면과 계단 형식은 coordinate-datum과 single-stair가 정한다. 외형·가구·재료는 reference-priority와 visual-grammar, 실제 렌더의 관찰은 observation-population이 정하며 물리 사용성 대리 형체를 추가 조건으로 채택하지 않는다.
@evidence discovery/design/spaces.md#work-specific-space-requirements 남쪽으로 열린 ㄷ자 본채에서 1층 필수실은 같은 회랑에, 2층 필수실은 같은 일자 복도에 직접 연결되는 고정 구성을 보존한다. 이 제작 고유의 형식은 아래 항목과 기존 공간 claim이 소유하며 실건물 사용성의 수치 조건을 추가하지 않는다.
@evidenceReview discovery/core/common.md#shared-local-boundary #ae499c0 공유 연결 원칙만으로는 남쪽으로 열린 ㄷ자·한 꺾임계단·상층 일자 복도를 선택하지 않는다. 이 계약은 사용자가 확정한 그 형식을 보존하므로 다른 유효한 평면으로 바꾸는 경우를 실제 반례로 남긴다.
@evidenceReview discovery/core/common.md#canonical-realization #5a6e541 보존 조건의 원천은 settings/003-spatial-basis.md이고 실현 소유자는 manor-space 및 등록된 manorSpaceSource다. 기존 공간 claim이 같은 H2를 대상으로 하므로 계약이 작업 메모에만 남지 않으며 새 독립 물리 검사 claim을 만들지 않는다.
@evidenceReview discovery/core/settings.md#directive-promise-subject-requirements #1c99050 현재 설정에는 본채 전체·각 실·여섯 식사 자리와 물품·정원·시각 관찰의 소유자가 남아 있다. 운반·착석·유효 치수 시험의 비요구는 delivery-scope가 분류하며, 이 분류를 물통이나 의자 삭제로 바꾸면 해당 방의 목록을 위반한다.
@evidenceReview discovery/core/settings.md#planned-delivery-backcast #73ac216 현재 공간과 모델·배치가 필요로 하는 축·층 기준면·고정 연결·재료 언어 및 관찰 경계는 연결한 설정에 있다. 등록된 기존 숫자를 실건물의 합격 조건으로 읽지 않으며, 표현 인터페이스의 구체 설계는 그 자식 소유자에 남긴다.
@evidenceReview discovery/design/spaces.md#work-specific-space-requirements #a751db6 ground-access와 upper-access의 각 방 직접 연결 및 single-stair의 한 꺾임계단을 계약 본문과 대조했다. 공유 공간 계약이 허용할 다른 연결 형식도 여기서는 반례가 되며, 사람의 통과·머리높이·운반 시험으로 이 시각적 공간 보존 조건을 확대하지 않는다.
-->
# 저택 공간 보존 계약

**Status:** production decision, user-confirmed.

적용 대상은 `medieval-baron-manor`의 단일 본채 전체다. 사용자 확정 공간
그래프는 [단일 저택의 공간 조건](../settings/003-spatial-basis.md)이 소유한다.
이 계약은 공간 설계마다 해당 연결을 보존하는 조건이다.

## Adopted spatial requirements {#manor-spatial-requirements}

남쪽으로 열린 하나의 ㄷ자형 본채 안에서 현관·연속 회랑·중앙 단일
꺾임계단·상층의 일자 복도와 필수실의 직접 연결을 보존한다. 실제 source의
벽·바닥·개구부·계단 형상이 그 구성을 표현해야 한다. 방의 이름만
등록하거나, 방 체적을 합친 평면으로 계단 개방부를 메우거나, 필수실을
통과해야 다른 실에 도달하게 만드는 결과는 이 조건에 실패한다.

설계 소유자는 [실제 저택 공간](../spaces/001-manor.md#manor-space),
등록 source는 `src/spaces/manor.ts`의 `manorSpaceSource`다. 이 source가
소비하는 파생 공간은 현재 `src/models/manor.js`의 실제 형상과
`src/instances/manor.js`의 배치에서 생성한다. 현재 source와 맞지 않는
생성물이나 현재 렌더에서 확인하지 않은 공간 표현을 완료 근거로 쓰지 않는다.

Review question: 현재 3D의 본채·각 층·방·회랑·꺾임계단·복도와 개구부가 설정의 고정 공간 구성을 실제 형태로 보존하는가?

Sources: [본채와 중앙정원](../settings/003-spatial-basis.md#single-house), [1층 직접 연결](../settings/003-spatial-basis.md#ground-access), [중앙 단일 꺾임계단](../settings/003-spatial-basis.md#single-stair), [2층 직접 연결](../settings/003-spatial-basis.md#upper-access), [전체 납품 범위](../settings/001-production.md#delivery-scope).
