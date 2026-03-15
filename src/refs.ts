import type { FunctionReference } from 'convex/server';

type AnyFunctionRef = FunctionReference<
  'query' | 'mutation' | 'action',
  'public' | 'internal',
  Record<string, unknown>,
  unknown
>;

export type RefFromExport<Export> = Export extends AnyFunctionRef
  ? Export
  : never;

export const typedRef = <Ref extends AnyFunctionRef>(ref: Ref): Ref => ref;
