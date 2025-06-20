
import { db } from '../db';
import { assetModelsTable, activityLogTable } from '../db/schema';
import { type CreateAssetModelInput, type AssetModel } from '../schema';

export const createAssetModel = async (input: CreateAssetModelInput, userId: string): Promise<AssetModel> => {
  try {
    // Insert asset model record
    const result = await db.insert(assetModelsTable)
      .values({
        manufacturer: input.manufacturer,
        model_number: input.model_number,
        category: input.category,
        specs: input.specs
      })
      .returning()
      .execute();

    const assetModel = result[0];

    // Log the activity
    await db.insert(activityLogTable)
      .values({
        activity_type: 'Asset Created',
        entity_type: 'AssetModel',
        entity_id: assetModel.id.toString(),
        user_id: userId,
        description: `Asset model created: ${input.manufacturer} ${input.model_number}`,
        metadata: JSON.stringify({
          manufacturer: input.manufacturer,
          model_number: input.model_number,
          category: input.category
        })
      })
      .execute();

    return assetModel;
  } catch (error) {
    console.error('Asset model creation failed:', error);
    throw error;
  }
};
