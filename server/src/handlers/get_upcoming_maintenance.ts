
import { db } from '../db';
import { maintenanceRecordsTable } from '../db/schema';
import { type MaintenanceRecord } from '../schema';
import { and, gte, lte, eq } from 'drizzle-orm';

export const getUpcomingMaintenance = async (days: number = 30): Promise<MaintenanceRecord[]> => {
  try {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + days);

    const results = await db.select()
      .from(maintenanceRecordsTable)
      .where(
        and(
          eq(maintenanceRecordsTable.status, 'Scheduled'),
          gte(maintenanceRecordsTable.scheduled_date, today),
          lte(maintenanceRecordsTable.scheduled_date, futureDate)
        )
      )
      .execute();

    return results.map(record => ({
      ...record,
      cost: record.cost ? parseFloat(record.cost) : null
    }));
  } catch (error) {
    console.error('Failed to get upcoming maintenance:', error);
    throw error;
  }
};
