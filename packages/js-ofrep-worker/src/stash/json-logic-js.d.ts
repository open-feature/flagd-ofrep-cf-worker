/**
 * Type declarations for the 'json-logic-js' package.
 *
 * This file exists because json-logic-js doesn't ship with its own TypeScript
 * types and there's no @types/json-logic-js package on DefinitelyTyped.
 * Without this declaration, TypeScript would error with:
 * "Could not find a declaration file for module 'json-logic-js'"
 */
declare module 'json-logic-js' {
  interface JsonLogic {
    apply(logic: unknown, data?: unknown): unknown;
    add_operation(name: string, fn: (...args: unknown[]) => unknown): void;
    rm_operation(name: string): void;
    is_logic(logic: unknown): boolean;
    truthy(value: unknown): boolean;
    get_operator(logic: object): string | null;
    get_values(logic: object): unknown[];
  }

  const jsonLogic: JsonLogic;
  export default jsonLogic;
}
