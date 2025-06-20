
import { db } from '../db';
import { assetsTable, assetModelsTable, usersTable, activityLogTable } from '../db/schema';
import { type CreateAssetInput, type AssetWithRelations } from '../schema';
import { eq } from 'drizzle-orm';

export const createAsset = async (input: CreateAssetInput, userId: string): Promise<AssetWithRelations> => {
  try {
    // Verify the asset model exists
    const model = await db.select()
      .from(assetModelsTable)
      .where(eq(assetModelsTable.id, input.model_id))
      .execute();

    if (model.length === 0) {
      throw new Error(`Asset model with id ${input.model_id} not found`);
    }

    // Verify the user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (user.length === 0) {
      throw new Error(`User with id ${userId} not found`);
    }

    // Create the asset
    const assetResult = await db.insert(assetsTable)
      .values({
        asset_id: input.asset_id,
        model_id: input.model_id,
        status: 'In Stock',
        assigned_to: null,
        purchase_date: input.purchase_date,
        warranty_expiry: input.warranty_expiry,
        location: input.location,
        notes: input.notes
      })
      .returning()
      .execute();

    const asset = assetResult[0];

    // Log the activity
    await db.insert(activityLogTable)
      .values({
        activity_type: 'Asset Created',
        entity_type: 'Asset',
        entity_id: asset.id.toString(),
        user_id: userId,
        description: `Asset ${input.asset_id} created`,
        metadata: null
      })
      .execute();

    // Return the asset with relations
    return {
      ...asset,
      model: model[0],
      assigned_user: null,
      current_assignment: null,
      maintenance_records: [],
      disposal: null
    };
  } catch (error) {
    console.error('Asset creation failed:', error);
    throw error;
  }
};
