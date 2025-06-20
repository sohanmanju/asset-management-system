
import { db } from '../db';
import { assetModelsTable } from '../db/schema';
import { type AssetModel } from '../schema';

export const getAssetModels = async (): Promise<AssetModel[]> => {
  try {
    const results = await db.select()
      .from(assetModelsTable)
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to get asset models:', error);
    throw error;
  }
};
