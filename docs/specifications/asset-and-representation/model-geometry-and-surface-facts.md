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
