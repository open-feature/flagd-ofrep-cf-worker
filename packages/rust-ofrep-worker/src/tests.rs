use super::*;

const TEST_FLAGS: &str = r#"{
    "flags": {
        "bool-flag": {
            "state": "ENABLED",
            "defaultVariant": "on",
            "variants": { "on": true, "off": false }
        },
        "disabled-flag": {
            "state": "DISABLED",
            "defaultVariant": "on",
            "variants": { "on": true, "off": false }
        }
    }
}"#;

#[test]
fn test_evaluate_flag_success() {
    let handler = OfrepHandler::new(TEST_FLAGS).unwrap();
    let request = OfrepRequest::default();

    let result = handler.evaluate_flag("bool-flag", &request);
    assert!(result.is_ok());

    let success = result.unwrap();
    assert_eq!(success.key, "bool-flag");
    assert_eq!(success.value, serde_json::Value::Bool(true));
    assert_eq!(success.variant, "on");
}

#[test]
fn test_evaluate_flag_not_found() {
    let handler = OfrepHandler::new(TEST_FLAGS).unwrap();
    let request = OfrepRequest::default();

    let result = handler.evaluate_flag("nonexistent", &request);
    assert!(result.is_err());

    let error = result.unwrap_err();
    assert_eq!(error.error_code, "FLAG_NOT_FOUND");
}

#[test]
fn test_evaluate_disabled_flag() {
    let handler = OfrepHandler::new(TEST_FLAGS).unwrap();
    let request = OfrepRequest::default();

    let result = handler.evaluate_flag("disabled-flag", &request);
    assert!(result.is_err());

    let error = result.unwrap_err();
    assert_eq!(error.error_code, "FLAG_NOT_FOUND");
}

#[test]
fn test_evaluate_all() {
    let handler = OfrepHandler::new(TEST_FLAGS).unwrap();
    let request = OfrepRequest::default();

    let result = handler.evaluate_all(&request);
    // Only enabled flags should be returned
    assert_eq!(result.flags.len(), 1);
    assert_eq!(result.flags[0].key, "bool-flag");
}

const NESTED_CONTEXT_FLAGS: &str = r#"{
    "flags": {
        "nested-targeting": {
            "state": "ENABLED",
            "defaultVariant": "off",
            "variants": { "on": true, "off": false },
            "targeting": {
                "if": [
                    { "==": [{ "var": "user.plan" }, "premium"] },
                    "on",
                    "off"
                ]
            }
        },
        "array-targeting": {
            "state": "ENABLED",
            "defaultVariant": "off",
            "variants": { "on": true, "off": false },
            "targeting": {
                "if": [
                    { "in": ["admin", { "var": "user.roles" }] },
                    "on",
                    "off"
                ]
            }
        }
    }
}"#;

#[test]
fn test_nested_context_object() {
    let handler = OfrepHandler::new(NESTED_CONTEXT_FLAGS).unwrap();

    // Test with nested object context
    let request: OfrepRequest = serde_json::from_str(
        r#"{
        "context": {
            "targetingKey": "user-123",
            "user": {
                "plan": "premium",
                "email": "test@example.com"
            }
        }
    }"#,
    )
    .unwrap();

    let result = handler.evaluate_flag("nested-targeting", &request);
    assert!(result.is_ok());
    let success = result.unwrap();
    assert_eq!(success.value, serde_json::Value::Bool(true));
    assert_eq!(success.variant, "on");
}

#[test]
fn test_nested_context_object_no_match() {
    let handler = OfrepHandler::new(NESTED_CONTEXT_FLAGS).unwrap();

    // Test with nested object that doesn't match
    let request: OfrepRequest = serde_json::from_str(
        r#"{
        "context": {
            "targetingKey": "user-123",
            "user": {
                "plan": "free",
                "email": "test@example.com"
            }
        }
    }"#,
    )
    .unwrap();

    let result = handler.evaluate_flag("nested-targeting", &request);
    assert!(result.is_ok());
    let success = result.unwrap();
    assert_eq!(success.value, serde_json::Value::Bool(false));
    assert_eq!(success.variant, "off");
}

#[test]
fn test_nested_context_array() {
    let handler = OfrepHandler::new(NESTED_CONTEXT_FLAGS).unwrap();

    // Test with nested array context
    let request: OfrepRequest = serde_json::from_str(
        r#"{
        "context": {
            "targetingKey": "user-123",
            "user": {
                "roles": ["user", "admin", "editor"]
            }
        }
    }"#,
    )
    .unwrap();

    let result = handler.evaluate_flag("array-targeting", &request);
    assert!(result.is_ok());
    let success = result.unwrap();
    assert_eq!(success.value, serde_json::Value::Bool(true));
    assert_eq!(success.variant, "on");
}

#[test]
fn test_nested_context_array_no_match() {
    let handler = OfrepHandler::new(NESTED_CONTEXT_FLAGS).unwrap();

    // Test with nested array that doesn't contain admin
    let request: OfrepRequest = serde_json::from_str(
        r#"{
        "context": {
            "targetingKey": "user-123",
            "user": {
                "roles": ["user", "editor"]
            }
        }
    }"#,
    )
    .unwrap();

    let result = handler.evaluate_flag("array-targeting", &request);
    assert!(result.is_ok());
    let success = result.unwrap();
    assert_eq!(success.value, serde_json::Value::Bool(false));
    assert_eq!(success.variant, "off");
}

#[test]
fn test_json_to_context_field_value_nested() {
    // Test deeply nested conversion
    let json: serde_json::Value = serde_json::from_str(
        r#"{
        "level1": {
            "level2": {
                "value": "deep"
            }
        },
        "array": [1, 2, {"nested": true}]
    }"#,
    )
    .unwrap();

    if let serde_json::Value::Object(obj) = json {
        for (key, value) in &obj {
            let result = json_to_context_field_value(value);
            assert!(result.is_some(), "Failed to convert key: {}", key);
        }
    }
}
