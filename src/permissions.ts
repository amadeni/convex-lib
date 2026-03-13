import type { AnyCtx, ConvexLibUser } from './types';

export type PermissionAction = 'create' | 'read' | 'update' | 'delete';

export interface PermissionEntry {
  role: string;
  resource: string;
  create?: boolean;
  read?: boolean;
  update?: boolean;
  delete?: boolean;
  ownOnly?: boolean;
  ownership?: string;
}

export interface PermissionCheckerConfig {
  getPermission: (
    ctx: AnyCtx,
    role: string,
    resource: string,
  ) => Promise<PermissionEntry | null>;
  getDocument: (
    ctx: AnyCtx,
    table: string,
    id: string,
  ) => Promise<Record<string, unknown> | null>;
  adminRoles?: string[];
  defaultAllow?: boolean;
}

const DEFAULT_ADMIN_ROLES = ['admin'];
const DEFAULT_OWNERSHIP_FIELD = 'createdBy';

const matchesAdminRole = (role: string | undefined, adminRoles: string[]) =>
  role !== undefined && adminRoles.includes(role);

export const createPermissionChecker = (config: PermissionCheckerConfig) => {
  const adminRoles = config.adminRoles ?? DEFAULT_ADMIN_ROLES;
  const defaultAllow = config.defaultAllow ?? true;

  const getPermissionEntry = async (
    ctx: AnyCtx,
    role: string | undefined,
    resource: string,
  ) => config.getPermission(ctx, role ?? 'default', resource);

  const hasPermission = async <User extends ConvexLibUser>(
    ctx: AnyCtx,
    user: User,
    resource: string,
    action: PermissionAction,
  ): Promise<boolean> => {
    if (matchesAdminRole(user.role, adminRoles)) {
      return true;
    }

    const permission = await getPermissionEntry(ctx, user.role, resource);
    if (!permission) {
      return defaultAllow;
    }

    return permission[action] === true;
  };

  const checkOwnership = async (
    ctx: AnyCtx,
    userId: string,
    table: string,
    documentId: string,
    role: string | undefined,
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
    const owner = doc[ownershipField];

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
