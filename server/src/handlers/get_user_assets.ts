
import { db } from '../db';
import { usersTable, assetsTable, assetModelsTable, assetAssignmentsTable, maintenanceRecordsTable, assetDisposalsTable } from '../db/schema';
import { type UserAssets } from '../schema';
import { eq, isNull, isNotNull, and } from 'drizzle-orm';

export const getUserAssets = async (userId: string): Promise<UserAssets> => {
  try {
    // Get user information
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (users.length === 0) {
      throw new Error(`User with id ${userId} not found`);
    }

    const user = users[0];

    // Get current assets (assets currently assigned to the user)
    const currentAssetsQuery = await db.select()
      .from(assetsTable)
      .innerJoin(assetModelsTable, eq(assetsTable.model_id, assetModelsTable.id))
      .leftJoin(usersTable, eq(assetsTable.assigned_to, usersTable.id))
      .where(eq(assetsTable.assigned_to, userId))
      .execute();

    // Get current assignment records for current assets
    const currentAssetIds = currentAssetsQuery.map(result => result.assets.id);
    const currentAssignments = currentAssetIds.length > 0 
      ? await db.select()
          .from(assetAssignmentsTable)
          .where(and(
            eq(assetAssignmentsTable.user_id, userId),
            isNull(assetAssignmentsTable.unassigned_at)
          ))
          .execute()
      : [];

    // Get maintenance records for current assets
    const maintenanceRecords = currentAssetIds.length > 0
      ? await db.select()
          .from(maintenanceRecordsTable)
          .execute()
      : [];

    // Get disposal records for current assets
    const disposalRecords = currentAssetIds.length > 0
      ? await db.select()
          .from(assetDisposalsTable)
          .execute()
      : [];

    // Build current assets with relations
    const current_assets = currentAssetsQuery.map(result => {
      const asset = result.assets;
      const model = result.asset_models;
      const assignedUser = result.users;

      // Find current assignment
      const currentAssignment = currentAssignments.find(
        assignment => assignment.asset_id === asset.id && assignment.user_id === userId
      );

      // Find maintenance records for this asset
      const assetMaintenanceRecords = maintenanceRecords
        .filter(record => record.asset_id === asset.id)
        .map(record => ({
          ...record,
          cost: record.cost ? parseFloat(record.cost) : null
        }));

      // Find disposal record for this asset
      const disposal = disposalRecords.find(record => record.asset_id === asset.id);
      const disposalWithCost = disposal ? {
        ...disposal,
        cost: disposal.cost ? parseFloat(disposal.cost) : null
      } : null;

      return {
        ...asset,
        model,
        assigned_user: assignedUser,
        current_assignment: currentAssignment || null,
        maintenance_records: assetMaintenanceRecords,
        disposal: disposalWithCost
      };
    });

    // Get past assignments (assignments that have been unassigned - unassigned_at is NOT NULL)
    const pastAssignmentsQuery = await db.select()
      .from(assetAssignmentsTable)
      .innerJoin(assetsTable, eq(assetAssignmentsTable.asset_id, assetsTable.id))
      .innerJoin(assetModelsTable, eq(assetsTable.model_id, assetModelsTable.id))
      .leftJoin(usersTable, eq(assetsTable.assigned_to, usersTable.id))
      .where(and(
        eq(assetAssignmentsTable.user_id, userId),
        isNotNull(assetAssignmentsTable.unassigned_at)
      ))
      .execute();

    // Get maintenance records for past assignment assets
    const pastAssetIds = pastAssignmentsQuery.map(result => result.assets.id);
    const pastMaintenanceRecords = pastAssetIds.length > 0
      ? await db.select()
          .from(maintenanceRecordsTable)
          .execute()
      : [];

    // Get disposal records for past assignment assets
    const pastDisposalRecords = pastAssetIds.length > 0
      ? await db.select()
          .from(assetDisposalsTable)
          .execute()
      : [];

    // Build past assignments with asset relations
    const past_assignments = pastAssignmentsQuery.map(result => {
      const assignment = result.asset_assignments;
      const asset = result.assets;
      const model = result.asset_models;
      const assignedUser = result.users;

      // Find maintenance records for this asset
      const assetMaintenanceRecords = pastMaintenanceRecords
        .filter(record => record.asset_id === asset.id)
        .map(record => ({
          ...record,
          cost: record.cost ? parseFloat(record.cost) : null
        }));

      // Find disposal record for this asset
      const disposal = pastDisposalRecords.find(record => record.asset_id === asset.id);
      const disposalWithCost = disposal ? {
        ...disposal,
        cost: disposal.cost ? parseFloat(disposal.cost) : null
      } : null;

      const assetWithRelations = {
        ...asset,
        model,
        assigned_user: assignedUser,
        current_assignment: null, // Past assignments don't have current assignment
        maintenance_records: assetMaintenanceRecords,
        disposal: disposalWithCost
      };

      return {
        ...assignment,
        asset: assetWithRelations
      };
    });

    return {
      user,
      current_assets,
      past_assignments
    };
  } catch (error) {
    console.error('Get user assets failed:', error);
    throw error;
  }
};
