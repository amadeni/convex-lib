import type {
  DocumentByName,
  GenericDataModel,
  TableNamesInDataModel,
} from 'convex/server';
import type { GenericId } from 'convex/values';
import type { ConvexLibUser } from './types';

export type PermissionAction = 'create' | 'read' | 'update' | 'delete';

export interface PermissionEntry<Role extends string = string> {
  role: Role;
  resource: string;
  create?: boolean;
  read?: boolean;
  update?: boolean;
  delete?: boolean;
  ownOnly?: boolean;
  ownership?: string;
}

export interface PermissionCheckerConfig<
  Ctx,
  DataModel extends GenericDataModel = GenericDataModel,
  Role extends string | undefined = string | undefined,
> {
  getPermission(
    ctx: Ctx,
    role: Role,
    resource: string,
  ): Promise<PermissionEntry | null>;
  getDocument<TableName extends TableNamesInDataModel<DataModel>>(
    ctx: Ctx,
    table: TableName,
    id: GenericId<TableName>,
  ): Promise<DocumentByName<DataModel, TableName> | null>;
  adminRoles?: readonly Exclude<Role, undefined>[];
  defaultAllow?: boolean;
}

export interface PermissionChecker<
  Ctx,
  DataModel extends GenericDataModel = GenericDataModel,
  Role extends string | undefined = string | undefined,
> {
  hasPermission<User extends ConvexLibUser<Role>>(
    ctx: Ctx,
    user: User,
    resource: string,
    action: PermissionAction,
  ): Promise<boolean>;
  checkOwnership<TableName extends TableNamesInDataModel<DataModel>>(
    ctx: Ctx,
    userId: string,
    table: TableName,
    documentId: GenericId<TableName>,
    role: Role,
  ): Promise<boolean>;
  getPermissionEntry(
    ctx: Ctx,
    role: Role,
    resource: string,
  ): Promise<PermissionEntry | null>;
  getDocument<TableName extends TableNamesInDataModel<DataModel>>(
    ctx: Ctx,
    table: TableName,
    id: GenericId<TableName>,
  ): Promise<DocumentByName<DataModel, TableName> | null>;
}

const DEFAULT_ADMIN_ROLES = ['admin'] as const;
const DEFAULT_OWNERSHIP_FIELD = 'createdBy';

const matchesAdminRole = (
  role: string | undefined,
  adminRoles: readonly string[],
) => role !== undefined && adminRoles.includes(role);

export const createPermissionChecker = <
  Ctx,
  DataModel extends GenericDataModel = GenericDataModel,
  Role extends string | undefined = string | undefined,
>(
  config: PermissionCheckerConfig<Ctx, DataModel, Role>,
): PermissionChecker<Ctx, DataModel, Role> => {
  const adminRoles = config.adminRoles ?? DEFAULT_ADMIN_ROLES;
  const defaultAllow = config.defaultAllow ?? true;

  const getPermissionEntry = async (ctx: Ctx, role: Role, resource: string) =>
    config.getPermission(ctx, role, resource);

  const hasPermission = async <User extends ConvexLibUser<Role>>(
    ctx: Ctx,
    user: User,
    resource: string,
    action: PermissionAction,
  ): Promise<boolean> => {
    if (matchesAdminRole(user.role, adminRoles)) {
      return true;
    }

    const permission = await getPermissionEntry(
      ctx,
      user.role as Role,
      resource,
    );
    if (!permission) {
      return defaultAllow;
    }

    return permission[action] === true;
  };

  const checkOwnership = async <
    TableName extends TableNamesInDataModel<DataModel>,
  >(
    ctx: Ctx,
    userId: string,
    table: TableName,
    documentId: GenericId<TableName>,
    role: Role,
  ): Promise<boolean> => {
    if (matchesAdminRole(role, adminRoles)) {
      return true;
    }

    const permission = await getPermissionEntry(ctx, role, table);
    if (!permission || !permission.ownOnly) {
      return true;
    }

    const doc = await config.getDocument(ctx, table, documentId);
    if (!doc) {
      return false;
    }

    const ownershipField = permission.ownership ?? DEFAULT_OWNERSHIP_FIELD;
    const owner = doc[ownershipField as keyof typeof doc];

    if (owner === undefined) {
      return false;
    }

    if (owner === userId) {
      return true;
    }

    return Array.isArray(owner) && owner.includes(userId);
  };

  return {
    hasPermission,
    checkOwnership,
    getPermissionEntry,
    getDocument: config.getDocument,
  };
};
