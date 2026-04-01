type ErrorWithCause = Error & {
  cause?: Error;
};

export function expectInvalidConfigError(action: () => void, causePattern?: RegExp): void {
  const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

  let thrownError: ErrorWithCause | undefined;
  try {
    action();
  } catch (error) {
    thrownError = error as ErrorWithCause;
  } finally {
    consoleDebugSpy.mockRestore();
  }

  expect(thrownError).toBeDefined();
  expect(thrownError!.message).toBe('invalid flagd flag configuration');

  if (causePattern) {
    expect(thrownError!.cause?.message ?? '').toMatch(causePattern);
  }
}
