# 범위와 제외

## 모든 객체와 모든 동작을 향한 범위 {#product-all-objects-motion}

장기 범위는 영화에 등장하는 모든 객체, 관계, 상태와 동작을 저작 가능한 구조로 표현하는 것이다. 현재 prototype의 단순한 표현은 이 범위를 닫는 이유가 아니라 점진적으로 확장되는 첫 품질 단계다.

### 인물 외형의 경계 {#product-detailed-likeness-exclusion}

인물 proxy는 정체성, 자세, 동작, 시선, 접촉과 연출을 정확히 전달해야 한다. 명시적 수치와 해부학적 부품으로 얼굴 형태와 표정을 저작하는 범위는 [얼굴 저작 요구사항](../actors/facial-authoring/contract.md)에 따른다. 이 범위는 사진에서 자동으로 완벽한 닮음을 복원한다는 약속이 아니며 각 인물의 닮음은 실제 출력과 사진을 비교해 따로 판정한다. 수치로 저작하는 눈썹과 면 기반 머리카락은 얼굴 자산 범위에 포함한다. 개별 모발의 물리 시뮬레이션, 몸통과 동물의 사실적 외형은 이 범위에 포함되지 않는다.

### 완성 콘텐츠 카탈로그의 제외 {#product-content-catalogue-exclusion}

AutoMovie와 새 project의 시작 구조는 작품별 건물, 가구, 복식, 장식, 차량, 식생과 음원을 완성품으로 제공하지 않는다. 필요한 콘텐츠를 project에서 만들 수 있는 일반 능력은 범위에 포함된다.

### 비결정적 자동 완성의 제외 {#product-nondeterministic-completion-exclusion}

선언되지 않은 장면을 확률적으로 채우거나 매 실행마다 다른 구조를 만드는 생성 결과는 정본이 될 수 없다. 외부 생성 결과를 사용할 때에도 선택된 bytes와 provenance를 고정한 뒤 입력으로 취급한다.

### 편집기와 export의 제외 {#product-editor-export-exclusion}

제품은 범용 interactive 3D 편집기나 scene export 도구가 아니다. 얼굴 부품의 수치 편집과 정적 얼굴 자산의 GLTF/GLB 내보내기는 [얼굴 저작 요구사항](../actors/facial-authoring/contract.md)에 명시된 제한된 저작 경로이다. 일반 작품의 저작은 project source에서 이루어지고 결과는 AutoMovie의 결정론적 검증과 렌더 경로 안에서 판단한다.

### 제외의 변경 조건 {#product-exclusion-reopening}

현재 제외는 숨은 backlog나 묵시적 약속이 아니다. 저작 에이전트가 해당 표현을 명시적으로 통제하고 사용자가 prototype에서 검증할 수 있으며 결정성과 source ownership을 유지할 수 있다는 근거가 생길 때 별도의 제품 선택으로 다시 검토해야 한다.
