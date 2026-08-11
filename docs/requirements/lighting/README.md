# 조명 요구사항

조명은 world, subject, material과 camera에 닿는 scene-referred light의 source, distribution, shadow, 시간 state와 story purpose를 소유한다. Camera exposure, display transform과 repaint appearance는 조명 자체와 구분한다.

각 lighting state는 [scene의 장소·시간·관찰 가능한 행동](../story/scenes-and-observable-action.md#story-scenes-observable-action), [production design의 palette·material·state](../production-design/palette-material-and-state.md#production-design-palette-material-state), 같은 revision의 resolved [scene geometry](../asset-authoring/geometry.md#asset-general-geometry)와 staging event를 추적한다. Camera exposure와 display transform은 빛의 source 사실을 바꾸지 않으며, lighting alternative와 의도적 continuity 위반은 독립된 branch와 acceptance로 남는다.

- [조명 범위와 Identity](./scope-and-identity.md)
- [Light Source와 Photometry](./sources-and-photometry.md)
- [Sun, Sky와 Environment](./sun-sky-and-environment.md)
- [Practical과 Local Light](./practicals-and-local-lights.md)
- [Shape, Filter와 Linking](./shape-filters-and-linking.md)
- [Shadow, Reflection과 Transmission](./shadows-reflections-and-transmission.md)
- [Color, Exposure와 Display 경계](./color-exposure-and-display-boundary.md)
- [시간 State와 Continuity](./temporal-state-and-continuity.md)
- [Alternative와 의도적 위반](./alternatives-and-intentional-deviations.md)
- [Budget와 Representation](./budgets-and-representation.md)
- [분석과 시각 검증](./analysis-and-visual-validation.md)
