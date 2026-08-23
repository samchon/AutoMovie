# 생성 프로젝트 증거 설정 입력 명세

## 선언 스키마 {#spec-authoring-production-evidence-declaration}

<!-- @evidenceObligation section-index 아래의 완전한 입력 상태 단위를 묶는 문서 구조. -->

### 설정 입력 상태 {#spec-authoring-production-evidence-input-state}

<!-- @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection 프로젝트의 완전한 선택을 하나의 명시적 입력 구조로 고정한다. -->

입력은 존재하는 절대 프로젝트 디렉터리 `location`, `film | brief | library | null`인 `kind`, 모든 저작·source 분기의 `disabled | draft | evidence | review` 단계, 선택적인 작품 전용 `claims` 배열로 구성한다. 분기 집합은 설정, 조사, 모델, 공간, 재료, 인스턴스, 모션, 시스템, 스토리라인, 시나리오, 영상 대본, brief, 각 디자인 source, shot, production source와 film source를 빠짐없이 포함한다. 상대·부재·파일 위치, 닫힌 집합 밖의 종류나 단계, 배열이 아닌 claim 입력은 파일 모집단을 읽기 전에 거부한다.

`null`은 아직 제작 종류를 선택하지 않은 빈 프로젝트 상태다. 패키지는 이 구조 밖의 설정 파일, 환경 변수나 파일 존재 여부로 누락된 입력값을 보충하지 않는다.

<!-- @evidenceObligation visible-selection 제작 종류, 모든 분기 단계, 프로젝트 루트와 추가 claim을 담고 숨은 입력을 금지하는 완전한 선언. -->
