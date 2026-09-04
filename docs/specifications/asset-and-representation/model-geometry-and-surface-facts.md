# 모델, 기하와 표면 사실

## 모델 저작 경계 {#asset-spec-model-authoring-boundary}

### 시대와 양식 입력 {#asset-spec-era-style-inputs}

<!-- @evidence requirements/asset-authoring/geometry.md#asset-general-geometry 한정된 catalogue가 아니라 새 대상의 기하와 표면을 저작할 수 있어야 한다. -->

시스템은 모델을 이름 붙은 부품, 부품 사이 관계, 기하, 표면 영역, 재료 결합과 선택적 변형 결합의 검증 가능한 사실 집합으로 취급한다. 특정 시대, 양식, 대상 종류나 완제품 목록은 모델의 필수 분류가 아니며, 사용자가 준 측정과 관계가 구조의 권위이다.

<!-- @evidence requirements/asset-authoring/era-and-style.md#asset-era-independent-expression 시대에 고정되지 않은 일반 저작 능력을 유지해야 한다. -->
<!-- @evidence requirements/asset-authoring/era-and-style.md#asset-style-as-input 양식을 catalogue 선택이 아니라 사용자가 준 관계와 제약으로 받아야 한다. -->
<!-- @evidence requirements/asset-authoring/era-and-style.md#asset-style-reference-role reference의 역할과 적용 범위를 입력으로 기록해야 한다. -->
<!-- @evidence requirements/asset-authoring/era-and-style.md#asset-style-mixing 여러 시대와 양식의 혼합 및 예외를 명시적으로 저작할 수 있어야 한다. -->
<!-- @evidence requirements/asset-authoring/era-and-style.md#asset-style-catalogue-refusal 완성 양식 catalogue를 능력 범위로 주장하지 않아야 한다. -->

시대와 양식은 사용자가 준 reference 역할, 형태·재료·pattern 관계, 시기, 혼합 규칙과 예외로 구성되는 모델 입력이다. 시스템은 reference를 치수나 의미의 자동 권위로 삼지 않고, 여러 양식을 결합할 때 각 적용 범위와 충돌 결정을 보존하며, 내장 완제품의 유무를 저작 가능성이나 지원 범위로 제시하지 않는다.

### 기하 입력 {#asset-spec-geometry-inputs}

<!-- @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry 기본 형상과 자유 형상을 같은 자산 구성 안에서 사용할 수 있어야 한다. -->
<!-- @evidence requirements/asset-authoring/geometry.md#asset-geometry-dimensions 실제 치수와 좌표 기준을 명시해야 한다. -->

기하 입력은 기본 형상 또는 자유 형상의 source facts, 실제 단위의 치수, 좌표계와 원점, 정점·곡선·면 또는 volume의 관계, 방향과 winding, 표면 영역 역할을 포함한다. 서로 다른 좌표계나 단위의 입력을 합칠 때는 각 source frame과 목적 frame, 변환 순서와 결과 오차를 명시한다.

### 조합 연산과 위상 불변식 {#asset-spec-geometry-operations-topology}

<!-- @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations 기하 연산을 재사용 가능한 순서로 조합할 수 있어야 한다. -->
<!-- @evidence requirements/asset-authoring/geometry.md#asset-geometry-topology 위상과 표면 역할이 후속 편집과 검증에서 유지되어야 한다. -->

생성, 변환, 결합, 분할, 절단, 반복, 변형과 재표본화는 입력 revision과 매개변수 순서를 가진 연산 계보로 기록한다. 연산 출력은 유효한 좌표, 면 연결, 방향, 표면 역할과 필요한 seam을 유지하고, 역할이 합쳐지거나 나뉘면 이전 영역에서 새 영역으로의 대응을 남긴다.

### 재료와 texture 관계 {#asset-spec-material-texture-relations}

<!-- @evidence requirements/asset-authoring/materials-and-textures.md#asset-material-texture-authoring 작품이 소유하는 재료와 texture를 새로 저작하고 조합할 수 있어야 한다. -->
<!-- @evidence requirements/asset-authoring/materials-and-textures.md#asset-material-composition 재료가 색, image, 표면 응답과 channel 관계를 조합할 수 있어야 한다. -->
<!-- @evidence requirements/asset-authoring/materials-and-textures.md#asset-texture-coordinates-scale texture 좌표, 축척과 sampling 의미를 제어할 수 있어야 한다. -->
<!-- @evidence requirements/asset-authoring/materials-and-textures.md#asset-user-authored-texture 사용자가 저작한 image와 texture를 독립 자원으로 결합할 수 있어야 한다. -->

재료는 표면이 빛과 합성에 응답하는 의미 및 입력 channel의 조합이고, texture는 좌표에 따라 표본화되는 독립 자원이다. 결합 기록은 재료 영역, texture revision, 좌표 집합, 좌표 변환, 실제 축척, 반복·clamp 정책, filtering, seam 처리, color space와 channel 의미를 명시하며 어느 image도 재료 의미를 암묵적으로 결정하지 않는다.

### 표면 좌표 규약 {#asset-spec-surface-coordinate-convention}

<!-- @evidence requirements/asset-authoring/materials-and-textures.md#asset-texture-coordinates-scale 좌표계, 실제 축척과 방향을 표면 쪽에서 관찰 가능한 사실로 고정해 같은 선언이 같은 배치를 만들게 한다. -->
<!-- @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations 각 기하 연산이 내는 좌표 집합의 축, 방향, 원점과 축척을 그 연산의 출력 계약으로 정밀화한다. -->
<!-- @evidence requirements/interior/grain-seams-and-continuity.md#interior-grain-corner-continuity 결의 연속과 단절이 face마다 독립 UV로 우연히 바뀌지 않도록 frame이 무엇에서 파생되는지 고정한다. -->

결합 기록이 이름 붙이는 좌표 집합은 세 종류로 구분되고, 그 종류가 좌표 변환의 축척을 읽는 단위를 결정한다. Metric surface 집합은 1 단위가 표면 위 1 m이므로 이미지 한 바퀴가 `tile` m를 덮을 때 축척은 `1 / tile`이고 표면 extent 항이 들어가지 않는다. Normalized 집합은 자기 표면을 정확히 한 번 덮으므로 축척은 `extent / tile`이며, 측정된 span이 1을 넘으면 선언이 결합된 기하와 모순이므로 거부한다. Source 집합은 임의의 저작 layout을 유지하므로 일반 물리 축척 공식이 없고 원본 layout이나 채택 기록이 변환을 공급한다. 좌표 종류를 선언하지 않은 결합은 어떤 단위 주장도 하지 않으며, 세 종류는 결합 기록만으로 구분되지 않으므로 결합이 그 종류를 직접 말한다.

<!-- @evidence requirements/production-design/palette-material-and-state.md#production-design-texture-scale-mapping 반복 규칙과 non-repeat 규칙이 각각 어떤 좌표 사실 위에서 성립하는지, 그리고 어느 쪽이 제품 경계 밖인지 고정한다. -->
<!-- @evidence requirements/product/scope-and-exclusions.md#product-exclusion-reopening packed layout 제외를 backlog가 아니라 다시 여는 조건을 가진 결정으로 기록한다. -->

한 표면은 좌표 집합을 하나만 가지고, 결합은 그 하나 외의 집합을 지목할 수 없으며 지목하는 선언은 거부된다. 여러 영역을 한 image 안에 배치하는 packed layout은 미결이 아니라 결정된 제외다. 배치 규칙은 저작 에이전트가 산문으로 말할 수 있는 종류의 결정이 아니고, layout은 engine 밖으로 나가 image를 그릴 대상이 될 때 비로소 값을 가지는데 제품에는 그 export 경로가 없다. 그래서 형상에 맞춰 그린 artwork는 blocking pass가 아니라 마감 lane이 답할 일이고, 저작 가능한 image는 실제 크기로 tile되는 것이거나 자기 extent를 이미 아는 하나의 평면 영역을 채우는 것이다. Non-repeat는 두 번째 집합이 아니라 표면 span 이상을 덮는 metric tile과 그 축을 clamp하는 sampler로 선언한다. 이 제외는 저작 에이전트가 packing 규칙을 직접 통제할 수 있고 layout이 나갈 곳이 생길 때 다시 검토한다.


좌표를 내는 모든 기하 연산은 하나의 handedness를 쓴다. 어느 삼각형에서든 u가 커지는 방향과 v가 커지는 방향의 외적은 그 면의 outward normal이고, 따라서 방향성 있는 무늬는 어느 연산이 만든 표면에서도 같은 쪽으로 읽히며 normal map의 tangent basis는 여러 member를 합친 buffer 전체에서 한 방향을 유지한다. 특정 연산을 보정하려고 이미지를 미리 뒤집지 않는다. 축의 홀수 개를 뒤집는 mirroring placement가 이 규약이 뒤집히는 유일한 지점이다. 그 placement는 outward face가 밖을 향하도록 winding을 뒤집으면서 좌표는 다시 자르지 않고 옮기므로 그 member의 atlas는 반대 handedness가 되고, 한 buffer 안에서 두 handedness가 섞이면 하나의 tangent basis가 양쪽을 답하지 못한다.


평면 face를 그대로 내는 연산은 투영 frame을 쓴다. 각 face의 frame은 그 face의 normal만으로 정해진다. Level이 아닌 face는 world up을 face 평면에 투영한 축을 v로 삼고 평면에 남는 직교 축을 u로 삼으며, level face는 world +X를 u로 삼는다. 좌표는 그 두 축에 정사영한 위치이고 원점은 mesh 자신의 원점이므로 단위는 m이다. Corner를 적은 순서가 아니라 normal에서 frame을 얻는 것이 규약의 핵심이다. 같은 평면 위의 face들은 corner를 어떤 순서로 적었든 하나의 연속 표면이 되고, 수직 모서리에서 만나는 두 face는 v가 위치의 같은 함수이므로 course가 모서리를 돌아 이어진다. u는 그 접힘을 돌아 이어지지 않으며 이는 선언된 단절이다. Level과 level이 아닌 face를 가르는 경계 자체도 선언된 방향 seam이므로 normal이 가깝다는 이유로 두 쪽이 연속을 주장하지 않는다. 이 연속성은 한 번의 build 호출이 공유하는 원점의 성질이므로, 따로 만들어 배치한 두 member는 아무리 정확히 맞닿아도 같은 datum을 공유하지 않는다.


단면을 잇는 연산은 developed frame을 쓴다. u는 단면 ring을 따라 이동한 거리로 그 ring의 정규 시작점에서 0이고 ring의 전체 perimeter까지 가며, v는 path나 meridian을 따라 이동한 거리로 그 첫 점에서 0이다. 둘 다 m이므로 하나의 선언된 축척이 투영 frame과 developed frame에서 같게 읽힌다. 양 끝 cap은 단면 자신의 좌표를 쓰고 두 cap의 v는 서로 반대 부호이므로 mirror 관계다. 회전면의 u는 lattice가 나아가는 방향의 반대로 흘러 seam 한쪽이 0을, 다른 쪽이 그 반지름의 전체 둘레를 읽고, 축 위에 놓인 meridian 점은 이동할 호가 없으므로 그 ring 전체가 0을 읽는다. Ring cut은 명시적 절단이며 반복 무늬의 위상은 선언된 반복이 그 perimeter를 나눌 때만 절단 양쪽에서 일치하고, 시스템은 어긋난 seam을 감추려고 finish를 늘이지 않는다. 압출 prism의 옆면 v는 mesh 중앙면을 0으로 하는 압출 좌표이므로 `-depth / 2`에서 `+depth / 2`까지 가며 밑면을 0으로 하지 않는다.


Developed frame이 정확히 equiareal인 것은 v가 재는 거리가 표면 자신의 이동 거리와 같을 때뿐이고, 회전면이 그 경우다. 회전면의 v는 meridian 자신의 polyline 길이이므로 Jacobian determinant가 어디서나 1이고, texel 밀도는 표면 전체에서 일정하며 왜곡은 두 축 사이의 각도로만 나타난다. 그 최악 anisotropy는 반지름이 아니라 meridian이 축에서 기운 정도로만 정해져서 `k = 2 * pi * |dr / ds|`에 대해 `(sqrt(k * k + 4) + k) / (sqrt(k * k + 4) - k)`이다. 축에서 6.5도에서 2, 13.8도에서 4, 45도 원뿔에서 21.7이고 meridian이 수평에 접근하면 41.5이다. 이 값은 pole의 성질이 아니라 기울기의 성질이므로 끝을 잘라낸 frustum도 같은 만큼 shear한다.

Path를 따라 단면을 잇는 연산의 v는 path의 이동 거리이지 표면의 이동 거리가 아니므로, 그 연산은 면적까지 잃거나 얻는다. 단면이 변하면 ruling이 path 걸음보다 taper 각의 secant만큼 길어져서 면적비는 그 각의 cosine이다. Path가 휘면 단면 점이 회전 평면 안에서 path에서 벗어난 부호 있는 거리 `d`와 그 지점 곡률 반경 `R`에 대해 면적비가 `R / (R + d)`이므로, 단면이 일정해도 바깥쪽 texel은 늘어나고 안쪽은 조밀해진다. `d`는 path까지의 거리가 아니라 path가 도는 쪽으로의 성분이며, 회전 평면에 수직으로만 벗어난 점은 아무리 멀어도 `d`가 0이어서 면적을 잃지 않는다. 따라서 수평으로 도는 구간에서 밀도를 정하는 것은 단면의 높이가 아니라 폭이다. `d / R`이 0.25이면 한 부재 안에서 밀도가 0.8배와 1.333배 사이로 벌어지고 0.5이면 0.667배와 2배로 벌어지며, 이 값은 `d / R`만의 함수이므로 부재를 키워도 줄지 않는다. 밀도가 일정하다는 주장은 따라서 회전면과 곧은 path 위의 일정 단면에만 해당하며, 휘거나 taper된 형태에서 밀도 변화는 선언된 성질이지 고칠 결함이 아니다. v가 표면 거리를 재려면 한 station 안에서도 단면 점마다 v가 달라져야 하는데 그것은 휜 관을 펼친 layout이지 이 frame이 아니고, 그 변경은 이 frame에 맞춰 이미 저작된 모든 좌표를 다시 쓴다.

Developed frame 위에서 방향성 있는 finish나 균일한 texel 밀도를 요구하는 finish가 정확한 구간은 단면이 일정하고 path가 곧은 구간, 그리고 축을 거의 벗어나지 않는 meridian뿐이다. 투영 frame은 face 평면의 강체 운동이므로 shear도 밀도 변화도 없고, 그래서 그 밖의 형태는 평면 face로 저작하거나 방향성 없는 finish를 쓴다.


좌표를 내지 않는 연산은 채움값을 넣지 않고 좌표 자체를 내지 않는다. 0으로 채우면 그 표면 전체가 한 texel에 고정되어 평평한 도장처럼 보이고 그 손실을 결합 시점에 귀속시킬 수 없기 때문이다.

Placement는 표면을 옮길 뿐 atlas를 다시 자르지 않으므로 좌표를 그대로 옮기며, 그래서 member의 좌표는 배치된 위치가 아니라 만들어진 frame에서 잰 값으로 남는다. 회전과 이동에서는 그것이 무상이지만 축척에서는 아니다. 좌표를 그대로 두고 표면만 늘이면 metric 집합이 주장하는 단위가 깨져서, 세 배로 배치된 member는 표면이 3 m인 곳에서 1을 읽고 finish가 세 배로 커진다. 비균일 축척은 face마다 계수가 달라 어떤 한 수로도 metric이 아니게 만든다. 축척된 배치는 그 member의 좌표 종류 선언을 무효로 만들며, 선언과 기하를 대조하는 검사는 part 자신의 좌표 span만 읽고 placement를 읽지 않으므로 이 불일치를 잡지 못한다. Atlas를 가진 member는 보일 크기로 저작해 이동과 회전으로만 배치하거나, 축척이 이미 거짓으로 만든 단위를 주장하지 않는다.

여러 mesh를 합치는 연산은 모든 member가 좌표를 가질 때만 좌표를 유지하고 하나라도 없으면 결과 전체가 좌표를 잃는다. 이 연산이 member마다 placement를 적용한 뒤 잇기 때문에, 한 member를 여러 크기로 재사용하는 조립이 위의 축척 문제를 만나는 자리도 여기다.


### 표면 상태와 교체 {#asset-spec-surface-states-substitution}

<!-- @evidence requirements/asset-authoring/materials-and-textures.md#asset-material-state 젖음, 손상, 오염과 같은 상태별 표면 표현을 같은 자산에 보존해야 한다. -->
<!-- @evidence requirements/production-design/palette-material-and-state.md#production-design-material-substitution 재료 대체가 역할, 상태와 연속성에 미치는 영향을 검토해야 한다. -->

표면 상태는 기본 재료를 덮어쓰는 이름 있는 상태 revision으로 기록하고, 영향을 받는 영역과 channel, 우선순위, 적용 조건과 provenance를 가진다. 재료나 texture 교체는 영역 역할, 실제 축척, 색 해석과 상태 coverage의 호환 결과를 산출하며, 일부 상태가 해석되지 않으면 부분 호환을 완전 호환으로 승격하지 않는다.

### 절차적 pattern 입력과 결정성 {#asset-spec-procedural-pattern-inputs}

<!-- @evidence requirements/asset-authoring/patterns-and-procedural-composition.md#asset-pattern-procedural-authoring 반복 규칙을 검토 가능한 자산 사실로 저작할 수 있어야 한다. -->
<!-- @evidence requirements/asset-authoring/patterns-and-procedural-composition.md#asset-physical-module 실제 치수를 가진 module과 이음 관계를 반복의 기준으로 보존해야 한다. -->
<!-- @evidence requirements/asset-authoring/patterns-and-procedural-composition.md#asset-procedural-rule 반복, 배열, 산포, 표면 분할과 사용자 정의 규칙을 자산 입력으로 보존해야 한다. -->
<!-- @evidence requirements/asset-authoring/patterns-and-procedural-composition.md#asset-deterministic-variation 같은 seed와 입력에서 같은 변주가 재생되어야 한다. -->
<!-- @evidence requirements/asset-authoring/patterns-and-procedural-composition.md#asset-pattern-boundary-exception 영역 경계와 명시적 예외를 반복 규칙의 입력으로 보존해야 한다. -->

절차적 pattern은 실제 module, 배치 영역, 인덱스 체계, 규칙과 매개변수, seed, 변주 범위, 경계 처리와 명시적 예외를 입력으로 가진다. 동일 revision, 규칙, 인덱스와 seed는 같은 결과를 내고, 삽입이나 부분 수정은 영향을 받지 않은 element의 identity와 변주를 유지한다.

### 자원 closure와 provenance {#asset-spec-surface-resource-closure}

<!-- @evidence requirements/asset-authoring/external-assets.md#asset-external-resource-closure 외부 모델의 buffer, image와 연관 자원을 닫힌 집합으로 검증해야 한다. -->
<!-- @evidence requirements/asset-authoring/external-assets.md#asset-bounded-decoder 외부 자원 해석의 크기, 수량, 중첩과 확장 한도를 적용해야 한다. -->
<!-- @evidence requirements/asset-authoring/materials-and-textures.md#asset-texture-provenance texture의 원본, license, 생성·편집 계보와 digest를 추적해야 한다. -->

모델 revision은 참조하는 모든 기하, image, sampler, animation, 변형 자료와 외부 의존성의 closure를 가진다. 각 자원은 취득 또는 저작 출처, license와 이용 조건, 원본·파생 digest, 변환 계보를 보존하며, 해석은 선언된 bytes·자원 수·중첩·압축 확장·시간 한도를 적용하고 기준 경계 밖의 경로 접근이나 선언되지 않은 network fetch를 허용하지 않는다.

### 출력 검증과 실패 {#asset-spec-model-output-failures}

<!-- @evidence requirements/asset-authoring/geometry.md#asset-degenerate-geometry-refusal NaN, 무한값, 영면적, 잘못된 index와 닫히지 않은 필수 volume을 거부해야 한다. -->
<!-- @evidence requirements/asset-authoring/validation.md#asset-surface-validation texture 좌표, color space, channel과 재료 관계를 사용 전에 검증해야 한다. -->

검증 출력은 수치 유한성, 실제 치수, 위상, 방향, self-intersection 정책, 표면 영역 coverage, texture 좌표와 sampling, 자원 closure, pattern 결정성의 상태와 근거를 포함한다. 필수 volume의 개방, 퇴화 면, 범위 밖 index, 누락 channel, 해석 불가능한 color space, 비결정적 절차 결과 또는 미해결 자원은 해당 element와 원인을 지목해 거부한다.
