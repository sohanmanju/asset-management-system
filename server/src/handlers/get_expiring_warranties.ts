
import { db } from '../db';
import { assetsTable, assetModelsTable, usersTable, assetAssignmentsTable, maintenanceRecordsTable, assetDisposalsTable } from '../db/schema';
import { type AssetWithRelations } from '../schema';
import { lte, isNull, eq, and, desc } from 'drizzle-orm';
import { SQL } from 'drizzle-orm';

export const getExpiringWarranties = async (days: number = 30): Promise<AssetWithRelations[]> => {
  try {
    // Calculate the date threshold
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + days);

    // Build the query with joins
    const query = db.select({
      // Asset fields
      id: assetsTable.id,
      asset_id: assetsTable.asset_id,
      model_id: assetsTable.model_id,
      status: assetsTable.status,
      assigned_to: assetsTable.assigned_to,
      purchase_date: assetsTable.purchase_date,
      warranty_expiry: assetsTable.warranty_expiry,
      location: assetsTable.location,
      notes: assetsTable.notes,
      created_at: assetsTable.created_at,
      updated_at: assetsTable.updated_at,
      // Model fields
      model: {
        id: assetModelsTable.id,
        manufacturer: assetModelsTable.manufacturer,
        model_number: assetModelsTable.model_number,
        category: assetModelsTable.category,
        specs: assetModelsTable.specs,
        created_at: assetModelsTable.created_at,
        updated_at: assetModelsTable.updated_at
      },
      // Assigned user fields
      assigned_user: {
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        role: usersTable.role,
        created_at: usersTable.created_at,
        updated_at: usersTable.updated_at
      }
    })
    .from(assetsTable)
    .innerJoin(assetModelsTable, eq(assetsTable.model_id, assetModelsTable.id))
    .leftJoin(usersTable, eq(assetsTable.assigned_to, usersTable.id))
    .where(
      and(
        lte(assetsTable.warranty_expiry, thresholdDate),
        isNull(assetDisposalsTable.id) // Exclude disposed assets
      )
    )
    .leftJoin(assetDisposalsTable, eq(assetsTable.id, assetDisposalsTable.asset_id))
    .orderBy(assetsTable.warranty_expiry);

    const results = await query.execute();

    // For each asset, fetch its related data
    const assetsWithRelations: AssetWithRelations[] = await Promise.all(
      results.map(async (result) => {
        // Get current assignment
        const currentAssignments = await db.select()
          .from(assetAssignmentsTable)
          .where(
            and(
              eq(assetAssignmentsTable.asset_id, result.id),
              isNull(assetAssignmentsTable.unassigned_at)
            )
          )
          .orderBy(desc(assetAssignmentsTable.assigned_at))
          .limit(1)
          .execute();

        // Get maintenance records
        const maintenanceRecords = await db.select()
          .from(maintenanceRecordsTable)
          .where(eq(maintenanceRecordsTable.asset_id, result.id))
          .orderBy(desc(maintenanceRecordsTable.scheduled_date))
          .execute();

        // Get disposal record
        const disposalRecords = await db.select()
          .from(assetDisposalsTable)
          .where(eq(assetDisposalsTable.asset_id, result.id))
          .limit(1)
          .execute();

        return {
          id: result.id,
          asset_id: result.asset_id,
          model_id: result.model_id,
          status: result.status,
          assigned_to: result.assigned_to,
          purchase_date: result.purchase_date,
          warranty_expiry: result.warranty_expiry,
          location: result.location,
          notes: result.notes,
          created_at: result.created_at,
          updated_at: result.updated_at,
          model: result.model,
          assigned_user: result.assigned_user,
          current_assignment: currentAssignments[0] || null,
          maintenance_records: maintenanceRecords.map(record => ({
            ...record,
            cost: record.cost ? parseFloat(record.cost) : null
          })),
          disposal: disposalRecords[0] ? {
            ...disposalRecords[0],
            cost: disposalRecords[0].cost ? parseFloat(disposalRecords[0].cost) : null
          } : null
        };
      })
    );

    return assetsWithRelations;
  } catch (error) {
    console.error('Get expiring warranties failed:', error);
    throw error;
  }
};
