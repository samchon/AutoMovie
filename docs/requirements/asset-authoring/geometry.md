# 형상 저작

## 새 대상을 만들 수 있는 기하 능력 {#asset-general-geometry}

저자 에이전트는 작품별 완성 model이 없어도 점, 선, 곡선, 면, solid, profile, path와 변환을 조합하여 필요한 객체와 공간의 blocking 형상을 만들 수 있어야 한다.

### 기본 형상과 자유 형상 {#asset-primitive-freeform-geometry}

Box, sphere, cylinder 같은 기본 형상뿐 아니라 돌출, 회전, sweep, loft, bevel, inset, shell, subdivision, boolean과 자유곡면을 조합할 수 있어야 한다. 자유 형상은 외부 asset에서 가져오거나 engine이 bake할 수 있을 뿐 아니라, 저자가 명시한 식·입력·일반 연산으로 ordinary source가 결정론적으로 생성할 수 있어야 한다. Agent가 불투명한 대량 vertex 배열을 손으로 전사하는 행위는 자유 형상 저작으로 간주하지 않는다.

### 실제 치수와 좌표 {#asset-geometry-dimensions}

형상은 선언된 단위, 기준 좌표, 크기, 두께, 방향과 pivot을 가져야 하며 화면에 보기 좋게 맞추기 위한 숨은 scale에 의존하지 않는다.

### 위상과 표면 역할 {#asset-geometry-topology}

Face, edge, loop, opening, inside, outside와 named region을 구분하여 재료, collision, deformation, pattern과 attachment가 같은 형상을 참조할 수 있어야 한다. 각 연산은 position, index, normal, UV, skin, 안정된 part·surface 범위와 bound를 보존·재생성·생략·거부하는 결과를 명시해야 한다.

### 조합 가능한 연산 {#asset-composable-geometry-operations}

새 건물, terrain feature, vehicle, prop나 장식을 만들기 위해 일반 연산을 순서대로 조합할 수 있어야 하며 특정 catalogue item에만 작동하는 비공개 shortcut에 의존하지 않는다. 연산 이름이 아니라 위상·속성·좌표·실패 postcondition으로 조합 가능성을 판단하고, 한 성공 예시나 임의 품질 점수로 일반 지원을 주장해서는 안 된다.

### 퇴화 형상의 거부 {#asset-degenerate-geometry-refusal}

NaN, 무한값, 0 두께 solid, 뒤집힌 경계, 닫히지 않은 필수 volume과 허용 범위를 벗어난 복잡도는 명시적으로 진단해야 한다.
