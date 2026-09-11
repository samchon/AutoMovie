# 네이티브 증거 설정 변환

## 선언에서 평가 입력으로 {#spec-authoring-production-evidence-native-input}

### 네이티브 입력 투영 {#spec-authoring-production-evidence-native-boundary}

<!-- @evidence requirements/production-evidence/native-input.md#agent-production-evidence-native-boundary 작품의 소유권 선언을 보존하면서 네이티브 평가기 입력만 분리한다. -->

이미 소유권 검증을 마친 추가 claim마다 새 최상위 레코드를 만들고 작품 소유권 메타데이터만 제거한다. 원본 선언과 그 메타데이터는 manifest 판독을 위해 유지한다. 투영은 claim 순서와 native 필드를 그대로 보존하며 reference의 심각도, review 요구, exclusion 허용 여부, cardinality, host와 target selector를 바꾸지 않는다. 처음부터 native 형식인 claim과 빈 claim 배열에도 같은 무변경 정책을 적용한다.
