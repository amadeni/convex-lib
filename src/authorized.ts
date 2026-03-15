import {
  customAction,
  customCtx,
  customMutation,
  customQuery,
} from 'convex-helpers/server/customFunctions';
import type { CustomBuilder } from 'convex-helpers/server/customFunctions';
import type {
  DocumentByName,
  FunctionVisibility,
  GenericActionCtx,
  GenericDataModel,
  GenericMutationCtx,
  GenericQueryCtx,
  TableNamesInDataModel,
} from 'convex/server';
import type { GenericId } from 'convex/values';
import { createError } from './errors';
import type { PermissionAction, PermissionChecker } from './permissions';
import {
  getActionUserResolver,
  getBuilders,
  getMutationUserResolver,
  getQueryUserResolver,
} from './runtime';
import type {
  AuthContext,
  ConvexLibConfig,
  ConvexLibUser,
  OwnedDoc,
  OwnedMutation,
  OwnedQuery,
  PatchValue,
} from './types';

type EmptyObject = Record<string, never>;

type AuthorizedQueryContext<
  User extends ConvexLibUser,
  DataModel extends GenericDataModel,
> = AuthContext<User> & {
  ownedQuery: OwnedQuery<DataModel>;
  ownedDoc: OwnedDoc<DataModel>;
};

type AuthorizedMutationContext<
  User extends ConvexLibUser,
  DataModel extends GenericDataModel,
> = AuthContext<User> & {
  ownedDoc: OwnedDoc<DataModel>;
  ownedMutation: OwnedMutation<DataModel>;
};

type AuthorizedActionContext<User extends ConvexLibUser> = AuthContext<User>;

type AuthorizedQueryBuilder<
  User extends ConvexLibUser,
  DataModel extends GenericDataModel,
  Visibility extends FunctionVisibility,
> = CustomBuilder<
  'query',
  EmptyObject,
  AuthorizedQueryContext<User, DataModel>,
  EmptyObject,
  GenericQueryCtx<DataModel>,
  Visibility,
  object
>;

type AuthorizedMutationBuilder<
  User extends ConvexLibUser,
  DataModel extends GenericDataModel,
  Visibility extends FunctionVisibility,
> = CustomBuilder<
  'mutation',
  EmptyObject,
  AuthorizedMutationContext<User, DataModel>,
  EmptyObject,
  GenericMutationCtx<DataModel>,
  Visibility,
  object
>;

type AuthorizedActionBuilder<
  User extends ConvexLibUser,
  DataModel extends GenericDataModel,
  Visibility extends FunctionVisibility,
> = CustomBuilder<
  'action',
  EmptyObject,
  AuthorizedActionContext<User>,
  EmptyObject,
  GenericActionCtx<DataModel>,
  Visibility,
  object
>;

export interface AuthorizedPrimitives<
  User extends ConvexLibUser,
  DataModel extends GenericDataModel = GenericDataModel,
  QueryVisibility extends FunctionVisibility = 'public',
  MutationVisibility extends FunctionVisibility = 'public',
  ActionVisibility extends FunctionVisibility = 'public',
> {
  authorizedQuery: (
    resource: string,
    action?: PermissionAction,
  ) => AuthorizedQueryBuilder<User, DataModel, QueryVisibility>;
  authorizedMutation: (
    resource: string,
    action?: PermissionAction,
  ) => AuthorizedMutationBuilder<User, DataModel, MutationVisibility>;
  authorizedAction: (
    resource: string,
    action?: PermissionAction,
  ) => AuthorizedActionBuilder<User, DataModel, ActionVisibility>;
}

export interface AuthorizedConfig<
  User extends ConvexLibUser,
  DataModel extends GenericDataModel = GenericDataModel,
  QueryVisibility extends FunctionVisibility = 'public',
  MutationVisibility extends FunctionVisibility = 'public',
  ActionVisibility extends FunctionVisibility = 'public',
> extends ConvexLibConfig<
  User,
  DataModel,
  QueryVisibility,
  MutationVisibility,
  ActionVisibility
> {
  permissionChecker: PermissionChecker<
    | GenericQueryCtx<DataModel>
    | GenericMutationCtx<DataModel>
    | GenericActionCtx<DataModel>,
    DataModel,
    User['role']
  >;
  permissionCheckerQuery?: PermissionChecker<
    GenericQueryCtx<DataModel>,
    DataModel,
    User['role']
  >;
  permissionCheckerMutation?: PermissionChecker<
    GenericMutationCtx<DataModel>,
    DataModel,
    User['role']
  >;
  permissionCheckerAction?: PermissionChecker<
    GenericActionCtx<DataModel>,
    DataModel,
    User['role']
  >;
}

const DEFAULT_OWNERSHIP_FIELD = 'createdBy';

const toAuthContext = <User extends ConvexLibUser>(
  user: User,
): AuthContext<User> => ({
  user,
  userId: user._id,
  role: user.role,
});

const getPermissionCheckerForQuery = <
  User extends ConvexLibUser,
  DataModel extends GenericDataModel,
  QueryVisibility extends FunctionVisibility,
  MutationVisibility extends FunctionVisibility,
  ActionVisibility extends FunctionVisibility,
>(
  config: AuthorizedConfig<
    User,
    DataModel,
    QueryVisibility,
    MutationVisibility,
    ActionVisibility
  >,
) =>
  (config.permissionCheckerQuery ??
    config.permissionChecker) as PermissionChecker<
    GenericQueryCtx<DataModel>,
    DataModel,
    User['role']
  >;

const getPermissionCheckerForMutation = <
  User extends ConvexLibUser,
  DataModel extends GenericDataModel,
  QueryVisibility extends FunctionVisibility,
  MutationVisibility extends FunctionVisibility,
  ActionVisibility extends FunctionVisibility,
>(
  config: AuthorizedConfig<
    User,
    DataModel,
    QueryVisibility,
    MutationVisibility,
    ActionVisibility
  >,
) =>
  (config.permissionCheckerMutation ??
    config.permissionChecker) as PermissionChecker<
    GenericMutationCtx<DataModel>,
    DataModel,
    User['role']
  >;

const getPermissionCheckerForAction = <
  User extends ConvexLibUser,
  DataModel extends GenericDataModel,
  QueryVisibility extends FunctionVisibility,
  MutationVisibility extends FunctionVisibility,
  ActionVisibility extends FunctionVisibility,
>(
  config: AuthorizedConfig<
    User,
    DataModel,
    QueryVisibility,
    MutationVisibility,
    ActionVisibility
  >,
) =>
  (config.permissionCheckerAction ??
    config.permissionChecker) as PermissionChecker<
    GenericActionCtx<DataModel>,
    DataModel,
    User['role']
  >;

const resolveAuthorizedQueryContext = async <
  User extends ConvexLibUser,
  DataModel extends GenericDataModel,
  QueryVisibility extends FunctionVisibility,
  MutationVisibility extends FunctionVisibility,
  ActionVisibility extends FunctionVisibility,
>(
  ctx: GenericQueryCtx<DataModel>,
  config: AuthorizedConfig<
    User,
    DataModel,
    QueryVisibility,
    MutationVisibility,
    ActionVisibility
  >,
  resource: string,
  action: PermissionAction,
) => {
  const user = await getQueryUserResolver(config)(ctx);
  const allowed = await getPermissionCheckerForQuery(config).hasPermission(
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

  return toAuthContext(user);
};

const resolveAuthorizedMutationContext = async <
  User extends ConvexLibUser,
  DataModel extends GenericDataModel,
  QueryVisibility extends FunctionVisibility,
  MutationVisibility extends FunctionVisibility,
  ActionVisibility extends FunctionVisibility,
>(
  ctx: GenericMutationCtx<DataModel>,
  config: AuthorizedConfig<
    User,
    DataModel,
    QueryVisibility,
    MutationVisibility,
    ActionVisibility
  >,
  resource: string,
  action: PermissionAction,
) => {
  const user = await getMutationUserResolver(config)(ctx);
  const allowed = await getPermissionCheckerForMutation(config).hasPermission(
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

  return toAuthContext(user);
};

const resolveAuthorizedActionContext = async <
  User extends ConvexLibUser,
  DataModel extends GenericDataModel,
  QueryVisibility extends FunctionVisibility,
  MutationVisibility extends FunctionVisibility,
  ActionVisibility extends FunctionVisibility,
>(
  ctx: GenericActionCtx<DataModel>,
  config: AuthorizedConfig<
    User,
    DataModel,
    QueryVisibility,
    MutationVisibility,
    ActionVisibility
  >,
  resource: string,
  action: PermissionAction,
) => {
  const user = await getActionUserResolver(config)(ctx);
  const allowed = await getPermissionCheckerForAction(config).hasPermission(
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

  return toAuthContext(user);
};

const createOwnedQuery = <
  User extends ConvexLibUser,
  DataModel extends GenericDataModel,
>(
  ctx: GenericQueryCtx<DataModel>,
  permissionChecker: PermissionChecker<
    GenericQueryCtx<DataModel>,
    DataModel,
    User['role']
  >,
  auth: AuthContext<User>,
): OwnedQuery<DataModel> => {
  return async <TableName extends TableNamesInDataModel<DataModel>>(
    tableName: TableName,
  ) => {
    const permission = await permissionChecker.getPermissionEntry(
      ctx,
      auth.role,
      tableName,
    );

    if (!permission?.ownOnly) {
      return ctx.db.query(tableName);
    }

    const ownershipField = permission.ownership ?? DEFAULT_OWNERSHIP_FIELD;

    return ctx.db
      .query(tableName)
      .filter(q =>
        q.eq(q.field(ownershipField as never), auth.userId as never),
      );
  };
};

const createOwnedDoc = <
  User extends ConvexLibUser,
  DataModel extends GenericDataModel,
  Ctx,
>(
  ctx: Ctx,
  permissionChecker: PermissionChecker<Ctx, DataModel, User['role']>,
  auth: AuthContext<User>,
): OwnedDoc<DataModel> => {
  return async <TableName extends TableNamesInDataModel<DataModel>>(
    tableName: TableName,
    documentId: GenericId<TableName>,
  ) => {
    const doc = await permissionChecker.getDocument(ctx, tableName, documentId);

    if (!doc) {
      return null;
    }

    const hasAccess = await permissionChecker.checkOwnership(
      ctx,
      auth.userId,
      tableName,
      documentId,
      auth.role,
    );

    if (!hasAccess) {
      throw createError.unauthorized(
        `User does not own document in ${tableName}`,
      );
    }

    return doc;
  };
};

const createOwnedMutation = <DataModel extends GenericDataModel>(
  ctx: GenericMutationCtx<DataModel>,
  ownedDoc: OwnedDoc<DataModel>,
): OwnedMutation<DataModel> => ({
  patch: async <TableName extends TableNamesInDataModel<DataModel>>(
    tableName: TableName,
    documentId: GenericId<TableName>,
    patch: PatchValue<DocumentByName<DataModel, TableName>>,
  ) => {
    const doc = await ownedDoc(tableName, documentId);
    if (!doc) {
      throw createError.notFound(tableName, documentId);
    }

    await ctx.db.patch(documentId, patch);
  },
  delete: async <TableName extends TableNamesInDataModel<DataModel>>(
    tableName: TableName,
    documentId: GenericId<TableName>,
  ) => {
    const doc = await ownedDoc(tableName, documentId);
    if (!doc) {
      throw createError.notFound(tableName, documentId);
    }

    await ctx.db.delete(documentId);
  },
});

export const createAuthorized = <
  User extends ConvexLibUser,
  DataModel extends GenericDataModel = GenericDataModel,
  QueryVisibility extends FunctionVisibility = 'public',
  MutationVisibility extends FunctionVisibility = 'public',
  ActionVisibility extends FunctionVisibility = 'public',
>(
  config: AuthorizedConfig<
    User,
    DataModel,
    QueryVisibility,
    MutationVisibility,
    ActionVisibility
  >,
): AuthorizedPrimitives<
  User,
  DataModel,
  QueryVisibility,
  MutationVisibility,
  ActionVisibility
> => {
  const builders = getBuilders(config);

  return {
    authorizedQuery: (resource: string, action: PermissionAction = 'read') =>
      customQuery(
        builders.query,
        customCtx(async (ctx: GenericQueryCtx<DataModel>) => {
          const auth = await resolveAuthorizedQueryContext(
            ctx,
            config,
            resource,
            action,
          );

          return {
            ...auth,
            ownedQuery: createOwnedQuery(
              ctx,
              getPermissionCheckerForQuery(config),
              auth,
            ),
            ownedDoc: createOwnedDoc(
              ctx,
              getPermissionCheckerForQuery(config),
              auth,
            ),
          };
        }),
      ),
    authorizedMutation: (
      resource: string,
      action: PermissionAction = 'update',
    ) =>
      customMutation(
        builders.mutation,
        customCtx(async (ctx: GenericMutationCtx<DataModel>) => {
          const auth = await resolveAuthorizedMutationContext(
            ctx,
            config,
            resource,
            action,
          );
          const ownedDoc = createOwnedDoc(
            ctx,
            getPermissionCheckerForMutation(config),
            auth,
          );

          return {
            ...auth,
            ownedDoc,
            ownedMutation: createOwnedMutation(ctx, ownedDoc),
          };
        }),
      ),
    authorizedAction: (resource: string, action: PermissionAction = 'read') =>
      customAction(
        builders.action,
        customCtx((ctx: GenericActionCtx<DataModel>) =>
          resolveAuthorizedActionContext(ctx, config, resource, action),
        ),
      ),
  };
};
