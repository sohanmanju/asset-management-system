
import { db } from '../db';
import { assetsTable, activityLogTable } from '../db/schema';
import { eq } from 'drizzle-orm';

export async function retireAsset(assetId: number, userId: string): Promise<void> {
  try {
    // First, check if the asset exists and get its current status
    const existingAsset = await db.select()
      .from(assetsTable)
      .where(eq(assetsTable.id, assetId))
      .execute();

    if (existingAsset.length === 0) {
      throw new Error('Asset not found');
    }

    const asset = existingAsset[0];

    // Check if asset is already retired
    if (asset.status === 'Retired') {
      throw new Error('Asset is already retired');
    }

    // Update asset status to 'Retired' and clear assignment
    await db.update(assetsTable)
      .set({
        status: 'Retired',
        assigned_to: null,
        updated_at: new Date()
      })
      .where(eq(assetsTable.id, assetId))
      .execute();

    // Log the retirement activity
    await db.insert(activityLogTable)
      .values({
        activity_type: 'Asset Retired',
        entity_type: 'asset',
        entity_id: assetId.toString(),
        user_id: userId,
        description: `Asset ${asset.asset_id} has been retired`,
        metadata: {
          previous_status: asset.status,
          previous_assigned_to: asset.assigned_to
        }
      })
      .execute();
  } catch (error) {
    console.error('Asset retirement failed:', error);
    throw error;
  }
}
