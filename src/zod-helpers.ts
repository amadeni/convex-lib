import { z } from 'zod';

/**
 * Create a Zod validator for a Convex document ID.
 * Validation only checks that the value is a string; it does not verify the
 * actual Convex ID format. The table name parameter is for documentation /
 * type hinting only.
 */
export const zid = (_tableName: string) =>
  z.custom<string>(value => typeof value === 'string');

/**
 * Add Convex system fields (_id, _creationTime) to a Zod object shape.
 */
export const addSystemFields = <T extends z.ZodRawShape>(
  tableName: string,
  zObject: T,
) => ({
  ...zObject,
  _id: zid(tableName),
  _creationTime: z.number(),
});
