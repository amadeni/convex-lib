import { actionGeneric, mutationGeneric, queryGeneric } from 'convex/server';
import {
  customAction,
  customCtx,
  customMutation,
  customQuery,
} from 'convex-helpers/server/customFunctions';
import { createError } from './errors';
import type {
  PermissionAction,
  PermissionEntry,
  createPermissionChecker,
} from './permissions';
import type { AnyCtx, ConvexLibConfig, ConvexLibUser } from './types';

type PermissionChecker = ReturnType<typeof createPermissionChecker>;

export interface AuthorizedConfig<
  User extends ConvexLibUser,
> extends ConvexLibConfig<User> {
  permissionChecker: PermissionChecker;
}

export interface AuthorizedPrimitives {
  authorizedQuery: (
    resource: string,
    action?: PermissionAction,
  ) => ReturnType<typeof customQuery>;
  authorizedMutation: (
    resource: string,
    action?: PermissionAction,
  ) => ReturnType<typeof customMutation>;
  authorizedAction: (
    resource: string,
    action?: PermissionAction,
  ) => ReturnType<typeof customAction>;
}

const DEFAULT_OWNERSHIP_FIELD = 'createdBy';

const getOwnedPermission = async (
  permissionChecker: PermissionChecker,
  ctx: AnyCtx,
  role: string,
  resource: string,
): Promise<PermissionEntry | null> =>
  permissionChecker.getPermissionEntry(ctx, role, resource);

const createOwnedQuery = async (
  ctx: AnyCtx,
  permissionChecker: PermissionChecker,
  userId: string,
  role: string,
  tableName: string,
) => {
  const permission = await getOwnedPermission(
    permissionChecker,
    ctx,
    role,
    tableName,
  );

  if (!permission?.ownOnly) {
    return ctx.db.query(tableName);
  }

  const ownershipField = permission.ownership ?? DEFAULT_OWNERSHIP_FIELD;
  return ctx.db
    .query(tableName)
    .filter((q: AnyCtx) =>
      q.eq(q.field(ownershipField as never), userId as never),
    );
};

const createOwnedDoc = (
  ctx: AnyCtx,
  permissionChecker: PermissionChecker,
  userId: string,
  role: string,
) => {
  return async (tableName: string, documentId: string) => {
    const doc = await permissionChecker.getDocument(ctx, tableName, documentId);

    if (!doc) {
      return null;
    }

    const hasAccess = await permissionChecker.checkOwnership(
      ctx,
      userId,
      tableName,
      documentId,
      role,
    );

    if (!hasAccess) {
      throw createError.unauthorized(
        `User does not own document in ${tableName}`,
      );
    }

    return doc;
  };
};

const resolveAuthorizedContext = async <User extends ConvexLibUser>(
  ctx: AnyCtx,
  config: AuthorizedConfig<User>,
  resource: string,
  action: PermissionAction,
) => {
  const user = await config.resolveUser(ctx);
  const allowed = await config.permissionChecker.hasPermission(
    ctx,
    user,
    resource,
    action,
  );

  if (!allowed) {
    throw createError.unauthorized(
      `User lacks permission to ${action} ${resource}`,
    );
  }

  return {
    user,
    userId: user._id,
    role: user.role,
  };
};

export const createAuthorized = <User extends ConvexLibUser>(
  config: AuthorizedConfig<User>,
): AuthorizedPrimitives => {
  return {
    authorizedQuery: (resource: string, action: PermissionAction = 'read') =>
      customQuery(
        queryGeneric,
        customCtx(async (ctx: AnyCtx) => {
          const auth = await resolveAuthorizedContext(
            ctx,
            config,
            resource,
            action,
          );

          return {
            ...auth,
            ownedQuery: (tableName: string) =>
              createOwnedQuery(
                ctx,
                config.permissionChecker,
                auth.userId,
                auth.role,
                tableName,
              ),
            ownedDoc: createOwnedDoc(
              ctx,
              config.permissionChecker,
              auth.userId,
              auth.role,
            ),
          };
        }),
      ),
    authorizedMutation: (
      resource: string,
      action: PermissionAction = 'update',
    ) =>
      customMutation(
        mutationGeneric,
        customCtx(async (ctx: AnyCtx) => {
          const auth = await resolveAuthorizedContext(
            ctx,
            config,
            resource,
            action,
          );

          const ownedDoc = createOwnedDoc(
            ctx,
            config.permissionChecker,
            auth.userId,
            auth.role,
          );

          return {
            ...auth,
            ownedDoc,
            ownedMutation: {
              patch: async (
                tableName: string,
                documentId: string,
                patch: AnyCtx,
              ) => {
                const doc = await ownedDoc(tableName, documentId);
                if (!doc) {
                  throw createError.notFound(tableName);
                }

                await ctx.db.patch(documentId, patch);
              },
              delete: async (tableName: string, documentId: string) => {
                const doc = await ownedDoc(tableName, documentId);
                if (!doc) {
                  throw createError.notFound(tableName);
                }

                await ctx.db.delete(documentId);
              },
            },
          };
        }),
      ),
    authorizedAction: (resource: string, action: PermissionAction = 'read') =>
      customAction(
        actionGeneric,
        customCtx(async (ctx: AnyCtx) =>
          resolveAuthorizedContext(ctx, config, resource, action),
        ),
      ),
  };
};
