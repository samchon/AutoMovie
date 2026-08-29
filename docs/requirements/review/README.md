# 검토 요구사항

이 family가 제품에 약속하는 것은 사람이 직접 판정할 수 있도록 결정론적 결과를 열어 주는 검사 능력이다. 현재 제품 계약은 compiled subject 기술과 구조 비교, subject-owned viewpoint 검사, revision 사이의 시각 변경 보고를 소유한다. 작품 판단, 결함 분류, 대안 선택과 승인 기록은 AutoMovie의 저장형 서비스가 아니다.

- [주체 검토](./subject-inspection.md)
- [주체 기술과 구조 변경](./subject-description-and-structural-change.md)
- [시각 변경 보고](./visual-change-reporting.md)

PR #2100은 MCP review service와 ledger를 폐기했다. 아래 표는 그 변경 뒤 남아 있던 42개 exclusion-only H3와, source 인용이 있었지만 실제 계약을 구현하지 않은 4개 H3를 모두 다시 판정한 결과다. `절차` 항목은 제품 기능이 아니라 사람이 따라야 할 방법이며, 저장된 상태나 판정 API를 약속하지 않는다. 저장형 workflow를 `폐기`한 항목은 AutoMovie가 다시 다중 사용자 review record, 상태 전이, 승인과 waiver를 제품 기능으로 소유하고 그 기록을 읽는 실제 소비자까지 함께 제공할 때만 재개한다.

| 이전 requirement target | 최종 분류 | 현재 소유자 또는 재개 조건 |
| --- | --- | --- |
| `alternative-takes-and-versions.md#review-alternative-common-basis-difference` | 절차 | Production review가 공통 source, 의도와 실제 차이를 함께 읽는다. |
| `alternative-takes-and-versions.md#review-synchronized-comparison` | 절차 | Production review가 같은 사건, 시간과 presentation에서 비교하고 대응하지 않는 범위를 남긴다. |
| `alternative-takes-and-versions.md#review-candidate-specific-findings` | 절차 | Production review와 Git이 후보별 관찰과 변경 이력을 분리한다. |
| `alternative-takes-and-versions.md#review-alternative-selection` | 절차 | 선택자는 선택과 보류의 근거를 Git 또는 외부 제작 기록에 남긴다. |
| `alternative-takes-and-versions.md#review-comparison-history` | 절차 | Git history가 이전 비교를 보존한다. |
| `annotations-findings-and-verdicts.md#review-located-annotations` | 절차 | Repository review는 inline comment를, production review는 evidence citation의 exact subject, view, frame 또는 interval을 사용한다. |
| `annotations-findings-and-verdicts.md#review-observation-interpretation` | 절차 | Reviewer가 관찰, 기대, 차이, 영향과 확인되지 않은 원인을 분리한다. `reviewShot`의 pass/revise 정규화는 이 기록을 구현하지 않는다. |
| `annotations-findings-and-verdicts.md#review-verdict-rationale-disagreement` | 절차 | 상충하는 판단은 Git 또는 외부 제작 기록에 그대로 남긴다. |
| `annotations-findings-and-verdicts.md#review-annotation-history` | 절차 | Git history가 원관찰과 후속 수정을 보존한다. |
| `annotations-findings-and-verdicts.md#review-finding-lifecycle` | 폐기 | `getNotes`는 read-only correction query일 뿐 finding 상태 기계가 아니다. 저장형 review workflow를 다시 제품화할 때만 재개한다. |
| `approval-rejection-and-waivers.md#review-approval` | 폐기 | 승인은 사람과 외부 제작 절차의 결정이다. 저장형 approval consumer가 생길 때만 재개한다. |
| `approval-rejection-and-waivers.md#review-rejection` | 폐기 | 반려는 사람과 외부 제작 절차의 결정이다. 저장형 rejection consumer가 생길 때만 재개한다. |
| `approval-rejection-and-waivers.md#review-conditional-approval` | 폐기 | 조건부 승인은 사람과 외부 제작 절차의 결정이다. 조건 상태를 소비하는 제품 workflow가 생길 때만 재개한다. |
| `approval-rejection-and-waivers.md#review-waiver` | 폐기 | Waiver는 사람과 외부 위험 관리 절차의 결정이다. 범위와 만료를 소비하는 제품 workflow가 생길 때만 재개한다. |
| `approval-rejection-and-waivers.md#review-verdict-freshness` | 폐기 | 저장된 판정이 없으므로 제품이 그 freshness를 관리하지 않는다. 저장형 판정과 invalidation consumer를 함께 복원할 때만 재개한다. |
| `criteria-and-comparison.md#review-observable-criteria` | 절차 | Reviewer가 관찰할 사건, 허용 범위와 실패 조건을 먼저 정한다. |
| `criteria-and-comparison.md#review-criteria-precedence` | 절차 | Reviewer가 현재 instruction, production contract와 reference의 우선순위를 읽고 충돌을 보고한다. |
| `criteria-and-comparison.md#review-comparable-subjects` | 절차 | Reviewer가 source, 의도, 사건, 시간과 presentation의 비교 가능성을 확인한다. |
| `criteria-and-comparison.md#review-quantitative-qualitative-criteria` | 절차 | Compiler가 결정할 사실과 사람이 보아야 할 품질 판단을 분리한다. |
| `criteria-and-comparison.md#review-direct-observation-priority` | 절차 | Production reviewer가 실제 current frame, playback 또는 inspection output을 연다. |
| `criteria-and-comparison.md#review-noncomparable-state` | 절차 | 비교 basis가 다르면 우열을 만들지 않고 비교 불가 사유를 남긴다. |
| `defect-classification.md#review-defect-categories` | 절차 | Reviewer가 확인한 영향 영역을 finding에 적는다. |
| `defect-classification.md#review-defect-versus-variation` | 절차 | Reviewer가 계약 위반, 허용 variation과 제안을 구분한다. |
| `defect-classification.md#review-severity-priority` | 절차 | Reviewer가 영향과 처리 순서를 별개로 설명한다. |
| `defect-classification.md#review-reproduction-frequency` | 절차 | Reviewer가 재현 입력, 횟수와 실제 결과를 함께 남긴다. |
| `defect-classification.md#review-duplicate-common-impact` | 절차 | Repository 또는 production review가 공통 원인과 개별 증거를 함께 추적한다. |
| `frame-range-and-whole-work.md#review-frame-inspection` | 절차 | Production review가 exact frame에서 image 사실을 판단한다. |
| `frame-range-and-whole-work.md#review-range-inspection` | 절차 | Production review가 구간을 재생해 motion, timing, transition과 audiovisual sync를 판단한다. |
| `frame-range-and-whole-work.md#review-whole-work-inspection` | 절차 | Production review가 선택한 film, brief 또는 library shape의 전체 산출물을 그 shape의 순서와 구조로 판단한다. |
| `frame-range-and-whole-work.md#review-sampling-full-coverage` | 절차 | Reviewer가 표본과 전체 관찰을 구분하고 본 범위만 주장한다. |
| `frame-range-and-whole-work.md#review-cross-scope-propagation` | 절차 | Finding은 earliest owner에서 고치고 영향받은 인접, 상위와 downstream 범위를 다시 연다. |
| `records-and-completeness.md#review-planned-actual-coverage` | 절차 | Production review가 fresh manifest와 실제 관찰 집합을 대조한다. |
| `records-and-completeness.md#review-incomplete-review` | 절차 | 누락, 거부와 미지원은 완료로 바꾸지 않고 handoff에 기록한다. |
| `records-and-completeness.md#review-completeness-claim` | 절차 | 각 review skill의 complete-round stop condition만 완료를 결정한다. |
| `records-and-completeness.md#review-execution-status` | 폐기 | `review-evidence-missing`은 특정 compile refusal이지 저장형 review의 일곱 상태가 아니다. 상태 기계와 소비자를 다시 제품화할 때만 재개한다. |
| `records-and-completeness.md#review-verdict-receipt` | 폐기 | Oracle의 fingerprint와 frame record는 finding, verdict, actor와 time을 가진 receipt가 아니다. 저장형 verdict consumer가 생길 때만 재개한다. |
| `reproducible-context.md#review-context-source-artifact-identity` | 절차 | Reviewer가 exact source, revision, artifact와 derivation을 기록한다. |
| `reproducible-context.md#review-context-time-playback` | 절차 | Reviewer가 frame clock, interval과 playback 조건을 기록한다. |
| `reproducible-context.md#review-context-presentation` | 절차 | Reviewer가 raster, pass, color, audio, language와 accessibility 조건을 기록한다. |
| `reproducible-context.md#review-context-criteria-reference` | 절차 | Reviewer가 적용한 contract, criterion과 reference revision을 기록한다. |
| `reproducible-context.md#review-context-unavailable` | 절차 | 다시 열 수 없는 basis는 검토 완료가 아니라 명시적 제한이다. |
| `scope-and-authority.md#review-validation-decision-boundary` | 절차 | Compiler는 결정 가능한 사실을 거부하고 reviewer는 지각과 의미를 판단한다. |
| `scope-and-authority.md#review-human-final-authority` | 절차 | Agent Self-Review와 compiler pass는 사람 또는 조직의 외부 승인으로 가장하지 않는다. |
| `scope-and-authority.md#review-verdict-scope-boundary` | 절차 | Reviewer는 선언하고 실제로 읽은 범위만 판단한다. |
| `scope-and-authority.md#review-no-implied-approval` | 절차 | Finding 부재, green check와 시간 경과는 외부 승인을 만들지 않는다. |
| `subject-inspection.md#review-observable-judgeable-parity` | 제품 | AutoMovie가 직접 검사 target으로 공개한 모든 종류는 실제 observation을 만드는 대응 표면을 가져야 한다. Subject record, viewpoint plan, capture와 coverage가 이 불변식을 구현한다. |

Repository 변경 검토는 [Review skill](../../../.agents/skills/review/SKILL.md)이 소유하고, 생성 production의 evidence review와 whole-production review는 [shipped Production review](../../../packages/template/scaffold/.agents/skills/review-verification/review.md)가 소유한다. 둘 다 검토 범위, 실제 관찰, finding과 완료 조건을 절차 안에서 유지하고 별도 제품 ledger를 만들지 않는다.
