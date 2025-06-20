
import { db } from '../db';
import { assetsTable, assetAssignmentsTable } from '../db/schema';
import { type UnassignAssetInput } from '../schema';
import { eq, isNull, and } from 'drizzle-orm';

export const unassignAsset = async (input: UnassignAssetInput, userId: string): Promise<void> => {
  try {
    // Check if asset exists and is currently assigned
    const asset = await db.select()
      .from(assetsTable)
      .where(eq(assetsTable.id, input.asset_id))
      .execute();

    if (asset.length === 0) {
      throw new Error('Asset not found');
    }

    if (asset[0].status !== 'Assigned' || !asset[0].assigned_to) {
      throw new Error('Asset is not currently assigned');
    }

    // Find the current active assignment
    const currentAssignment = await db.select()
      .from(assetAssignmentsTable)
      .where(
        and(
          eq(assetAssignmentsTable.asset_id, input.asset_id),
          isNull(assetAssignmentsTable.unassigned_at)
        )
      )
      .execute();

    if (currentAssignment.length === 0) {
      throw new Error('No active assignment found for this asset');
    }

    const now = new Date();

    // Update the assignment record to mark it as unassigned
    await db.update(assetAssignmentsTable)
      .set({
        unassigned_at: now,
        notes: input.notes || currentAssignment[0].notes
      })
      .where(eq(assetAssignmentsTable.id, currentAssignment[0].id))
      .execute();

    // Update the asset status and clear assigned_to
    await db.update(assetsTable)
      .set({
        status: 'In Stock',
        assigned_to: null,
        updated_at: now
      })
      .where(eq(assetsTable.id, input.asset_id))
      .execute();
  } catch (error) {
    console.error('Asset unassignment failed:', error);
    throw error;
  }
};
