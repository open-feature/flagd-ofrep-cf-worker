# Challenges Running flagd-core in Cloudflare Workers

## Core Problem: Dynamic Code Generation

Cloudflare Workers run in a V8 isolate with strict runtime restrictions:

- `eval()` is blocked
- `new Function()` is blocked

Any dependency that compiles JavaScript at runtime can fail in this environment.

## Libraries that Failed in Early Attempts

### 1) `ajv` schema compilation

`ajv.compile()` generates JavaScript functions and can trigger:

```text
EvalError: Code generation from strings disallowed for this context
```

### 2) `json-logic-engine` build mode

`engine.build(logic)` compiles logic rules and can trigger the same code-generation restriction.

## Practical JS-Only Approach

The repository now focuses on the JavaScript worker path that avoids these runtime pitfalls by using a Workers-compatible evaluation flow.

## Trade-offs

| Aspect | Standard runtime compilation path | Workers-compatible path |
|--------|-----------------------------------|-------------------------|
| Rule evaluation | Compiled functions | Interpreter-safe approach |
| Runtime compatibility | Node-friendly | Cloudflare Workers-friendly |
| Throughput ceiling | Higher in tight loops | Lower, but acceptable for OFREP HTTP usage |

## Outcome

For OFREP usage patterns (network-bound requests with modest per-request evaluations), the Workers-compatible JS path is the maintained direction for this repo.
