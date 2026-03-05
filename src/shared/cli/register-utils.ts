import { type ZodType } from "zod";

type AsyncVoid = Promise<void> | void;

export type Parser<TArgs extends unknown[]> = (...raw: unknown[]) => TArgs;

export function withParsedAction<TArgs extends unknown[]>(
  parser: Parser<TArgs>,
  handler: (...args: TArgs) => AsyncVoid,
) {
  return async (...raw: unknown[]) => {
    const args = parser(...raw);
    await handler(...args);
  };
}

export function parseNone(): Parser<[]> {
  return () => [];
}

export function parseOptions(): Parser<[unknown]> {
  return (rawOptions: unknown) => [rawOptions];
}

export function parseArg<TArg>(argSchema: ZodType<TArg>): Parser<[TArg]> {
  return (rawArg: unknown) => [argSchema.parse(rawArg)];
}

export function parseArgOptions<TArg, TOptions>(
  argSchema: ZodType<TArg>,
  optionsSchema: ZodType<TOptions>,
): Parser<[TArg, TOptions]> {
  return (rawArg: unknown, rawOptions: unknown) => [
    argSchema.parse(rawArg),
    optionsSchema.parse(rawOptions),
  ];
}

export function parseArgWithOptions<TArg>(argSchema: ZodType<TArg>): Parser<[TArg, unknown]> {
  return (rawArg: unknown, rawOptions: unknown) => [argSchema.parse(rawArg), rawOptions];
}
