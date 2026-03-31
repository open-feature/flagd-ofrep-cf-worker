type ErrorWithCause = Error & {
  cause?: Error;
};

export function expectInvalidConfigError(action: () => void, causePattern?: RegExp): void {
  const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

  try {
    action();
    throw new Error('Expected invalid flag configuration to throw');
  } catch (error) {
    const invalidConfigError = error as ErrorWithCause;

    expect(invalidConfigError.message).toBe('invalid flagd flag configuration');

    if (causePattern) {
      expect(invalidConfigError.cause?.message ?? '').toMatch(causePattern);
    }
  } finally {
    consoleDebugSpy.mockRestore();
  }
}
