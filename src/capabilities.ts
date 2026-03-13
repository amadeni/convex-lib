import type { AnyCtx } from './types';

/**
 * A capability definition describes a single feature-level permission
 * with a label, category, and the roles that have it by default.
 */
export interface CapabilityDefinition {
  label: string;
  category: string;
  defaultRoles: readonly string[];
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

/**
 * Configuration for creating a capability checker.
 */
export interface CapabilityCheckerConfig<
  TRegistry extends CapabilityRegistry = CapabilityRegistry,
> {
  /** The full registry of capability definitions */
  registry: TRegistry;
  /** How to look up a DB override for a capability key */
  getOverride: (ctx: AnyCtx, key: string) => Promise<CapabilityOverride | null>;
  /** Roles that always have all capabilities (default: ['admin']) */
  adminRoles?: string[];
}

/**
 * Creates a capability checker from a registry and a DB lookup function.
 *
 * Capabilities are feature-level permissions (e.g. 'invoice.manage',
 * 'documentation.lock') that are more granular than CRUD permissions.
 *
 * Each capability has default roles defined in the registry.
 * These can be overridden per-deployment via DB entries.
 *
 * @example
 * ```ts
 * const capabilities = createCapabilityChecker({
 *   registry: {
 *     'invoice.manage': {
 *       label: 'Manage invoices',
 *       category: 'invoices',
 *       defaultRoles: ['accountant'],
 *     },
 *   },
 *   getOverride: async (ctx, key) => {
 *     return await ctx.db.query('capabilityOverrides')
 *       .withIndex('by_key', q => q.eq('key', key))
 *       .first();
 *   },
 * });
 *
 * // In a mutation handler:
 * if (await capabilities.has(ctx, user.role, 'invoice.manage')) { ... }
 * ```
 */
export const createCapabilityChecker = <
  TRegistry extends CapabilityRegistry = CapabilityRegistry,
>(
  config: CapabilityCheckerConfig<TRegistry>,
) => {
  const adminRoles = config.adminRoles ?? ['admin'];

  type Key = string & keyof TRegistry;

  /**
   * Check if a role has a specific capability.
   * Admin roles always return true.
   * DB overrides take precedence over registry defaults.
   */
  const has = async (
    ctx: AnyCtx,
    role: string | undefined,
    key: Key,
  ): Promise<boolean> => {
    if (role !== undefined && adminRoles.includes(role)) {
      return true;
    }

    const effectiveRole = role ?? 'default';

    // Check for DB override first
    const override = await config.getOverride(ctx, key);
    if (override) {
      return (override.roles as readonly string[]).includes(effectiveRole);
    }

    // Fall back to registry defaults
    const definition = config.registry[key];
    if (!definition) {
      return false;
    }

    return (definition.defaultRoles as readonly string[]).includes(
      effectiveRole,
    );
  };

  /**
   * Check all capabilities for a given role.
   * Returns a record of capability key → boolean.
   */
  const checkAll = async (
    ctx: AnyCtx,
    role: string | undefined,
  ): Promise<Record<Key, boolean>> => {
    const keys = Object.keys(config.registry) as Key[];
    const results = {} as Record<Key, boolean>;

    for (const key of keys) {
      results[key] = await has(ctx, role, key);
    }

    return results;
  };

  /**
   * Get all capability keys from the registry.
   */
  const keys = Object.keys(config.registry) as readonly Key[];

  /**
   * Get the registry (for UI rendering, admin panels, etc.)
   */
  const registry = config.registry;

  return { has, checkAll, keys, registry };
};
