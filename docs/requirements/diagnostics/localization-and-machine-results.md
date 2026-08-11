# 현지화와 기계 판독 결과

## 표시 문구와 정규 의미의 분리 {#diagnostics-message-semantic-separation}

진단은 사람이 읽는 현지화 문구와 자동화가 판단하는 정규 identity, 분류, 심각도, 상태와 context를 분리해야 한다. 문구 변경이나 번역이 같은 진단을 다른 종류로 보이게 하거나 자동화의 성공 판정을 바꾸지 않아야 한다.

### 기계 판독 가능한 결과 {#diagnostics-machine-readable-result}

기계 판독 결과는 진단 identity, 심각도, 분류, 경로, 영향 범위, subject와 시간 context, 원인 자료, 교정 자료, 입력 및 실행 identity와 결과 완전성을 손실 없이 제공해야 한다. 자유 형식 문장을 분석해야만 핵심 의미를 얻는 구조에 의존하지 않아야 한다.

결과 형식의 version과 의미 범위를 확인할 수 있어야 한다. 알 수 없는 진단 identity, 분류 또는 추가 항목을 만났을 때 이를 성공이나 무시 가능한 정보로 자동 해석하지 않아야 한다.

### Locale 선택과 Fallback {#diagnostics-locale-fallback}

사용자는 표시 locale을 선택할 수 있어야 하고 결과는 실제 사용한 locale을 밝혀야 한다. 요청한 번역이 없으면 선언된 fallback locale을 사용하고 fallback이 발생했음을 표시하되 정규 identity와 심각도는 유지해야 한다.

번역은 원인, 영향과 교정 가능성을 보존해야 한다. 번역되지 않은 내부 이름, 서로 다른 언어의 조각과 모호한 약어 때문에 사용자가 대상을 찾지 못하는 경우 원래 identity와 안전한 설명을 함께 제공해야 한다.

### 값, 단위와 시간 표기 {#diagnostics-value-unit-time-format}

수치, 단위, 좌표, 범위, 비율, frame과 시간은 locale별 표시와 무관하게 정규 값을 보존해야 한다. 소수점, 자릿수 구분, 시간대와 단위 변환으로 관찰값이나 허용 범위가 달라지지 않아야 한다.

### 접근 가능한 표현 {#diagnostics-accessible-presentation}

심각도와 상태는 색상, 아이콘 또는 소리만으로 전달하지 않아야 한다. 진단의 순서, 대상, 원인과 교정 힌트는 보조 기술과 텍스트 출력에서도 같은 의미와 관계를 유지해야 한다.

### 안전한 표시와 Export {#diagnostics-safe-localized-export}

현지화된 문구와 기계 판독 결과는 [외부 입력과 보안 실패](./external-input-and-security.md#diagnostics-redaction)의 redaction 경계를 함께 지켜야 한다. Locale 변경이나 export 형식 변경이 가려진 secret을 다시 노출하지 않아야 한다.
