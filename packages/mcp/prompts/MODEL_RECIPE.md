# Model Recipe

`setModelRecipe` stores a bounded primitive recipe. It does not accept a free-form mesh graph.

Pick a supported archetype and only its documented scalar parameters. The compiler rejects unknown keys and out-of-range values; this prevents the recipe map from becoming an escape hatch back to arbitrary JSON. Palette keys are material roles, capabilities are runtime promises, and attachments name bone sockets.

LOD is a reference graph. `hero`, `near`, and `far` entries name recipes, with increasing distance limits and one final unbounded tier where appropriate. Do not expand a formation into one model recipe per soldier. Ordinary members share a recipe; only intentional hero slots become named actors.

Foundation archetypes are contracts before all geometry compilers exist. An unsupported capability must remain a diagnostic, never a silent placeholder claimed as complete. Put custom high-detail geometry in coding-agent-owned source or assets and bind it explicitly; do not smuggle it through `parameters`.
