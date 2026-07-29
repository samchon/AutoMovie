# `@automovie/benchmark`

`@automovie/benchmark`는 automovie가 만든 영화를 **같은 법으로 언제든 다시 판정**하기 위한 순수 계약·adapter·judge 패키지다.

이 패키지는 agent를 실행하지 않고, 브라우저나 encoder를 소유하지 않으며, 파일 시스템도 건드리지 않는다. 외부 runner가 실제 MCP surface를 몰아 만든 산출물을 **불변 submission**으로 봉인하고, versioned task law에 대해 **deterministic verdict**를 낸다. 미학·서사처럼 기계가 판정할 수 없는 축은 rubric verdict로 분리해 점수에 섞지 않는다.

## 공개 표면

| 함수/타입 | 역할 |
|---|---|
| `IAutoMovieBenchmarkTask` / `validateAutoMovieBenchmarkTask` | versioned movie task law를 검증하고 canonical digest로 고정한다. assertion id 중복, 축 가중치 합, 예약 접두사뿐 아니라 comparand·tolerance·frame·runtime·calibration·sandbox 숫자가 각자의 유한한 정의역을 벗어난 경우도 거부한다. |
| `canonicalBenchmarkJson` / `digestBenchmarkValue` / `digestAutoMovieBenchmarkText` | key를 정렬한 canonical JSON과 SHA-256 digest. run identity와 law identity가 모두 여기서 나온다. |
| `benchmarkVersionDrift` | task·harness·reference·scenarioHelper 중 어긋난 필드를 이름으로 보고한다. |
| `AUTOMOVIE_BENCHMARK_GATES` / `resolveAutoMovieBenchmarkLifecycle` / `blockingAutoMovieBenchmarkGate` | 고정된 9개 lifecycle gate. 앞 gate가 통과하지 못하면 뒤 gate는 runner가 뭐라 보고했든 `not-run`이 된다. |
| `IAutoMovieBenchmarkSubmissionDraft` / `sealAutoMovieBenchmarkSubmission` | run 산출물의 구조와 물리적 숫자 정의역을 검증·정렬하고 내용 주소 `runId`를 붙여 **깊게 freeze**한다. scorer가 archive를 고치면 조용히 재채점되는 대신 실패한다. |
| `assertAutoMovieBenchmarkBinding` / `benchmarkComparisonDrift` | 다른 법·다른 brief로 만든 증거를 채점하는 것을 막고, production·legacy 비교에서 surface 외에 달라진 조건을 열거한다. |
| `appendAutoMovieBenchmarkTrace` / `replayAutoMovieBenchmarkTrace` / `benchmarkTraceKinds` | 한 줄 = 한 gzip member인 append-only oracle trace. 프로세스가 죽어 잘린 스트림은 마지막 온전한 줄까지 복원하고(`truncated`), 완결된 줄이 깨졌거나 sequence가 비면 거부한다. |
| `judgeAutoMovieBenchmarkSubmission` | `infra-excluded` → `gate-failed` → `scored` 순으로 판정한다. assertion마다 `pass`/`fail`/`unknown`과 증거 주소를 남기고, 축별 통과율에 가중치를 곱해 film score를 만든다. |
| `calibrateAutoMovieBenchmark` / `assertAutoMovieBenchmarkCalibrated` | reference·empty·mutant anchor가 각자의 band 안에 있는지 확인한다. judge refactor가 알려진 결함을 올리거나 정상 reference를 떨어뜨리면 여기서 실패한다. |
| `reportAutoMovieBenchmark` / `diffAutoMovieBenchmarkVerdicts` / `assertAutoMovieBenchmarkRubric` | surface별 집계에서 infra 실패를 분모에서 빼고, 두 verdict를 비교할 때 **점수보다 version drift를 먼저** 보고한다. rubric verdict는 비어 있지 않은 reviewer·rationale·증거 주소, 유한한 `0..1` score, 같은 보고서에 속한 run을 요구한다. |
| `austerlitzSignalTask` / `austerlitzSignalAnchors` / `austerlitzSignalDryRun` | short tier corpus 한 시나리오: 고정된 brief bytes, anchor 세 종류, 그리고 같은 법 아래의 production·legacy dry evaluation. |

## 두 점수를 섞지 않는다

- **generation health**: tool call 수, correction round, 비용, 소요 시간, token. 후보가 *어떻게* 일했는지다.
- **film score**: historical·production·frame·invariant·delivery 축의 가중 통과율. 후보가 *무엇을* 만들었는지다.

`IAutoMovieBenchmarkReport`는 둘을 같은 표에 나란히 싣되 한 숫자로 합치지 않는다. 싸고 빠른 실패와 비싸고 느린 성공은 다른 사실이고, 하나의 순위로 뭉개면 둘 다 읽을 수 없게 된다.

## 세 가지 결과는 서로 대체하지 않는다

| 결과 | 의미 | 분모 |
|---|---|---|
| `infra-excluded` | runner 중단, 요금·rate limit, harness 내부 오류 | 제외 |
| `gate-failed` | 후보가 lifecycle gate를 넘기지 못함 | 포함, 0점 |
| `scored` | final compile까지 도달해 법으로 측정됨 | 포함, 측정값 |

증거가 아예 없는 assertion은 `fail`이 아니라 `unknown`이다. capture가 실행되지 않은 침묵과 실행됐지만 틀린 프레임은 다른 사실이고, 이 구분이 없으면 둘 다 "통과 못함"으로 뭉개진다.

## 경계

실제 agent 실행, 브라우저·encoder 소유, 파일 시스템 레이아웃, leaderboard 저장은 이 패키지 밖이다. runner가 `.benchmarks/<campaign>/<run-id>/` 아래에 project·transcript·render·report를 보존하고, 이 패키지에는 봉인된 submission과 task law만 넘긴다. source archive는 scorer가 수정하지 않는다.
