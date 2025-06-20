
import { db } from '../db';
import { assetsTable, assetModelsTable, usersTable, assetAssignmentsTable, maintenanceRecordsTable, assetDisposalsTable } from '../db/schema';
import { type AssetWithRelations } from '../schema';
import { eq, isNull } from 'drizzle-orm';

export const getAssets = async (): Promise<AssetWithRelations[]> => {
  try {
    // Get all assets with their models and assigned users
    const assetsWithModels = await db.select()
      .from(assetsTable)
      .innerJoin(assetModelsTable, eq(assetsTable.model_id, assetModelsTable.id))
      .leftJoin(usersTable, eq(assetsTable.assigned_to, usersTable.id))
      .execute();

    // Get current assignments for all assets
    const currentAssignments = await db.select()
      .from(assetAssignmentsTable)
      .where(isNull(assetAssignmentsTable.unassigned_at))
      .execute();

    // Get all maintenance records
    const maintenanceRecords = await db.select()
      .from(maintenanceRecordsTable)
      .execute();

    // Get all disposals
    const disposals = await db.select()
      .from(assetDisposalsTable)
      .execute();

    // Build the result with relations
    return assetsWithModels.map(result => {
      const asset = result.assets;
      const model = result.asset_models;
      const assignedUser = result.users;

      // Find current assignment for this asset
      const currentAssignment = currentAssignments.find(
        assignment => assignment.asset_id === asset.id
      ) || null;

      // Find maintenance records for this asset
      const assetMaintenanceRecords = maintenanceRecords.filter(
        record => record.asset_id === asset.id
      ).map(record => ({
        ...record,
        cost: record.cost ? parseFloat(record.cost) : null
      }));

      // Find disposal for this asset
      const assetDisposal = disposals.find(
        disposal => disposal.asset_id === asset.id
      );
      const disposal = assetDisposal ? {
        ...assetDisposal,
        cost: assetDisposal.cost ? parseFloat(assetDisposal.cost) : null
      } : null;

      return {
        ...asset,
        model,
        assigned_user: assignedUser,
        current_assignment: currentAssignment,
        maintenance_records: assetMaintenanceRecords,
        disposal
      };
    });
  } catch (error) {
    console.error('Failed to get assets:', error);
    throw error;
  }
};
