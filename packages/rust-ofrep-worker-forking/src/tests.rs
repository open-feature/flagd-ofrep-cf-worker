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

#[test]
fn test_flag_keys() {
    let handler = OfrepHandler::new(TEST_FLAGS).unwrap();
    let keys = handler.flag_keys();
    assert_eq!(keys.len(), 2);
    assert!(keys.contains(&"bool-flag"));
    assert!(keys.contains(&"disabled-flag"));
}
