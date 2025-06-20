
import { db } from '../db';
import { assetsTable, assetModelsTable, usersTable, assetAssignmentsTable, maintenanceRecordsTable, assetDisposalsTable } from '../db/schema';
import { type AssetSearchInput, type AssetWithRelations } from '../schema';
import { eq, and, like, ilike, count, isNull, SQL, inArray } from 'drizzle-orm';

export const searchAssets = async (input: AssetSearchInput): Promise<{
  assets: AssetWithRelations[];
  total: number;
}> => {
  try {
    // Build conditions array
    const conditions: SQL<unknown>[] = [];

    if (input.category) {
      conditions.push(eq(assetModelsTable.category, input.category));
    }

    if (input.status) {
      conditions.push(eq(assetsTable.status, input.status));
    }

    if (input.manufacturer) {
      conditions.push(ilike(assetModelsTable.manufacturer, `%${input.manufacturer}%`));
    }

    if (input.model_number) {
      conditions.push(ilike(assetModelsTable.model_number, `%${input.model_number}%`));
    }

    if (input.assigned_to) {
      conditions.push(eq(assetsTable.assigned_to, input.assigned_to));
    }

    if (input.search) {
      conditions.push(
        ilike(assetsTable.asset_id, `%${input.search}%`)
      );
    }

    // Build base query with joins for relations
    const results = await db.select({
      asset: assetsTable,
      model: assetModelsTable,
      assigned_user: usersTable
    })
    .from(assetsTable)
    .innerJoin(assetModelsTable, eq(assetsTable.model_id, assetModelsTable.id))
    .leftJoin(usersTable, eq(assetsTable.assigned_to, usersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .limit(input.limit)
    .offset(input.offset)
    .execute();

    // Get total count with same conditions for pagination
    const totalResult = await db.select({ count: count() })
      .from(assetsTable)
      .innerJoin(assetModelsTable, eq(assetsTable.model_id, assetModelsTable.id))
      .leftJoin(usersTable, eq(assetsTable.assigned_to, usersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .execute();

    const total = totalResult[0].count;

    // Get asset IDs to fetch related data
    const assetIds = results.map(r => r.asset.id);

    // Fetch current assignments
    const currentAssignments = assetIds.length > 0 
      ? await db.select()
          .from(assetAssignmentsTable)
          .where(
            and(
              inArray(assetAssignmentsTable.asset_id, assetIds),
              isNull(assetAssignmentsTable.unassigned_at)
            )
          )
          .execute()
      : [];

    // Fetch maintenance records
    const maintenanceRecords = assetIds.length > 0
      ? await db.select()
          .from(maintenanceRecordsTable)
          .where(inArray(maintenanceRecordsTable.asset_id, assetIds))
          .execute()
      : [];

    // Fetch disposals
    const disposals = assetIds.length > 0
      ? await db.select()
          .from(assetDisposalsTable)
          .where(inArray(assetDisposalsTable.asset_id, assetIds))
          .execute()
      : [];

    // Create lookup maps
    const assignmentMap = new Map(
      currentAssignments.map(a => [a.asset_id, a])
    );
    const maintenanceMap = new Map<number, any[]>();
    maintenanceRecords.forEach(record => {
      const assetId = record.asset_id;
      if (!maintenanceMap.has(assetId)) {
        maintenanceMap.set(assetId, []);
      }
      maintenanceMap.get(assetId)!.push({
        ...record,
        cost: record.cost ? parseFloat(record.cost) : null
      });
    });
    const disposalMap = new Map(
      disposals.map(d => [d.asset_id, {
        ...d,
        cost: d.cost ? parseFloat(d.cost) : null
      }])
    );

    // Map results to AssetWithRelations format
    const assets: AssetWithRelations[] = results.map(result => ({
      ...result.asset,
      model: result.model,
      assigned_user: result.assigned_user,
      current_assignment: assignmentMap.get(result.asset.id) || null,
      maintenance_records: maintenanceMap.get(result.asset.id) || [],
      disposal: disposalMap.get(result.asset.id) || null
    }));

    return {
      assets,
      total
    };
  } catch (error) {
    console.error('Asset search failed:', error);
    throw error;
  }
};
