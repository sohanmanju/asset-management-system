
import { db } from '../db';
import { assetsTable, assetModelsTable, usersTable, assetAssignmentsTable, maintenanceRecordsTable, assetDisposalsTable, activityLogTable } from '../db/schema';
import { type UpdateAssetInput, type AssetWithRelations } from '../schema';
import { eq, and, isNull, ne } from 'drizzle-orm';

export const updateAsset = async (input: UpdateAssetInput, userId: string): Promise<AssetWithRelations> => {
  try {
    // First, verify the asset exists
    const existingAsset = await db.select()
      .from(assetsTable)
      .where(eq(assetsTable.id, input.id))
      .execute();

    if (existingAsset.length === 0) {
      throw new Error(`Asset with ID ${input.id} not found`);
    }

    // If model_id is being updated, verify it exists
    if (input.model_id !== undefined) {
      const modelExists = await db.select()
        .from(assetModelsTable)
        .where(eq(assetModelsTable.id, input.model_id))
        .execute();

      if (modelExists.length === 0) {
        throw new Error(`Asset model with ID ${input.model_id} not found`);
      }
    }

    // If asset_id is being updated, verify it's unique
    if (input.asset_id !== undefined && input.asset_id !== existingAsset[0].asset_id) {
      const duplicateAssetId = await db.select()
        .from(assetsTable)
        .where(and(
          eq(assetsTable.asset_id, input.asset_id),
          ne(assetsTable.id, input.id) // Use ne() to exclude current asset
        ))
        .execute();

      if (duplicateAssetId.length > 0) {
        throw new Error(`Asset ID ${input.asset_id} already exists`);
      }
    }

    // Prepare update data
    const updateData: any = {
      updated_at: new Date()
    };

    if (input.asset_id !== undefined) updateData.asset_id = input.asset_id;
    if (input.model_id !== undefined) updateData.model_id = input.model_id;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.purchase_date !== undefined) updateData.purchase_date = input.purchase_date;
    if (input.warranty_expiry !== undefined) updateData.warranty_expiry = input.warranty_expiry;
    if (input.location !== undefined) updateData.location = input.location;
    if (input.notes !== undefined) updateData.notes = input.notes;

    // Update the asset
    const updatedAssets = await db.update(assetsTable)
      .set(updateData)
      .where(eq(assetsTable.id, input.id))
      .returning()
      .execute();

    const updatedAsset = updatedAssets[0];

    // Log the activity
    await db.insert(activityLogTable)
      .values({
        activity_type: 'Asset Updated',
        entity_type: 'asset',
        entity_id: updatedAsset.id.toString(),
        user_id: userId,
        description: `Asset ${updatedAsset.asset_id} was updated`,
        metadata: JSON.stringify(input)
      })
      .execute();

    // Fetch the complete asset with relations
    const result = await db.select()
      .from(assetsTable)
      .innerJoin(assetModelsTable, eq(assetsTable.model_id, assetModelsTable.id))
      .leftJoin(usersTable, eq(assetsTable.assigned_to, usersTable.id))
      .where(eq(assetsTable.id, updatedAsset.id))
      .execute();

    if (result.length === 0) {
      throw new Error('Failed to fetch updated asset');
    }

    const assetData = result[0];

    // Get current assignment
    const currentAssignment = await db.select()
      .from(assetAssignmentsTable)
      .where(and(
        eq(assetAssignmentsTable.asset_id, updatedAsset.id),
        isNull(assetAssignmentsTable.unassigned_at)
      ))
      .execute();

    // Get maintenance records
    const maintenanceRecords = await db.select()
      .from(maintenanceRecordsTable)
      .where(eq(maintenanceRecordsTable.asset_id, updatedAsset.id))
      .execute();

    // Get disposal record
    const disposalRecords = await db.select()
      .from(assetDisposalsTable)
      .where(eq(assetDisposalsTable.asset_id, updatedAsset.id))
      .execute();

    return {
      id: assetData.assets.id,
      asset_id: assetData.assets.asset_id,
      model_id: assetData.assets.model_id,
      status: assetData.assets.status,
      assigned_to: assetData.assets.assigned_to,
      purchase_date: assetData.assets.purchase_date,
      warranty_expiry: assetData.assets.warranty_expiry,
      location: assetData.assets.location,
      notes: assetData.assets.notes,
      created_at: assetData.assets.created_at,
      updated_at: assetData.assets.updated_at,
      model: {
        id: assetData.asset_models.id,
        manufacturer: assetData.asset_models.manufacturer,
        model_number: assetData.asset_models.model_number,
        category: assetData.asset_models.category,
        specs: assetData.asset_models.specs,
        created_at: assetData.asset_models.created_at,
        updated_at: assetData.asset_models.updated_at
      },
      assigned_user: assetData.users ? {
        id: assetData.users.id,
        email: assetData.users.email,
        name: assetData.users.name,
        role: assetData.users.role,
        created_at: assetData.users.created_at,
        updated_at: assetData.users.updated_at
      } : null,
      current_assignment: currentAssignment.length > 0 ? {
        id: currentAssignment[0].id,
        asset_id: currentAssignment[0].asset_id,
        user_id: currentAssignment[0].user_id,
        assigned_by: currentAssignment[0].assigned_by,
        assigned_at: currentAssignment[0].assigned_at,
        unassigned_at: currentAssignment[0].unassigned_at,
        notes: currentAssignment[0].notes
      } : null,
      maintenance_records: maintenanceRecords.map(record => ({
        id: record.id,
        asset_id: record.asset_id,
        scheduled_date: record.scheduled_date,
        completed_date: record.completed_date,
        description: record.description,
        performed_by: record.performed_by,
        cost: record.cost ? parseFloat(record.cost) : null,
        status: record.status,
        notes: record.notes,
        created_at: record.created_at,
        updated_at: record.updated_at
      })),
      disposal: disposalRecords.length > 0 ? {
        id: disposalRecords[0].id,
        asset_id: disposalRecords[0].asset_id,
        disposal_date: disposalRecords[0].disposal_date,
        disposal_method: disposalRecords[0].disposal_method,
        cost: disposalRecords[0].cost ? parseFloat(disposalRecords[0].cost) : null,
        disposed_by: disposalRecords[0].disposed_by,
        notes: disposalRecords[0].notes,
        created_at: disposalRecords[0].created_at
      } : null
    };
  } catch (error) {
    console.error('Asset update failed:', error);
    throw error;
  }
};
