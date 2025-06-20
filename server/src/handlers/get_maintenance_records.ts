
import { db } from '../db';
import { maintenanceRecordsTable } from '../db/schema';
import { type MaintenanceRecord } from '../schema';
import { eq } from 'drizzle-orm';

export const getMaintenanceRecords = async (assetId?: number): Promise<MaintenanceRecord[]> => {
  try {
    const results = assetId !== undefined
      ? await db.select().from(maintenanceRecordsTable).where(eq(maintenanceRecordsTable.asset_id, assetId)).execute()
      : await db.select().from(maintenanceRecordsTable).execute();

    return results.map(record => ({
      ...record,
      cost: record.cost ? parseFloat(record.cost) : null
    }));
  } catch (error) {
    console.error('Failed to get maintenance records:', error);
    throw error;
  }
};
