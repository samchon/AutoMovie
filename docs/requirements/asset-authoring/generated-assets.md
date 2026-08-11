# 생성 자산 채택

## 생성 결과를 작품 자산으로 채택 {#asset-generated-adoption}

사용자는 자신이 선택한 local tool, 제작 과정 또는 external generation service에서 얻은 geometry, model, motion, image, texture, audio와 다른 결과를 검토한 뒤 작품 자산으로 채택할 수 있어야 한다.

### Provider와 model 독립성 {#asset-generation-provider-independence}

생성 자산의 저작과 채택은 특정 provider, model, API 또는 account를 필수나 기본으로 정하지 않아야 하며 사용자가 권한을 가진 도구의 결과를 같은 자산 계약으로 받아들일 수 있어야 한다.

### Request, attempt와 채택 결과 {#asset-generation-attempt-lineage}

Generation request, 각 attempt, raw output, 후처리 결과와 최종 채택 자산은 서로 다른 identity와 digest를 가져야 하며 rejected 또는 failed output을 채택된 결과의 provenance에 섞지 않아야 한다.

### 재현성 주장 경계 {#asset-generation-reproducibility-boundary}

Prompt, seed, model과 version, controls, references, execution boundary와 output digest를 기록하되, 같은 seed와 request만으로 같은 bytes나 형상이 다시 생성된다고 보장하지 않아야 한다.

### 생성 입력과 사용 권한 {#asset-generation-input-rights}

사용자는 generation input과 reference를 사용할 권한, acquisition 시점의 retention과 output usage 조건, 생성 결과의 license 또는 제한을 확인하고 자산 provenance에 비밀정보 없이 기록할 수 있어야 한다.

### 고정된 bytes와 해석 {#asset-generation-fixed-output}

채택된 생성 결과는 current bytes, format, units, coordinate convention, feature support와 validation 상태에 고정되어야 하며 외부 service의 mutable result나 같은 prompt의 재실행을 현재 자산처럼 참조하지 않아야 한다.

### 절차적 자산과 비결정적 생성의 구분 {#asset-procedural-generation-distinction}

Project-owned rule과 seed로 재계산되는 deterministic procedural asset은 외부 또는 비결정적 generation output과 구분되어야 하며, 어느 경로로 만들어졌는지에 따라 재생성 가능성과 provenance를 다르게 주장해야 한다.

### 채택 방식의 재사용 {#asset-generated-adoption-modes}

생성된 3D scene도 외부 자산과 같은 direct placement, native conversion 또는 group과 assembly 합성 중 사용자가 고른 방식으로 채택할 수 있어야 한다.

### 생성 결과 거부 {#asset-generation-refusal}

Missing output bytes, unknown model version, absent request lineage, unsupported format, incomplete resource closure, unavailable usage terms와 leaked credential이 있는 결과를 current asset으로 채택하지 않아야 한다.
