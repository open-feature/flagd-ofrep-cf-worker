import { toEvaluationContext } from '../src/types';

describe('toEvaluationContext', () => {
  it('should return empty context when no context is provided', () => {
    expect(toEvaluationContext()).toEqual({});
  });

  it('should return empty context when undefined is provided', () => {
    expect(toEvaluationContext(undefined)).toEqual({});
  });

  it('should map targetingKey correctly', () => {
    const result = toEvaluationContext({ targetingKey: 'user-123' });
    expect(result.targetingKey).toBe('user-123');
  });

  it('should pass through additional properties', () => {
    const result = toEvaluationContext({
      targetingKey: 'user-123',
      email: 'test@example.com',
      plan: 'premium',
    });

    expect(result.targetingKey).toBe('user-123');
    expect(result.email).toBe('test@example.com');
    expect(result.plan).toBe('premium');
  });

  it('should handle context without targetingKey', () => {
    const result = toEvaluationContext({
      email: 'test@example.com',
    });

    expect(result.targetingKey).toBeUndefined();
    expect(result.email).toBe('test@example.com');
  });

  it('should handle empty context object', () => {
    const result = toEvaluationContext({});
    expect(result).toEqual({});
  });
});
