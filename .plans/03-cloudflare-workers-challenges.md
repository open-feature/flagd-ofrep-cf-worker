# Challenges Running flagd-core in Cloudflare Workers

## The Core Problem: Dynamic Code Generation

Cloudflare Workers run in a **V8 isolate** with strict security restrictions. One of the most significant restrictions is that **dynamic code generation is not allowed**:

- `eval()` is blocked
- `new Function()` is blocked
- Any library that compiles code at runtime will fail

## Libraries That Failed

### 1. `ajv` (JSON Schema Validator)

Used by flagd-core at `parser.ts:19-20`:

```javascript
const ajv = new Ajv({ strict: false });
const validate = ajv.addSchema(targetingSchema).compile(flagsSchema);
```

**Problem**: ajv compiles JSON schemas into JavaScript functions using `new Function()` for performance. This happens at **module load time**, not just when validation is called.

**Error**:
```
Error compiling schema, function code: const schema2 = scope.schema[2]...
EvalError: Code generation from strings disallowed for this context
```

### 2. `json-logic-engine`

Used by flagd-core for targeting rule evaluation:

```javascript
const engine = new LogicEngine();
this._logicEngine = engine.build(logic);
```

**Problem**: `json-logic-engine` compiles JSONLogic rules into optimized JavaScript functions using `new Function()`. This is done when rules are "built" for performance.

**Error**:
```
Invalid targeting configuration for flag 'targeted-boolean': 
Code generation from strings disallowed for this context
```

## Why This Is Hard to Work Around

1. **Module-level execution**: ajv compiles schemas when the module is imported, not when you call a function. Even if you never use validation, importing the module triggers the error.

2. **Deep dependency**: These aren't direct dependencies you can easily swap - they're used internally by `@openfeature/flagd-core`.

3. **No "safe mode"**: Neither library offers an interpreter-only mode that skips code generation.

## The Solution We Implemented

Instead of using `@openfeature/flagd-core`, we created a **Workers-compatible reimplementation**:

| Original | Workers-Compatible Replacement |
|----------|-------------------------------|
| `ajv` for schema validation | Skip validation (assume flags validated at build time) |
| `json-logic-engine` for rules | `json-logic-js` (interpreter-based, no code gen) |
| `@openfeature/flagd-core` | Custom `WorkersStorage` + `WorkersFeatureFlag` classes |

## Trade-offs

| Aspect | Original flagd-core | Our Implementation |
|--------|--------------------|--------------------|
| Schema validation | Runtime validation | None (build-time assumed) |
| JSONLogic performance | Compiled (fast) | Interpreted (slower) |
| Code sharing | Shared with other providers | Workers-specific |
| Maintenance | Upstream maintained | Must maintain separately |

## Implications for Rust Worker

The Rust implementation will likely face similar challenges:

- `datalogic-rs` needs to be verified for WASM compatibility
- Any runtime code generation patterns will fail
- May need a pure-interpreter JSONLogic implementation
