/**
 * DB-01: audit fields for a soft delete. A soft delete sets isActive to false and records the
 * acting user in updatedBy. Rows are never removed.
 *
 * The cascades are written out in each service, inside prisma.$transaction, with each child's real
 * foreign key. The earlier generic helper looked children up through a field-name map, and several
 * entries pointed at the wrong column (see docs/INTEGRATION_TESTING.md, section 8.2).
 */
export const softDeleteAudit = (userId: string, now: Date = new Date()) => ({
    isActive: false,
    updatedBy: userId,
    updatedAt: now,
});
