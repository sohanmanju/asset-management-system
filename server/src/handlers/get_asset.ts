
import { db } from '../db';
import { assetsTable, assetModelsTable, usersTable, assetAssignmentsTable, maintenanceRecordsTable, assetDisposalsTable } from '../db/schema';
import { type AssetWithRelations } from '../schema';
import { eq, isNull } from 'drizzle-orm';

export const getAsset = async (id: number): Promise<AssetWithRelations | null> => {
  try {
    // Get the asset with its model and assigned user
    const assetResult = await db.select()
      .from(assetsTable)
      .leftJoin(assetModelsTable, eq(assetsTable.model_id, assetModelsTable.id))
      .leftJoin(usersTable, eq(assetsTable.assigned_to, usersTable.id))
      .where(eq(assetsTable.id, id))
      .execute();

    if (assetResult.length === 0) {
      return null;
    }

    const assetData = assetResult[0];
    const asset = assetData.assets;
    const model = assetData.asset_models;
    const assignedUser = assetData.users;

    // Get current assignment (most recent assignment without unassigned_at)
    const currentAssignmentResult = await db.select()
      .from(assetAssignmentsTable)
      .where(
        eq(assetAssignmentsTable.asset_id, id)
      )
      .orderBy(assetAssignmentsTable.assigned_at)
      .execute();

    const currentAssignment = currentAssignmentResult.find(assignment => assignment.unassigned_at === null) || null;

    // Get all maintenance records for this asset
    const maintenanceRecords = await db.select()
      .from(maintenanceRecordsTable)
      .where(eq(maintenanceRecordsTable.asset_id, id))
      .execute();

    // Convert numeric fields in maintenance records
    const processedMaintenanceRecords = maintenanceRecords.map(record => ({
      ...record,
      cost: record.cost ? parseFloat(record.cost) : null
    }));

    // Get disposal record if it exists
    const disposalResult = await db.select()
      .from(assetDisposalsTable)
      .where(eq(assetDisposalsTable.asset_id, id))
      .execute();

    const disposal = disposalResult.length > 0 ? {
      ...disposalResult[0],
      cost: disposalResult[0].cost ? parseFloat(disposalResult[0].cost) : null
    } : null;

    if (!model) {
      throw new Error('Asset model not found');
    }

    return {
      ...asset,
      model,
      assigned_user: assignedUser,
      current_assignment: currentAssignment,
      maintenance_records: processedMaintenanceRecords,
      disposal
    };
  } catch (error) {
    console.error('Get asset failed:', error);
    throw error;
  }
};
