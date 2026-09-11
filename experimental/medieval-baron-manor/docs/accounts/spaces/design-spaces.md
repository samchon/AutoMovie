# 저택 공간의 설계 책임

## 공간 결정의 주소 {#addressable-spatial-decisions}
<!--
@evidence obligations/design/spaces.md#addressable-spatial-decisions 현재 활성 환경의 공간 결정을 manor-space 한 주소에 모으고 실제 방·개구부·물품의 source 식별자를 유지한다.
@evidenceReview obligations/design/spaces.md#addressable-spatial-decisions #9c97153 이 납품의 활성 공간 source는 전체 본채 한 환경을 내보내며 본문은 그 환경의 층·방·연결·배치를 함께 결정한다. 방은 별도 건물이나 숨은 공간 소유자로 나뉘지 않고 안정된 source ID로 식별된다. 새로 독립 저작할 공간을 이 주소에 이름만 추가하는 경우는 같은 판단을 상속할 수 없다.
-->

현재 선택은 [manor-space](../../spaces/001-manor.md#manor-space) 하나이며 한 source가 전체 본채를 실현한다. 방·개구부·계단·배치의 식별자는 같은 환경에서 유지한다. 독립 공간 소유자가 생기면 이 전체 환경 주소만으로 그 저술을 완료라고 할 수 없다.

## 좌표와 연결 그래프 {#space-reference-topology}
<!--
@evidence obligations/design/spaces.md#space-reference-topology 같은 세계 좌표계의 지면·두 층·각 방과 회랑·계단·복도 사이 포함과 직접 연결을 비교한다.
@evidenceReview obligations/design/spaces.md#space-reference-topology #5053f99 1층 세 회랑과 중앙 현관, 북쪽에서 동쪽으로 꺾이는 계단, 상층 일자 복도 및 각 방의 직접 문이 한 본채 안에서 이어진다. 위층의 다른 침실을 경유하거나 정원을 방 union으로 메우는 연결은 본문의 명시된 구성과 충돌한다.
-->

세계 좌표와 두 층의 기준면을 공유한다. 지상층 필수실은 같은 회랑 또는 현관에, 상층 필수실은 같은 일자 복도에 직접 연결한다. 이름·경계·개구부를 같은 모델 원천에서 등록하여 서로 다른 건물의 연결을 섞지 않는다.

## 외피와 실내의 접점 {#space-envelope-interface}
<!--
@evidence obligations/design/spaces.md#space-envelope-interface 본채 외벽·지붕·층·내부 방과 개구부가 같은 형상에서 나온다는 관계를 전체 공간에서 비교한다.
@evidenceReview obligations/design/spaces.md#space-envelope-interface #4b397de source의 wall segment와 opening을 공간 경계로 쓰므로 외관의 창과 실내의 창을 별개 건물로 꾸밀 수 없다. 중정·계단 개방부를 메우지 않는 문장과 전체 외피를 보는 관찰이 안팎 불일치의 직접 반례를 남긴다. 보이지 않는 접합의 수치 증명은 이 납품의 추가 조건이 아니다.
-->

외피와 실내는 같은 원천 벽과 개구부를 사용한다. 정상 외관과 층별 관찰에서 한 본채의 지붕·벽·창·층 구성이 읽히는지 판단하며 실건물 접합·지지의 수치 인증으로 확대하지 않는다.

## 관찰 공간과 접근의 경계 {#space-access-circulation}
<!--
@evidence obligations/design/spaces.md#space-access-circulation 본채의 출입문·회랑·계단·복도가 설정의 직접 연결을 표현하는지 공간 설계와 소스 정의를 대조한다.
@evidenceReview obligations/design/spaces.md#space-access-circulation #76c5e04 공간 본문의 지상층 필수실은 회랑 또는 현관에, 상층 다섯 실은 같은 일자 복도에 직접 문을 둔다. manor.js의 room과 wall opening 정의에 이 방과 문이 있고 두 구간 계단판은 한 중간참으로 연결된다. 다른 침실을 경유하는 문이나 두 번째 계단은 이 설계와 충돌한다. 현재 렌더에서 문의 형체와 가림을 읽는 관찰은 아직 남아 있다.
-->

본채의 현관·각 필수실의 문·회랑·복도·계단이 설정의 직접 연결을 표현한다. 각 층의 평면과 계단 절개, 실내 시점에서 그 구성을 읽고 가려진 대상에는 다른 시점이나 선언 상태를 사용한다.

## 공간 관찰의 구성 {#space-review-set}
<!--
@evidence obligations/design/spaces.md#space-review-set 현재 3D의 외관·층·방·물품을 읽는 관찰을 평면·절개·투시와 실제 배치의 필요한 역할로 구별한다.
@evidenceReview obligations/design/spaces.md#space-review-set #86bcab4 공간의 관찰표는 외피를 reference-exterior와 exterior-northwest로, 층별 구성을 ground-plan·upper-plan·frame-axonometric으로, 두 구간 계단을 stair-section-west로 읽도록 정한다. 각 방의 실내 시점과 정원 두 시점은 배치된 물품과 회랑 관계를 맡고 남은 가림은 명시된 보조 시점에서 확인한다. 이 계획의 대상과 역할을 본문 및 원본 다섯 장에 대조했으며 현재 PNG의 촬영과 직접 열람은 아직 남아 있다.
-->

관찰 집합은 실제 활성 소유자와 원본 다섯 장의 시각 질문에서 정한다. 외관·층별 구성·모든 방과 물품·재료를 현재 렌더로 읽으며, 남은 가림과 연결 질문을 절개·근접·선언 상태에서 확인한다.
