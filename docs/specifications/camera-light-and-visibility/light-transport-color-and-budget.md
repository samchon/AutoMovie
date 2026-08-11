# Light Transport, Color와 Budget {#light-transport-color-budget-specification}

## Geometry-dependent Light Result {#clv-geometry-light-result}

### Shadow State와 Sampling {#clv-shadow-state-sampling}

<!-- @evidence requirements/lighting/shadows-reflections-and-transmission.md#lighting-shadows-reflections-transmission Light result가 source, geometry, material, environment와 mode의 같은 state를 읽게 한다. -->
<!-- @evidence requirements/lighting/analysis-and-visual-validation.md#lighting-analysis-geometry-trace Analysis가 실제 opening, caster, receiver와 surface revision을 보고하게 한다. -->

Geometry-dependent result context는 source, resolved geometry와 material revision, camera, environment, film sample, render 또는 analysis profile과 supported approximation tier를 가진다. Shadow, reflection, transmission, opacity와 refraction-like result는 이 context의 immutable identity를 공유하고 다른 camera나 geometry revision의 결과를 상속하지 않는다.

<!-- @evidence requirements/lighting/shadows-reflections-and-transmission.md#lighting-shadow-identity Shadow source, caster, receiver, softness와 tolerance를 식별한다. -->
<!-- @evidence requirements/lighting/shadows-reflections-and-transmission.md#lighting-shadow-time-sampling Moving geometry와 source를 같은 sample에서 평가한다. -->

Shadow state는 source geometry와 size, direction, caster set, receiver set, intended softness, bias 또는 tolerance, supported shadow model과 sample policy를 가진다. Moving source, caster, receiver, opening과 deformation은 같은 rational film sample에서 resolve하며 contact-loss 또는 detached-shadow 위험 interval은 crossing과 extrema를 포함해 검사한다.

### Reflection, Transmission과 Approximation {#clv-reflection-transmission-approximation}

<!-- @evidence requirements/lighting/shadows-reflections-and-transmission.md#lighting-reflection-identity Reflection의 environment, surface, subject, camera와 update policy를 정한다. -->
<!-- @evidence requirements/lighting/shadows-reflections-and-transmission.md#lighting-transparent-boundary Direct view, shadow, reflection과 transmitted light의 지원 subset을 밝힌다. -->
<!-- @evidence requirements/lighting/shadows-reflections-and-transmission.md#lighting-optical-approximation Approximation의 domain, artifact와 failure condition을 기록한다. -->

Reflection state는 source environment 또는 light, reflecting surface, reflected subject, view camera, update policy와 supported method를 가진다. Transparent 또는 translucent boundary는 direct view, opacity, shadow, reflection, transmission과 refraction 중 지원 subset, ordering과 known loss를 선언한다.

Probe, screen-space result, authored field, simplified transmission와 omitted refraction은 approximation identity, valid camera·geometry domain, known artifact와 failure condition을 가진다. Approximation을 full transport나 physical analysis로 승격하지 않는다.

### Structural Pass와 Finding {#clv-light-result-passes-findings}

<!-- @evidence requirements/lighting/shadows-reflections-and-transmission.md#lighting-structural-passes Beauty와 structural pass의 light, material와 environment 처리 차이를 고정한다. -->
<!-- @evidence requirements/lighting/shadows-reflections-and-transmission.md#lighting-result-findings Optical result failure를 위치가 있는 finding으로 만든다. -->
<!-- @evidence requirements/lighting/shadows-reflections-and-transmission.md#lighting-intentional-optical-break 의도적 optical break의 reason, cue와 acceptance를 보존한다. -->

각 beauty 또는 structural product는 lighting, environment, shadow, material override, background, transparency와 display transform 처리 규칙을 가진다. Structural pass가 geometry나 identity를 말할 때 beauty-only environment와 grade를 제거하고, 그 제거를 실제 scene light가 없다는 증거로 해석하지 않는다.

Light leak, detached shadow, wrong-side illumination, missing reflection, black transmission와 unsupported claim은 frame 또는 interval, affected operands, expected·observed state, profile과 severity를 가진 finding이다. Intentional optical break는 별도 deviation receipt가 있을 때만 finding의 disposition 후보가 되며 분석 결과 자체를 바꾸지 않는다.

## Scene Color Pipeline {#clv-scene-color-pipeline}

### Adaptation, Display와 Single Ownership {#clv-color-effective-ownership}

<!-- @evidence requirements/lighting/color-exposure-and-display-boundary.md#lighting-color-exposure-display Scene light, material, exposure, working space와 display를 별도 상태로 정규화한다. -->
<!-- @evidence requirements/lighting/color-exposure-and-display-boundary.md#lighting-color-provenance 각 color value의 source, encoding, transform chain과 revision을 추적한다. -->
<!-- @evidence requirements/lighting/color-exposure-and-display-boundary.md#lighting-working-color-space Scene-linear 계산과 display-encoded RGB를 분리한다. -->

Color pipeline은 light, environment, emission, texture와 material input의 source color role, scene-linear working space, camera exposure, adaptation 또는 white balance, display transform, view와 grade의 ordered stages를 가진다. 각 stage는 input·output encoding, transform identity, revision, numeric domain과 effective owner를 기록한다.

<!-- @evidence requirements/lighting/color-exposure-and-display-boundary.md#lighting-white-balance-adaptation Adaptation과 artistic tint의 적용 domain과 순서를 정한다. -->
<!-- @evidence requirements/lighting/color-exposure-and-display-boundary.md#lighting-display-transform Delivery view와 tone-mapping provenance를 분리한다. -->
<!-- @evidence requirements/lighting/color-exposure-and-display-boundary.md#lighting-single-effective-transform Default와 override 중 하나의 effective transform만 선택한다. -->

White balance, chromatic adaptation와 artistic tint는 scene light, camera presentation 또는 display stage 중 정확한 owner와 적용 순서를 가진다. Delivery profile은 display, view와 look을 소유하고 scene 또는 shot override와 default 중 하나의 effective exposure와 tone transform만 선택한다.

같은 scene-linear result는 여러 delivery view로 파생할 수 있지만 어느 view도 source light color를 소급 변경하지 않는다. 중복 curve나 consumer별 임의 owner 선택은 `failed`다.

### Color Comparison과 Refusal {#clv-color-comparison-refusal}

<!-- @evidence requirements/lighting/color-exposure-and-display-boundary.md#lighting-color-comparison-boundary Lighting A/B에서 material, exposure, view와 raster 조건을 고정한다. -->
<!-- @evidence requirements/lighting/color-exposure-and-display-boundary.md#lighting-color-refusal Unknown space, double transform와 stale view를 거부한다. -->

Color-aware comparison receipt는 camera, material, source lighting, exposure, working space, display view, raster와 sample을 공통 basis 또는 declared difference로 열거한다. Display 또는 grade change를 source-light improvement로 보고하지 않는다.

Unknown color space, missing transform, double transform, stale view, non-finite value, source·display value 혼합과 profile-domain 밖 값은 `failed`다. 지원되지 않은 conversion은 identity transform으로 조용히 대체하지 않고 `unsupported`로 남긴다.

## Lighting Budget State {#clv-lighting-budget-state}

### Quality Floor, Culling와 Deterministic Selection {#clv-light-budget-selection}

<!-- @evidence requirements/lighting/budgets-and-representation.md#lighting-budgets-representation Light, shadow, probe, filter, sample와 pass population의 worst-case bound를 정한다. -->
<!-- @evidence requirements/lighting/budgets-and-representation.md#lighting-budget-cost-model Source와 downstream contribution의 cost dimension을 구분한다. -->
<!-- @evidence requirements/lighting/budgets-and-representation.md#lighting-prototype-instances Repeated practical의 prototype과 exception을 보존한다. -->
<!-- @evidence requirements/lighting/budgets-and-representation.md#lighting-representation-tier 목적별 lighting representation과 approximation을 선언한다. -->

Budget profile은 scene·shot·take와 delivery tier별 authored source, active source, shadow caster, probe, reflection update, transmission, filter, link target, temporal sample, output pass, memory-like resource와 work-like resource의 inclusive limit와 counting scope를 가진다. Estimate, conservative upper bound와 observed actual을 구분한다.

Repeated practical은 prototype identity와 instance transform·state·variation을 공유하되 story-relevant exception을 별도 identity로 보존한다. Distant emission, local unshadowed source, shadowed hero source, authored field와 full supported source 같은 tier는 preserved behavior, loss, transition condition과 review obligation을 선언한다.

<!-- @evidence requirements/lighting/budgets-and-representation.md#lighting-budget-quality-floor Budget 아래에서도 보존할 subject readability와 story optical cue를 고정한다. -->
<!-- @evidence requirements/lighting/budgets-and-representation.md#lighting-culling-influence Off-screen shadow, reflection과 story source를 visibility만으로 제거하지 않게 한다. -->
<!-- @evidence requirements/lighting/budgets-and-representation.md#lighting-budget-deterministic-selection Stable identity와 priority로 active population을 선택한다. -->

각 tier는 required subject readability, motivated practical, story shadow·reflection, continuity와 analysis acceptance 중 보존할 quality floor를 가진다. Distance, region, portal, linking와 influence bound는 각 consumer의 필요를 독립적으로 검사하며 beauty-camera frame 밖이라는 이유만으로 shadow, reflection 또는 off-screen motivated source를 제거하지 않는다.

Active source, caster, probe, reflection과 temporal sample 선택은 stable identity, declared priority와 deterministic tie-break를 사용한다. Traversal order, thread completion, previous-frame visibility와 nondeterministic eviction은 selection input이 아니다.

### Budget Report와 Refusal {#clv-light-budget-report-refusal}

<!-- @evidence requirements/lighting/budgets-and-representation.md#lighting-budget-validation Report가 revision, interval, worst sample와 population을 식별하게 한다. -->
<!-- @evidence requirements/lighting/budgets-and-representation.md#lighting-budget-refusal 초과 시 silent drop이나 shadow disable 대신 diagnostic을 요구한다. -->

Budget report는 profile, source·design·geometry revision, camera take, film interval, worst sample, requested·active·culled·refused population, exactness, dominant contributor와 approximation을 가진다. 실제 observation이 있으면 같은 identity의 upper bound와 별도 field로 비교한다.

Limit 초과, unbounded population과 unsupported required cost는 해당 profile을 `failed` 또는 `incomplete`로 만든다. Source drop, shadow disable, quality 변경이나 sample 감소는 사용자가 선택한 별도 profile 또는 alternative이며 원 요청의 성공이 아니다.
