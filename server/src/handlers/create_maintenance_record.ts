
import { db } from '../db';
import { maintenanceRecordsTable, activityLogTable, assetsTable } from '../db/schema';
import { type CreateMaintenanceRecordInput, type MaintenanceRecord } from '../schema';
import { eq } from 'drizzle-orm';

export const createMaintenanceRecord = async (input: CreateMaintenanceRecordInput, userId: string): Promise<MaintenanceRecord> => {
  try {
    // Verify that the asset exists
    const asset = await db.select()
      .from(assetsTable)
      .where(eq(assetsTable.id, input.asset_id))
      .execute();

    if (asset.length === 0) {
      throw new Error(`Asset with id ${input.asset_id} not found`);
    }

    // Insert maintenance record
    const result = await db.insert(maintenanceRecordsTable)
      .values({
        asset_id: input.asset_id,
        scheduled_date: input.scheduled_date,
        description: input.description,
        notes: input.notes
      })
      .returning()
      .execute();

    const maintenanceRecord = result[0];

    // Log the activity
    await db.insert(activityLogTable)
      .values({
        activity_type: 'Maintenance Scheduled',
        entity_type: 'MaintenanceRecord',
        entity_id: maintenanceRecord.id.toString(),
        user_id: userId,
        description: `Maintenance scheduled for asset ${asset[0].asset_id}: ${input.description}`,
        metadata: JSON.stringify({
          asset_id: input.asset_id,
          scheduled_date: input.scheduled_date.toISOString(),
          maintenance_record_id: maintenanceRecord.id
        })
      })
      .execute();

    // Convert numeric fields back to numbers before returning
    return {
      ...maintenanceRecord,
      cost: maintenanceRecord.cost ? parseFloat(maintenanceRecord.cost) : null
    };
  } catch (error) {
    console.error('Maintenance record creation failed:', error);
    throw error;
  }
};
