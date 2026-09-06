# 저작 계약 판별자

## Graph routing {#spec-authoring-production-evidence-authoring-contracts}

### Typed host and cardinality selection {#spec-authoring-production-evidence-contract-discriminators}

<!-- @evidence requirements/production-evidence/authoring-contracts.md#agent-production-evidence-contract-discriminators 저작 계약마다 독립적인 host 종류와 cardinality를 선택한다. -->

Contract registry는 target identity마다 domain, physical file, anchor, active status, applicable production kinds, host branch, symbol depth, relationship kind와 cardinality를 하나의 typed entry로 보존한다. Graph factory는 같은 registry를 validation, claim construction과 human-readable binding manifest에 사용하며 별도 target list를 유지하지 않는다.

Principle은 선택한 H2/H3/H4 각각의 checklist, obligation은 complete population account 또는 ordinary H2 coverage, upstream은 exact lineage, discovery는 draft-active audit, source contract는 selected public export 관계로 투영한다. Registry가 선택하지 않은 H2, inactive language rule, wrong-shape branch와 host-kind mismatch는 partial graph 없이 stable diagnostic으로 실패한다.
