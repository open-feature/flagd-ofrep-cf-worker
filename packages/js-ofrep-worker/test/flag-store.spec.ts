import { FlagStore } from '../src/flag-store';
import testFlags from '../../../shared/test-flags.json';

describe('FlagStore', () => {
  let store: FlagStore;

  beforeEach(() => {
    store = new FlagStore(testFlags);
  });

  describe('constructor', () => {
    it('should accept a JSON object', () => {
      const s = new FlagStore(testFlags);
      expect(s.getFlagKeys().length).toBeGreaterThan(0);
    });

    it('should accept a JSON string', () => {
      const s = new FlagStore(JSON.stringify(testFlags));
      expect(s.getFlagKeys().length).toBeGreaterThan(0);
    });
  });

  describe('hasFlag', () => {
    it('should return true for an existing flag', () => {
      expect(store.hasFlag('simple-boolean')).toBe(true);
    });

    it('should return false for a non-existent flag', () => {
      expect(store.hasFlag('does-not-exist')).toBe(false);
    });
  });

  describe('getFlagKeys', () => {
    it('should return all flag keys', () => {
      const keys = store.getFlagKeys();
      expect(keys).toContain('simple-boolean');
      expect(keys).toContain('simple-string');
      expect(keys).toContain('simple-number');
      expect(keys).toContain('simple-object');
      expect(keys).toContain('disabled-flag');
      expect(keys).toContain('targeted-boolean');
    });
  });

  describe('getMetadata', () => {
    it('should return flag set metadata', () => {
      const metadata = store.getMetadata();
      expect(metadata).toBeDefined();
      expect(metadata.flagSetId).toBe('test-flags');
      expect(metadata.version).toBe('1.0.0');
    });
  });

  describe('setFlags', () => {
    it('should update flag configuration', () => {
      expect(store.hasFlag('simple-boolean')).toBe(true);

      store.setFlags({
        flags: {
          'new-flag': {
            state: 'ENABLED',
            defaultVariant: 'on',
            variants: { on: true, off: false },
          },
        },
      });

      expect(store.hasFlag('new-flag')).toBe(true);
      expect(store.hasFlag('simple-boolean')).toBe(false);
    });
  });

  describe('resolveValue', () => {
    it('should resolve a simple boolean flag', () => {
      const result = store.resolveValue('simple-boolean');
      expect(result.value).toBe(false);
      expect(result.variant).toBe('off');
      expect(result.errorCode).toBeUndefined();
    });

    it('should resolve a simple string flag', () => {
      const result = store.resolveValue('simple-string');
      expect(result.value).toBe('default-value');
      expect(result.variant).toBe('default');
    });

    it('should resolve a simple number flag', () => {
      const result = store.resolveValue('simple-number');
      expect(result.value).toBe(0);
      expect(result.variant).toBe('zero');
    });

    it('should resolve a simple object flag', () => {
      const result = store.resolveValue('simple-object');
      expect(result.value).toEqual({});
      expect(result.variant).toBe('empty');
    });

    it('should return error for non-existent flag', () => {
      const result = store.resolveValue('does-not-exist');
      expect(result.value).toBeUndefined();
      expect(result.errorCode).toBe('FLAG_NOT_FOUND');
      expect(result.errorMessage).toContain('not found');
    });

    it('should defer to code defaults for disabled flag', () => {
      const result = store.resolveValue('disabled-flag');
      expect(result.value).toBeUndefined();
      expect(result.reason).toBe('DISABLED');
      expect(result.errorCode).toBeUndefined();
      expect(result.flagMetadata).toEqual({
        flagSetId: 'test-flags',
        version: '1.0.0',
      });
    });
  });

  describe('targeting', () => {
    it('should resolve targeted boolean flag matching context', () => {
      const result = store.resolveValue('targeted-boolean', {
        email: 'user@openfeature.dev',
      });
      expect(result.value).toBe(true);
      expect(result.variant).toBe('true');
    });

    it('should resolve targeted boolean flag not matching context', () => {
      const result = store.resolveValue('targeted-boolean', {
        email: 'user@example.com',
      });
      expect(result.value).toBe(false);
      expect(result.variant).toBe('false');
    });

    it('should resolve targeted string flag with admin role', () => {
      const result = store.resolveValue('targeted-string', { role: 'admin' });
      expect(result.value).toBe('Hello, administrator!');
      expect(result.variant).toBe('admin');
    });

    it('should resolve targeted string flag with member role', () => {
      const result = store.resolveValue('targeted-string', { role: 'member' });
      expect(result.value).toBe('Welcome back, member!');
      expect(result.variant).toBe('member');
    });

    it('should resolve targeted string flag with no role (default)', () => {
      const result = store.resolveValue('targeted-string', {});
      expect(result.value).toBe('Welcome, guest!');
      expect(result.variant).toBe('guest');
    });
  });

  describe('resolveBooleanValue', () => {
    it('should resolve a boolean flag', () => {
      const result = store.resolveBooleanValue('simple-boolean', true);
      expect(result.value).toBe(false);
      expect(result.variant).toBe('off');
    });
  });

  describe('resolveStringValue', () => {
    it('should resolve a string flag', () => {
      const result = store.resolveStringValue('simple-string', 'fallback');
      expect(result.value).toBe('default-value');
      expect(result.variant).toBe('default');
    });
  });

  describe('resolveNumberValue', () => {
    it('should resolve a number flag', () => {
      const result = store.resolveNumberValue('simple-number', -1);
      expect(result.value).toBe(0);
      expect(result.variant).toBe('zero');
    });
  });

  describe('resolveObjectValue', () => {
    it('should resolve an object flag', () => {
      const result = store.resolveObjectValue('simple-object', { fallback: true });
      expect(result.value).toEqual({});
      expect(result.variant).toBe('empty');
    });
  });

  describe('resolveAll', () => {
    it('should resolve all configured flags', () => {
      const results = store.resolveAll();
      expect(results.length).toBeGreaterThan(0);

      const flagKeys = results.map((r) => r.flagKey);
      expect(flagKeys).toContain('simple-boolean');
      expect(flagKeys).toContain('simple-string');
      expect(flagKeys).toContain('disabled-flag');
    });

    it('should include flag values in results', () => {
      const results = store.resolveAll();
      const boolResult = results.find((r) => r.flagKey === 'simple-boolean');
      expect(boolResult).toBeDefined();
      expect(boolResult!.value).toBe(false);
    });

    it('should pass context to all evaluations', () => {
      const results = store.resolveAll({ email: 'user@openfeature.dev' });
      const targeted = results.find((r) => r.flagKey === 'targeted-boolean');
      expect(targeted).toBeDefined();
      expect(targeted!.value).toBe(true);
    });

    it('should include disabled flags as code-default results', () => {
      const results = store.resolveAll();
      const disabled = results.find((r) => r.flagKey === 'disabled-flag');

      expect(disabled).toBeDefined();
      expect(disabled).toMatchObject({
        flagKey: 'disabled-flag',
        reason: 'DISABLED',
        flagMetadata: {
          flagSetId: 'test-flags',
          version: '1.0.0',
        },
      });
      expect(disabled!.value).toBeUndefined();
      expect(disabled!.errorCode).toBeUndefined();
    });
  });
});
