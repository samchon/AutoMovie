# 식별자, 자원과 수명 주기

## 식별자 경계 {#asset-spec-identity-boundary}

### 입력 식별자와 명명 공간 {#asset-spec-identity-inputs}

<!-- @evidence requirements/asset-authoring/identity-and-instances.md#asset-stable-identity 모델, 구성 요소, 재료 영역, 리그, 변형, 프로토타입과 인스턴스를 안정적으로 참조할 수 있게 한다. -->

시스템은 작품 속 같은 대상을 가리키는 자산 식별자를 파일 위치, 표시 이름, 모델 표현, 자원 digest, 장면 배치와 분리한다. 자산 식별자는 표현이나 원본 bytes가 교체되어도 의미가 유지되는 동안 존속하며, 서로 다른 의미를 합치거나 하나의 의미를 암묵적으로 둘로 나누지 않는다.

<!-- @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-collision-ambiguity 외부 element와 내부 식별자의 충돌을 모호하지 않게 해석해야 한다. -->

자산 후보는 요청된 자산 식별자, 원본 식별자와 revision, 내부 element 식별자, 의존 자원 식별자, 목적, 좌표계·단위·시간·색 의미를 입력으로 받는다. 명명 공간이나 대응 관계가 생략되어 둘 이상의 해석이 가능하면 시스템은 임의의 이름 변경이나 첫 항목 선택 없이 충돌 후보와 필요한 결정을 반환한다.

### 모델과 자원의 분리 {#asset-spec-model-resource-separation}

<!-- @evidence requirements/asset-authoring/materials-and-textures.md#asset-material-image-independence 재료 의미와 image 자원을 독립적으로 교체하고 추적할 수 있어야 한다. -->

모델은 부품 관계, 표면 역할, 변형 결합, 상태와 능력을 묶는 의미 구조이고, 자원은 그 구조가 참조하는 기하 자료, image, animation sample, audio 또는 그 밖의 고정 bytes이다. 모델 revision은 사용한 자원 revision을 정확히 참조하며, 같은 자원을 여러 모델이 공유하거나 같은 모델이 자원만 교체할 수 있지만 어느 경우에도 의미 식별자와 content identity를 같다고 간주하지 않는다.

### 원본, revision과 content identity {#asset-spec-source-revision-content}

<!-- @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-source-revision 같은 원본의 서로 다른 revision을 구분하고 작품이 읽는 revision을 고정해야 한다. -->
<!-- @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-content-provenance 내용 동일성과 출처 동일성을 독립적으로 판정해야 한다. -->

원본 식별자는 취득 위치가 바뀌어도 같은 출처 계보를 가리키고, revision 식별자는 특정 시점의 원본 상태를 가리키며, content identity는 실제 bytes와 정규화 규칙으로 판정한다. 동일한 bytes를 서로 다른 경로에서 얻은 경우 content identity는 같을 수 있으나 provenance는 합치지 않고, 같은 경로에서 bytes가 달라진 경우 새 revision과 새 content identity를 부여한다.

### element와 소비자 연결 {#asset-spec-element-consumer-links}

<!-- @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-elements-dependencies 외부 장면의 node, mesh, material, image, animation과 의존성을 개별 추적해야 한다. -->
<!-- @evidence requirements/external-inputs/credentials-rights-and-provenance.md#external-provenance-derivation-consumers 파생 결과와 이를 소비하는 작품 요소를 역추적할 수 있어야 한다. -->
<!-- @evidence requirements/asset-authoring/external-assets.md#asset-semantic-enrichment 외부 element에 더한 의미와 능력을 원본 구조의 별도 대응으로 보존해야 한다. -->

채택된 기록은 원본 element에서 모델 부품, 표면 영역, 리그 channel, 표현, 장면 subject로 이어지는 대응과 각 의존 자원을 보존한다. 소비자는 위치 문자열이 아니라 채택된 revision과 element identity를 참조하며, 갱신 영향 분석은 이 연결을 따라 stale 후보를 계산한다.

### 수명 주기 상태 {#asset-spec-lifecycle-states}

<!-- @evidence requirements/external-inputs/validation-and-quarantine.md#external-validation-adoption-gate 격리된 외부 입력은 검증과 사용자 채택을 통과한 뒤에만 작품 자산이 된다. -->

외부 후보의 상태는 `candidate`, `quarantined`, `validated`, `adopted`, `current`, `stale`, `superseded`, `rejected`, `unsupported` 중 하나로 기록한다. 로컬 저작 결과는 취득 격리를 생략할 수 있으나 검증 결과 없이 `current`가 될 수 없고, `stale`이나 `superseded` 상태는 과거 결과를 삭제하지 않은 채 현재 사용 금지만 표현한다.

### 채택 출력과 receipt {#asset-spec-adoption-output}

<!-- @evidence requirements/asset-authoring/external-assets.md#asset-external-conversion-receipt 외부 자산 채택은 입력, 대응, 변환, 손실과 결과를 검토 가능한 기록으로 남겨야 한다. -->
<!-- @evidence requirements/asset-authoring/external-assets.md#asset-external-provenance-digest 외부 자산의 출처, revision과 content digest를 채택 결과에 연결해야 한다. -->

채택 출력은 자산·모델·자원 revision 식별자, 선택한 채택 방식, 원본과 결과 digest, element 대응, 좌표·단위·색·시간 변환, 보존·근사·누락 사실, 검증 상태, 권리와 provenance, 생성된 파생물, 현재 소비자 목록을 포함하는 canonical receipt이다. 동일 입력과 동일한 결정론적 해석 규칙은 동일한 결과와 receipt를 산출해야 한다.

### 실패와 교체 호환성 {#asset-spec-identity-failure-compatibility}

<!-- @evidence requirements/asset-authoring/external-assets.md#asset-external-replacement 교체 전후의 대응과 소비자 영향을 검토할 수 있어야 한다. -->
<!-- @evidence requirements/external-inputs/unsupported-and-degradation.md#external-support-regression-compatibility 과거에 지원된 입력의 지원 축소를 새 실패로 명시해야 한다. -->

식별자 충돌, 누락된 의존성, digest 불일치, 해석 불명확성 또는 검증되지 않은 revision은 채택 실패이며 진단은 대상 식별자와 실패 단계를 지목한다. 교체는 이전과 새 모델의 부품·표면·rig·state·representation 대응, 유지되지 않는 능력과 stale 소비자를 receipt에 남기며, 의미 호환성을 증명할 수 없으면 기존 식별자 아래의 무음 교체를 거부한다.
