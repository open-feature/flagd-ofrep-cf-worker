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
