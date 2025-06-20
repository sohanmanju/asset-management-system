
import { db } from '../db';
import { assetsTable, assetAssignmentsTable, usersTable } from '../db/schema';
import { type AssignAssetInput, type AssetAssignment } from '../schema';
import { eq, isNull } from 'drizzle-orm';

export const assignAsset = async (input: AssignAssetInput, assignedBy: string): Promise<AssetAssignment> => {
  try {
    // Verify the asset exists and is available for assignment
    const asset = await db.select()
      .from(assetsTable)
      .where(eq(assetsTable.id, input.asset_id))
      .execute();

    if (asset.length === 0) {
      throw new Error('Asset not found');
    }

    if (asset[0].status !== 'In Stock') {
      throw new Error('Asset is not available for assignment');
    }

    // Verify the user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    // Verify the assigning user exists
    const assigningUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, assignedBy))
      .execute();

    if (assigningUser.length === 0) {
      throw new Error('Assigning user not found');
    }

    // Check if there's already an active assignment for this asset
    const existingAssignment = await db.select()
      .from(assetAssignmentsTable)
      .where(
        eq(assetAssignmentsTable.asset_id, input.asset_id)
      )
      .execute();

    const activeAssignment = existingAssignment.find(assignment => assignment.unassigned_at === null);
    if (activeAssignment) {
      throw new Error('Asset is already assigned to another user');
    }

    // Create the assignment record
    const assignmentResult = await db.insert(assetAssignmentsTable)
      .values({
        asset_id: input.asset_id,
        user_id: input.user_id,
        assigned_by: assignedBy,
        notes: input.notes
      })
      .returning()
      .execute();

    // Update the asset status and assigned_to field
    await db.update(assetsTable)
      .set({
        status: 'Assigned',
        assigned_to: input.user_id,
        updated_at: new Date()
      })
      .where(eq(assetsTable.id, input.asset_id))
      .execute();

    return assignmentResult[0];
  } catch (error) {
    console.error('Asset assignment failed:', error);
    throw error;
  }
};
