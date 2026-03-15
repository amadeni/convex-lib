import type {
  FunctionReference,
  FunctionReturnType,
  OptionalRestArgs,
} from 'convex/server';
import type { GenericDataModel } from 'convex/server';
import type { CapabilityRegistry, CapabilityOverride } from './capabilities';
import { createCapabilityChecker } from './capabilities';
import type { PermissionEntry, PermissionChecker } from './permissions';
import { createPermissionChecker } from './permissions';
import type { ConvexLibUser, RuntimeResolverConfigEntry } from './types';

type QueryRef<
  Args extends Record<string, unknown> = Record<string, unknown>,
  Return = unknown,
> = FunctionReference<'query', 'public' | 'internal', Args, Return>;

type AnyQueryRef = QueryRef<Record<string, unknown>, unknown>;

type ActionContextWithRunQuery = {
  runQuery: <Ref extends AnyQueryRef>(
    ref: Ref,
    ...args: OptionalRestArgs<Ref>
  ) => Promise<FunctionReturnType<Ref>>;
};

const runQueryRef = async <
  Ctx extends ActionContextWithRunQuery,
  Ref extends AnyQueryRef,
>(
  ctx: Ctx,
  ref: Ref,
  args: Record<string, unknown> | undefined,
): Promise<FunctionReturnType<Ref>> => {
  const runQuery = ctx.runQuery as (
    ref: Ref,
    ...args: OptionalRestArgs<Ref>
  ) => Promise<FunctionReturnType<Ref>>;

  if (args === undefined) {
    return runQuery(ref, ...([] as unknown as OptionalRestArgs<Ref>));
  }

  return runQuery(ref, ...([args] as unknown as OptionalRestArgs<Ref>));
};

export interface CreateActionResolversConfig<
  ActionCtx extends ActionContextWithRunQuery,
  User extends ConvexLibUser,
  TRegistry extends CapabilityRegistry = CapabilityRegistry,
  UserRef extends QueryRef<Record<string, unknown>, User> = QueryRef<
    Record<string, unknown>,
    User
  >,
  CapabilityOverrideRef extends QueryRef<
    Record<string, unknown>,
    CapabilityOverride | null
  > = QueryRef<Record<string, unknown>, CapabilityOverride | null>,
  PermissionRef extends QueryRef<
    Record<string, unknown>,
    PermissionEntry | null
  > = QueryRef<Record<string, unknown>, PermissionEntry | null>,
> {
  getUserRef: UserRef;
  getUserArgs?: (ctx: ActionCtx) => Record<string, unknown> | undefined;
  registry?: TRegistry;
  getCapabilityOverrideRef?: CapabilityOverrideRef;
  getCapabilityOverrideArgs?: (
    ctx: ActionCtx,
    key: string & keyof TRegistry,
  ) => Record<string, unknown> | undefined;
  getPermissionRef?: PermissionRef;
  getPermissionArgs?: (
    ctx: ActionCtx,
    role: User['role'],
    resource: string,
  ) => Record<string, unknown> | undefined;
  adminRoles?: readonly Exclude<User['role'], undefined>[];
  defaultAllow?: boolean;
}

export interface ActionRuntimeResolvers<
  ActionCtx extends ActionContextWithRunQuery,
  User extends ConvexLibUser,
  DataModel extends GenericDataModel = GenericDataModel,
  TRegistry extends CapabilityRegistry = CapabilityRegistry,
> extends RuntimeResolverConfigEntry<ActionCtx, User> {
  capabilityChecker?: ReturnType<
    typeof createCapabilityChecker<ActionCtx, TRegistry, User['role']>
  >;
  permissionChecker?: PermissionChecker<ActionCtx, DataModel, User['role']>;
}

export const createActionResolvers = <
  ActionCtx extends ActionContextWithRunQuery,
  User extends ConvexLibUser,
  DataModel extends GenericDataModel = GenericDataModel,
  TRegistry extends CapabilityRegistry = CapabilityRegistry,
  UserRef extends QueryRef<Record<string, unknown>, User> = QueryRef<
    Record<string, unknown>,
    User
  >,
  CapabilityOverrideRef extends QueryRef<
    Record<string, unknown>,
    CapabilityOverride | null
  > = QueryRef<Record<string, unknown>, CapabilityOverride | null>,
  PermissionRef extends QueryRef<
    Record<string, unknown>,
    PermissionEntry | null
  > = QueryRef<Record<string, unknown>, PermissionEntry | null>,
>(
  config: CreateActionResolversConfig<
    ActionCtx,
    User,
    TRegistry,
    UserRef,
    CapabilityOverrideRef,
    PermissionRef
  >,
): ActionRuntimeResolvers<ActionCtx, User, DataModel, TRegistry> => {
  const resolveUser = async (ctx: ActionCtx) =>
    runQueryRef(ctx, config.getUserRef, config.getUserArgs?.(ctx));

  const capabilityChecker =
    config.registry && config.getCapabilityOverrideRef
      ? (() => {
          const capabilityOverrideRef = config.getCapabilityOverrideRef;

          return createCapabilityChecker<ActionCtx, TRegistry, User['role']>({
            registry: config.registry,
            adminRoles: config.adminRoles,
            getOverride: (ctx, key) =>
              runQueryRef(
                ctx,
                capabilityOverrideRef,
                config.getCapabilityOverrideArgs?.(ctx, key),
              ),
          });
        })()
      : undefined;

  const permissionChecker = config.getPermissionRef
    ? (() => {
        const permissionRef = config.getPermissionRef;

        return createPermissionChecker<ActionCtx, DataModel, User['role']>({
          adminRoles: config.adminRoles,
          defaultAllow: config.defaultAllow,
          getDocument: async () => null,
          getPermission: (ctx, role, resource) =>
            runQueryRef(
              ctx,
              permissionRef,
              config.getPermissionArgs?.(ctx, role, resource),
            ),
        });
      })()
    : undefined;

  return {
    resolveUser,
    capabilityChecker,
    permissionChecker,
  };
};
