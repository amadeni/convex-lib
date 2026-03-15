export type CapabilityCrudAction = 'create' | 'read' | 'update' | 'delete';

export type CapabilityCrudGrant = true | 'own';

export type CapabilityResourceGrants = Partial<
  Record<string, Partial<Record<CapabilityCrudAction, CapabilityCrudGrant>>>
>;

export interface CapabilityArrayGrant {
  resource: string;
  actions: readonly CapabilityCrudAction[];
  grant?: CapabilityCrudGrant;
  ownership?: string;
}

export type CapabilityGrants =
  | CapabilityResourceGrants
  | readonly CapabilityArrayGrant[];

export type NormalizedCapabilityResourceGrant = Partial<
  Record<CapabilityCrudAction, CapabilityCrudGrant>
> & {
  ownership?: string;
};

export type NormalizedCapabilityGrants = Partial<
  Record<string, NormalizedCapabilityResourceGrant>
>;

/**
 * A capability definition describes a single feature-level permission
 * with a label, category, and the roles that have it by default.
 */
export interface CapabilityDefinition {
  label: string;
  category: string;
  defaultRoles: readonly string[];
  grants?: CapabilityGrants;
}

/**
 * A capability override stored in the database.
 * Replaces the default roles for a specific capability key.
 */
export interface CapabilityOverride {
  key: string;
  roles: readonly string[];
}

/**
 * Registry of all capability definitions, keyed by capability key.
 */
export type CapabilityRegistry = Record<string, CapabilityDefinition>;

export type CapabilityKey<
  TRegistry extends CapabilityRegistry = CapabilityRegistry,
> = string & keyof TRegistry;

export const normalizeCapabilityGrants = (
  grants?: CapabilityGrants,
): NormalizedCapabilityGrants => {
  if (!grants) {
    return {};
  }

  if (!Array.isArray(grants)) {
    return grants as NormalizedCapabilityGrants;
  }

  const normalized: NormalizedCapabilityGrants = {};

  for (const entry of grants) {
    const current = normalized[entry.resource] ?? {};

    for (const action of entry.actions as readonly CapabilityCrudAction[]) {
      current[action] = entry.grant ?? true;
    }

    if (entry.ownership) {
      current.ownership = entry.ownership;
    }

    normalized[entry.resource] = current;
  }

  return normalized;
};

/**
 * Configuration for creating a capability checker.
 */
export interface CapabilityCheckerConfig<
  Ctx,
  TRegistry extends CapabilityRegistry = CapabilityRegistry,
  Role extends string | undefined = string | undefined,
> {
  /** The full registry of capability definitions */
  registry: TRegistry;
  /** How to look up a DB override for a capability key */
  getOverride(
    ctx: Ctx,
    key: CapabilityKey<TRegistry>,
  ): Promise<CapabilityOverride | null>;
  /** Roles that always have all capabilities (default: ['admin']) */
  adminRoles?: readonly Exclude<Role, undefined>[];
}

export interface CapabilityChecker<
  Ctx,
  TRegistry extends CapabilityRegistry = CapabilityRegistry,
  Role extends string | undefined = string | undefined,
> {
  has(ctx: Ctx, role: Role, key: CapabilityKey<TRegistry>): Promise<boolean>;
  checkAll(
    ctx: Ctx,
    role: Role,
  ): Promise<Record<CapabilityKey<TRegistry>, boolean>>;
  keys: readonly CapabilityKey<TRegistry>[];
  registry: TRegistry;
}

/**
 * Creates a capability checker from a registry and a DB lookup function.
 *
 * Capabilities are feature-level permissions (e.g. 'invoice.manage',
 * 'documentation.lock') that are more granular than CRUD permissions.
 *
 * Each capability has default roles defined in the registry.
 * These can be overridden per-deployment via DB entries.
 */
export const createCapabilityChecker = <
  Ctx,
  TRegistry extends CapabilityRegistry = CapabilityRegistry,
  Role extends string | undefined = string | undefined,
>(
  config: CapabilityCheckerConfig<Ctx, TRegistry, Role>,
): CapabilityChecker<Ctx, TRegistry, Role> => {
  const adminRoles = config.adminRoles ?? ['admin'];

  type Key = CapabilityKey<TRegistry>;

  const has = async (ctx: Ctx, role: Role, key: Key): Promise<boolean> => {
    if (role !== undefined && adminRoles.includes(role as never)) {
      return true;
    }

    const effectiveRole = (role ?? 'default') as string;
    const override = await config.getOverride(ctx, key);

    if (override) {
      return override.roles.includes(effectiveRole);
    }

    const definition = config.registry[key];
    if (!definition) {
      return false;
    }

    return definition.defaultRoles.includes(effectiveRole);
  };

  const checkAll = async (
    ctx: Ctx,
    role: Role,
  ): Promise<Record<Key, boolean>> => {
    const keys = Object.keys(config.registry) as Key[];
    const entries = await Promise.all(
      keys.map(async key => [key, await has(ctx, role, key)] as const),
    );
    return Object.fromEntries(entries) as Record<Key, boolean>;
  };

  const keys = Object.keys(config.registry) as readonly Key[];

  return {
    has,
    checkAll,
    keys,
    registry: config.registry,
  };
};
