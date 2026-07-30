# 나폴레옹 시대 전열 전투 구현 고증

이 문서는 AutoMovie의 1분·5분·20분 전열 전투 시나리오가 사용할 사실 원천이다. 수치는 국가, 연도, 무기, 훈련, 지형에 따라 달라지므로 하나의 보편 상수로 일반화하지 않는다. 타입은 출처가 있는 관측값과 시나리오가 선택한 조건을 기록하고, 엔진은 그 입력을 결정론적으로 계산한다.

## <a id="musket-rate-of-fire"></a>머스킷 발사율과 장전 동작

Royal Armouries는 영국 India Pattern 머스킷의 전투 기대 발사율을 분당 3발로 제시한다. 이는 약 20초의 이상적 cycle이지만 모든 병사가 실제 전투에서 계속 유지한다는 뜻은 아니다. 흑색화약 오염, 불발, 대형 정렬, 명령 대기, 피로, 이동을 별도 입력으로 둔다.

모션 어휘의 기본 장전 cycle은 `halfCock → handleCartridge → primePan → closeFrizzen → castAbout → chargeBarrel → drawRamrod → ram → returnRamrod → shoulderOrPresent`로 분해한다. 단계별 시간의 합은 무기 프로파일의 `reloadSeconds`가 되며, 애니메이션은 이 순서를 건너뛰고도 탄약 상태만 채우지 못한다.

권장 기본값은 훈련된 영국 보병의 정지·정렬 상태에서 20초다. 이동 중, 대형 붕괴, 젖은 화약, 부상 상태는 별도 multiplier 또는 상태 전이로 늦추며 보편 수치를 발명하지 않는다.

출처: [Royal Armouries, Waterloo 1815, India Pattern musket](https://royalarmouries.org/objects-and-stories/stories/waterloo-1815), [The Manual and Platoon Exercises, 1804](https://books.google.com/books?id=YBzJE3saYicC).

## <a id="musket-accuracy-by-range"></a>거리별 머스킷 명중 관측

다음 표는 사거리 감쇠 모델을 만들 수 있는 사격장 관측이다. 표적 크기와 사격 조건이 다르므로 행 사이를 한 곡선으로 무비판적으로 합치지 않는다.

| 시험 | 거리 | 명중/발사 | 관측 비율 | 표적·주의 |
|---|---:|---:|---:|---|
| 1755 Prussian grenadiers | 150 paces | 비율만 보고 | 46% | 폭 10 paces, 높이 10 ft의 대형 표적 |
| 1755 Prussian grenadiers | 300 paces | 비율만 보고 | 12.5% | 같은 대형 표적 |
| French infantry test | 100 m | 52/720 | 7.22% | 3 m 표적 |
| French infantry test | 200 m | 18/720 | 2.50% | 3 m 표적 |
| Scharnhorst 1810, Prussian M1809 | 160 yd | 113/200 | 56.5% | formed company 크기의 대형 표적 |
| Scharnhorst 1810, Prussian M1809 | 320 yd | 42/200 | 21.0% | 같은 대형 표적 |
| Scharnhorst 1810, British India Pattern | 160 yd | 116/200 | 58.0% | 같은 대형 표적 |
| Scharnhorst 1810, British India Pattern | 320 yd | 55/200 | 27.5% | 같은 대형 표적 |
| Scharnhorst 1810, French M1777 | 160 yd | 99/200 | 49.5% | 같은 대형 표적 |
| Scharnhorst 1810, French M1777 | 320 yd | 55/200 | 27.5% | 같은 대형 표적 |

이 비율은 사람 한 명을 맞힐 확률이 아니다. `targetWidth`, `targetHeight`, `range`, `weapon`, `benchOrBattle`, `smoke`, `shooterState`, `formationState`를 입력으로 분리한다. 엔진의 기본 accuracy curve는 선택한 동일 시험의 점들을 보간하고, 전투 modifier는 별도 곱으로 기록한다. 50~100 paces가 신뢰 가능한 실전 범위였다는 Royal Armouries의 요약도 이 분리를 지지한다.

출처: [Royal Armouries, Waterloo 1815, Prussian Model 1809 trials](https://royalarmouries.org/objects-and-stories/stories/waterloo-1815).

## <a id="musket-misfire-and-ammunition"></a>불발과 탄약은 독립 state다

flintlock의 불발은 명중 분산이 아니다. `ready`, `primed`, `loaded`, `fouled`, `misfired`, `ammunition`을 분리하고, seed로 불발을 먼저 판정한 뒤 발사된 탄에만 분산을 적용한다. 출처 없이 전군 공통 불발률을 고정하지 않는다. 시나리오는 무기·날씨·보급 조건에 근거한 `misfireProbability`를 명시하고 provenance를 남긴다.

훈련 탄약 배정도 군대별로 크게 달랐다. Royal Armouries는 Waterloo 전후 훈련 배정 예로 영국 line infantry 30발, Austrian line infantry 1805년 6발·1809년 10발, Russian infantry 6발 이하를 제시한다. 이 차이는 숙련도를 국적 상수로 만들 근거가 아니라 시나리오별 training evidence를 요구하는 근거다.

출처: [Royal Armouries, Waterloo 1815](https://royalarmouries.org/objects-and-stories/stories/waterloo-1815).

## <a id="formation-ranks-and-depth"></a>전열의 열 수와 깊이

1791년 프랑스 보병 교범은 전시 중대를 3열로 편성하고, 각 열 사이를 앞사람의 등 또는 배낭과 뒷사람의 가슴 사이 한 프랑스 foot로 둔다. 평시 훈련에서는 전시 3열과 비슷한 정면 폭을 유지하도록 2열 편성을 허용한다. 따라서 `rankCount`는 국가·시기·상황의 입력이며 항상 2 또는 항상 3으로 고정하지 않는다.

정면 폭은 `files × lateralSpacing`으로 계산하고 장교·색대·간격을 별도 항목으로 더한다. 교범이 직접 주지 않은 보편 lateral spacing을 하드코딩하지 않는다. 대대는 8개 fusilier platoon을 4개 division으로 묶고, platoon은 좌우 두 section으로 나눈다는 1791 구조를 프랑스 시나리오의 명령 단위로 쓸 수 있다.

출처: [Règlement concernant l’exercice et les manœuvres de l’infanterie, 1 August 1791](https://www.napoleon-series.org/military-info/organization/France/Infantry/reg1791/PartI/c_regpart1a.html), [공개 원문 PDF](https://commons.wikimedia.org/wiki/File:R%C3%A8glement_concernant_l%27exercice_et_les_manouvres_de_l%27infanterie_-_du_premier_aout_1791_(IA_rglementconcerna01fran%29.pdf).

## <a id="formation-transitions"></a>종대·전열·방진 전환

전환은 목적지 transform의 즉시 교체가 아니라 subunit 순서, pivot, 간격, 소요 시간을 가진 명령이다. 시나리오는 최소한 `line`, `column`, `square`를 다루고 다음 상태를 기록한다.

| 상태 | 필요한 사실 |
|---|---|
| ordered | platoon/section 순서, guides, 기준 flank가 유효 |
| transitioning | 시작 formation, 목표 formation, pivot/guide, 진행률 |
| blocked | 지형·충돌·지휘 상실로 계획된 슬롯에 도달 불가 |
| formed | 허용 위치·방향 오차 안에서 목표 슬롯 점유 |
| broken | 정렬 오차 또는 이탈률이 전술 사용 한계를 넘음 |

전환 속도와 실패 임계치는 보편 역사 상수가 아니다. 행군 cadence, 지형, 훈련, 사기에서 파생하고 시나리오 assertion이 선택 근거를 인용한다.

출처: [The Manual and Platoon Exercises, 1804](https://www.canadiana.ca/view/oocihm.46271), [Règlement du 1791](https://www.napoleon-series.org/military-info/organization/France/Infantry/reg1791/PartI/c_regpart1a.html).

## <a id="volley-and-platoon-fire"></a>일제사격과 platoon fire

영국 1804 교범은 firing by platoons를 명시한다. 엔진은 이를 미리 구운 한 클립이 아니라 fire unit의 순서와 명령 간격으로 표현한다.

- `volley`: 선택된 전체 fire unit이 같은 명령 창에서 발사한다.
- `platoon`: platoon들이 정해진 순서와 간격으로 발사해 지속적인 화력을 만든다.
- `independent`: 개별 병사가 장전 완료와 교전 허가에 따라 발사한다.

발사 이벤트는 `shooterCount`, 실제 발사 성공 수, 불발 수, 탄약 소비, origin 분포, target, 시간 창을 기록한다. 소리는 이 이벤트에서 파생하며 별도 수동 타임라인이 같은 일제사격을 다시 저작하지 않는다.

출처: [The Manual and Platoon Exercises, 1804](https://books.google.com/books?id=YBzJE3saYicC).

## <a id="artillery-ammunition"></a>포병 탄종과 도탄

나폴레옹기 야전포 탄약은 roundshot, explosive shell, anti-personnel 계열로 나뉜다. roundshot은 대형과 구조물에 쓰이고 낮은 탄도와 단단한 지면에서 도탄 사격으로 더 긴 피해 경로를 만들 수 있다. anti-personnel은 grape와 canister를 포함한다. 일반 planning range로 약 1,100 yards가 제시되지만 구경·포가·지형·탄종을 무시한 정확한 명중 상수로 쓰지 않는다.

| 탄종 | 결정론 사실 | 창작 가능한 반응 |
|---|---|---|
| roundshot | 발사·충돌 시각, 궤적, 지면 충돌, 잔여 속도, 후속 교차 | 병사의 피격 연기·대형 재정렬 |
| canister/grape | pellet 수·분산 seed·각 pellet 교차 또는 집계 hit | 공포·회피·지휘 반응 |
| shell | fuse·충돌·폭발 시각, 파편 또는 blast 범위 | 표정·연기·연출 강조 |

도탄은 "사거리 두 배"를 고정 효과로 주지 않는다. 지면 경도, 입사각, 속도, 탄체를 입력으로 다음 접촉을 계산하고 에너지가 임계 아래면 종료한다.

출처: [Organization, Tactics, and Employment of Artillery in the Grande Armée](https://www.napoleon-series.org/military-info/organization/c_kevarty3.html), [On the Use of Field Artillery on Service](https://upload.wikimedia.org/wikipedia/commons/7/7c/On_the_use_of_field_artillery_on_service_-_with_special_reference_to_that_of_an_army-corps_-_for_officers_of_all_arms_%28IA_onuseoffieldarti00taubrich%29.pdf).

## <a id="morale-and-break"></a>사기와 붕괴는 보편 casualty 임계치가 아니다

사기를 사상자 비율 하나로 환원하면 지휘, 측면 위협, 대형 정렬, 주변 부대 붕괴, 포격, 후퇴로, 시간 누적을 잃는다. AutoMovie는 원인을 열거한 state로 둔다.

`morale = { cohesion, shock, fatigue, leadership, flankThreat, retreatRoute, nearbyBreaks }`

엔진은 이벤트에서 이 값을 결정론적으로 갱신하고 `hold`, `waver`, `fallback`, `break`, `rally` 전이를 반환한다. 시나리오가 전이 임계치를 선택하며, 역사 문헌 없이 특정 국적에 더 높은 기본 사기를 부여하지 않는다. 연기와 표정은 전이 결과를 수용·변형하는 창작 계층이다.

## <a id="drum-signals"></a>북 신호는 의미 이벤트다

1791 프랑스 교범은 drummers를 대대 뒤에 편성하고 drum-major/corporal-drummer의 위치를 규정한다. 당대 신호 체계에는 assembly, march, retreat, alarm/long roll 같은 구분이 있었고, 신호는 단순 배경 음악이 아니라 명령 전달 이벤트다.

사운드 팔레트는 `assembly`, `advance`, `charge`, `retreat`, `alarm`, `ceaseFire` 같은 의미 id를 소유한다. 실제 국가·연대의 리듬을 재현하려면 해당 악보 출처를 에셋 매니페스트에 기록하고, 출처가 없으면 역사적 특정 곡이라고 주장하지 않는 절차 snare pattern을 사용한다.

출처: [Règlement du 1791](https://www.napoleon-series.org/military-info/organization/France/Infantry/reg1791/PartI/c_regpart1a.html), [Drum Calls: 18th Century French Drumming](https://www.krausehouse.ca/krause/FortressOfLouisbourgResearchWeb/Search/HE09-5.htm), [Scott’s Tactics drum signals](https://www.drillnet.net/SCOTTSTACTICS/Scottsvol1end.htm).

## <a id="battle-demo-defaults"></a>데모 기본 프로파일

첫 데모의 수치는 다음 원칙으로 선택한다.

1. 무기는 정확한 모델과 출처를 고른다. 예: British India Pattern 또는 French M1777.
2. bench accuracy 관측과 battle modifier를 분리한다.
3. trained stationary reload 기본은 해당 출처가 있는 경우에만 20초를 쓴다.
4. 프랑스 전시 보병은 3열, 영국군은 시나리오가 선택한 2열 또는 3열과 출처를 기록한다.
5. formation 전환 시간, 사기 임계치, 불발률은 시나리오 파라미터이며 문서가 근거를 갖기 전에는 "역사적 상수"로 이름 붙이지 않는다.
6. roundshot, canister, drum signal은 의미 이벤트를 먼저 만들고 시각·오디오 반응을 파생한다.

## <a id="historical-assertion-template"></a>historical assertion 작성 형식

벤치마크의 historical assertion은 다음 필드를 가져야 한다.

```text
claim: 관측하거나 요구하는 정확한 사실
source: 이 문서의 안정 anchor와 외부 원문 URL
conditions: 국가·연도·무기·거리·표적·훈련·지형
observable: 컴파일 결과에서 측정할 이벤트·수치·상태
tolerance: 근거가 있는 허용 범위
exclusions: 이 사실이 증명하지 않는 것
```

예: Scharnhorst 시험은 특정 대형 표적에 대한 bench dispersion을 증명하지만, 연기와 공포 속 한 병사를 맞힐 전장 확률은 증명하지 않는다.
