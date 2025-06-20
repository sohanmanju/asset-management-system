
import { db } from '../db';
import { assetDisposalsTable, assetsTable } from '../db/schema';
import { type DisposeAssetInput, type AssetDisposal } from '../schema';
import { eq } from 'drizzle-orm';

export const disposeAsset = async (input: DisposeAssetInput, disposedBy: string): Promise<AssetDisposal> => {
  try {
    // Verify asset exists
    const asset = await db.select()
      .from(assetsTable)
      .where(eq(assetsTable.id, input.asset_id))
      .execute();

    if (asset.length === 0) {
      throw new Error('Asset not found');
    }

    // Update asset status to 'Retired' and unassign if needed
    await db.update(assetsTable)
      .set({
        status: 'Retired',
        assigned_to: null,
        updated_at: new Date()
      })
      .where(eq(assetsTable.id, input.asset_id))
      .execute();

    // Create disposal record
    const result = await db.insert(assetDisposalsTable)
      .values({
        asset_id: input.asset_id,
        disposal_date: input.disposal_date,
        disposal_method: input.disposal_method,
        cost: input.cost ? input.cost.toString() : null, // Convert number to string for numeric column
        disposed_by: disposedBy,
        notes: input.notes
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const disposal = result[0];
    return {
      ...disposal,
      cost: disposal.cost ? parseFloat(disposal.cost) : null // Convert string back to number
    };
  } catch (error) {
    console.error('Asset disposal failed:', error);
    throw error;
  }
};
