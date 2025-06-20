
import { db } from '../db';
import { maintenanceRecordsTable, activityLogTable } from '../db/schema';
import { type UpdateMaintenanceRecordInput, type MaintenanceRecord } from '../schema';
import { eq } from 'drizzle-orm';

export const updateMaintenanceRecord = async (input: UpdateMaintenanceRecordInput, userId: string): Promise<MaintenanceRecord> => {
  try {
    // Update the maintenance record
    const result = await db.update(maintenanceRecordsTable)
      .set({
        completed_date: input.completed_date,
        performed_by: input.performed_by,
        cost: input.cost ? input.cost.toString() : null, // Convert number to string for numeric column
        status: input.status,
        notes: input.notes,
        updated_at: new Date()
      })
      .where(eq(maintenanceRecordsTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('Maintenance record not found');
    }

    const maintenanceRecord = result[0];

    // Log the activity
    await db.insert(activityLogTable)
      .values({
        activity_type: 'Maintenance Completed',
        entity_type: 'maintenance_record',
        entity_id: maintenanceRecord.id.toString(),
        user_id: userId,
        description: `Maintenance record updated for asset ID ${maintenanceRecord.asset_id}`,
        metadata: JSON.stringify({
          status: input.status,
          cost: input.cost,
          performed_by: input.performed_by
        })
      })
      .execute();

    // Convert numeric fields back to numbers before returning
    return {
      ...maintenanceRecord,
      cost: maintenanceRecord.cost ? parseFloat(maintenanceRecord.cost) : null
    };
  } catch (error) {
    console.error('Maintenance record update failed:', error);
    throw error;
  }
};
