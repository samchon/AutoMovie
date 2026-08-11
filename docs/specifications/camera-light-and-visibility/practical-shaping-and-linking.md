# Practical, Shaping과 Linking {#practical-shaping-linking-specification}

## Practical Coupled State {#clv-practical-coupled-state}

### Control와 On-screen Consistency {#clv-practical-control-consistency}

<!-- @evidence requirements/lighting/practicals-and-local-lights.md#lighting-practicals-local Visible source, emission, emitted light와 control을 하나의 coupled state로 만든다. -->
<!-- @evidence requirements/lighting/practicals-and-local-lights.md#lighting-practical-design-staging-trace Practical이 읽은 design, staging과 story event를 lineage에 고정한다. -->
<!-- @evidence requirements/lighting/practicals-and-local-lights.md#lighting-practical-host Host attachment와 power 또는 fuel state를 정규화한다. -->

Practical state는 fixture identity, production-design subject·material·revision, staging owner·placement·interaction, visible geometry, emissive appearance, emitted-source identity, host attachment, local transform, power 또는 fuel source, control state와 valid interval을 가진다. Fixture geometry와 emitted source가 다르면 그 relation, approximation과 각 revision을 함께 기록한다.

<!-- @evidence requirements/lighting/practicals-and-local-lights.md#lighting-practical-control-state Switch, circuit, dimmer와 affected practical의 상태 전이를 정한다. -->
<!-- @evidence requirements/lighting/practicals-and-local-lights.md#lighting-practical-consistency Visible source와 emitted light의 on·off 관계를 판정한다. -->

Control은 stable identity, controller, allowed states, affected fixture·emission·source와 simultaneous-transition rule을 가진다. 같은 sample에서 visible bulb, flame 또는 screen이 off이면 연결된 emission과 emitted light도 off여야 한다. 화면 밖에서 필요한 motivated source는 별도 identity와 reason을 가진다.

### Flicker, Sampling, Alternative와 Refusal {#clv-practical-sampling-refusal}

<!-- @evidence requirements/lighting/practicals-and-local-lights.md#lighting-flicker-failure Flicker와 outage를 bounded curve, seed와 event로 재현한다. -->
<!-- @evidence requirements/lighting/practicals-and-local-lights.md#lighting-practical-time-sampling Geometry, control, emission과 light를 같은 fixed-clock sample에서 평가한다. -->
<!-- @evidence requirements/lighting/practicals-and-local-lights.md#lighting-practical-alternatives Practical state alternative의 camera consequence를 독립적으로 보존한다. -->
<!-- @evidence requirements/lighting/practicals-and-local-lights.md#lighting-practical-refusal Host, geometry와 state가 모순된 practical을 거부한다. -->

Flicker, pulse, dim, ignition, outage와 color change는 bounded amplitude·frequency·interval, explicit seed 또는 fixed curve, semantic event와 first observable sample을 가진다. Fixture transform, attachment, control, emissive appearance와 emitted light는 같은 rational sample에서 원자적으로 resolve한다.

On·off, failure, replacement fixture와 off-screen motivated source는 독립 branch와 camera-readability consequence를 가진다. Missing host, source-geometry mismatch, contradictory state, unsupported distribution와 unbounded noise는 `failed`이며 선택되지 않은 source를 effective state에 남기지 않는다.

## Shaping Control State {#clv-shaping-control-state}

### Light Linking과 Membership Resolution {#clv-light-link-resolution}

<!-- @evidence requirements/lighting/shape-filters-and-linking.md#lighting-shape-filters-linking Shaping device를 source-local geometry와 effect domain으로 정규화한다. -->
<!-- @evidence requirements/lighting/shape-filters-and-linking.md#lighting-control-coordinate-space Control의 coordinate space, transform order와 revision을 고정한다. -->

Barn door, gobo, blocker, portal, reflector, gel, diffuser와 project-defined control은 stable identity, source, geometry 또는 texture, source-local·host-local·world coordinate, unit, transform order, orientation, effect domain, geometry revision와 valid interval을 가진다.

<!-- @evidence requirements/lighting/shape-filters-and-linking.md#lighting-linking Source가 포함하거나 제외하는 subject, surface와 reflection consumer를 명시한다. -->
<!-- @evidence requirements/lighting/shape-filters-and-linking.md#lighting-link-resolution Group membership, instance exception과 precedence를 결정적으로 resolve한다. -->

Link state는 source identity, include·exclude target, target kind, group revision, instance exception, reflection·shadow consumer와 precedence를 가진다. Membership은 stable identity와 declared ordering으로 resolve하고 subject reorder, group expansion, culling 또는 traversal order가 결과를 바꾸지 않는다.

Missing target은 named diagnostic이며 implicit all-subject 또는 no-subject로 바꾸지 않는다. Include와 exclude가 충돌하면 선언된 precedence가 없을 때 `failed`다.

### Filter Order, Portal와 Sampling {#clv-filter-order-portal-sampling}

<!-- @evidence requirements/lighting/shape-filters-and-linking.md#lighting-filter-order Color, intensity, texture, shape와 shadow filter의 적용 순서를 고정한다. -->
<!-- @evidence requirements/lighting/shape-filters-and-linking.md#lighting-filter-time-sampling Animated control과 target geometry를 같은 film sample에서 평가한다. -->
<!-- @evidence requirements/lighting/shape-filters-and-linking.md#lighting-portals-openings Portal이 실제 opening geometry와 state를 읽게 한다. -->

Filter chain은 color, intensity, texture, shape, distribution와 shadow control의 ordered stages, 각 coordinate domain, normalization과 unsupported combination을 선언한다. Animated filter, blocker와 link state는 source와 target geometry의 같은 rational sample에서 직접 평가한다.

Door, window, skylight와 set opening을 portal로 사용할 때 host geometry, boundary identity, aperture shape, open·closed state와 revision을 참조한다. Stale opening bounds나 previous-frame cache로 light path를 유지하지 않는다.

### Control Branch와 Refusal {#clv-control-branch-refusal}

<!-- @evidence requirements/lighting/shape-filters-and-linking.md#lighting-control-alternatives 서로 다른 shaping setup의 공통 source와 expected consequence를 보존한다. -->
<!-- @evidence requirements/lighting/shape-filters-and-linking.md#lighting-control-refusal Cyclic, detached와 all-subject exclusion 상태를 명시적으로 보고한다. -->

서로 다른 flag, gel, gobo, link와 portal setup은 독립 take 또는 lighting branch, common source, difference set, expected subject consequence와 acceptance를 가진다. Missing target, cyclic filter graph, invalid texture, detached blocker, impossible transform와 의도되지 않은 all-subject exclusion은 `failed`다.
