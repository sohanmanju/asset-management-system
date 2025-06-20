
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, assetModelsTable, assetsTable, maintenanceRecordsTable, activityLogTable } from '../db/schema';
import { type UpdateMaintenanceRecordInput } from '../schema';
import { updateMaintenanceRecord } from '../handlers/update_maintenance_record';
import { eq } from 'drizzle-orm';

describe('updateMaintenanceRecord', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update a maintenance record', async () => {
    // Create prerequisite data
    const user = await db.insert(usersTable)
      .values({
        id: 'user1',
        email: 'user@example.com',
        name: 'Test User',
        role: 'Admin'
      })
      .returning()
      .execute();

    const performer = await db.insert(usersTable)
      .values({
        id: 'performer1',
        email: 'performer@example.com',
        name: 'Maintenance Performer',
        role: 'User'
      })
      .returning()
      .execute();

    const assetModel = await db.insert(assetModelsTable)
      .values({
        manufacturer: 'Dell',
        model_number: 'XPS-13',
        category: 'Laptops',
        specs: 'Intel i7, 16GB RAM'
      })
      .returning()
      .execute();

    const asset = await db.insert(assetsTable)
      .values({
        asset_id: 'ASSET-001',
        model_id: assetModel[0].id,
        status: 'Under Maintenance'
      })
      .returning()
      .execute();

    const maintenanceRecord = await db.insert(maintenanceRecordsTable)
      .values({
        asset_id: asset[0].id,
        scheduled_date: new Date('2024-01-15'),
        description: 'Screen replacement',
        status: 'In Progress'
      })
      .returning()
      .execute();

    const testInput: UpdateMaintenanceRecordInput = {
      id: maintenanceRecord[0].id,
      completed_date: new Date('2024-01-16'),
      performed_by: performer[0].id,
      cost: 299.99,
      status: 'Completed',
      notes: 'Screen successfully replaced'
    };

    const result = await updateMaintenanceRecord(testInput, user[0].id);

    // Basic field validation
    expect(result.id).toEqual(maintenanceRecord[0].id);
    expect(result.completed_date).toEqual(new Date('2024-01-16'));
    expect(result.performed_by).toEqual('performer1');
    expect(result.cost).toEqual(299.99);
    expect(typeof result.cost).toEqual('number');
    expect(result.status).toEqual('Completed');
    expect(result.notes).toEqual('Screen successfully replaced');
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save updated maintenance record to database', async () => {
    // Create prerequisite data
    const user = await db.insert(usersTable)
      .values({
        id: 'user1',
        email: 'user@example.com',
        name: 'Test User',
        role: 'Admin'
      })
      .returning()
      .execute();

    const assetModel = await db.insert(assetModelsTable)
      .values({
        manufacturer: 'HP',
        model_number: 'Pavilion',
        category: 'Laptops',
        specs: 'AMD Ryzen 5, 8GB RAM'
      })
      .returning()
      .execute();

    const asset = await db.insert(assetsTable)
      .values({
        asset_id: 'ASSET-002',
        model_id: assetModel[0].id,
        status: 'Under Maintenance'
      })
      .returning()
      .execute();

    const maintenanceRecord = await db.insert(maintenanceRecordsTable)
      .values({
        asset_id: asset[0].id,
        scheduled_date: new Date('2024-01-20'),
        description: 'Battery replacement',
        status: 'Scheduled'
      })
      .returning()
      .execute();

    const testInput: UpdateMaintenanceRecordInput = {
      id: maintenanceRecord[0].id,
      completed_date: new Date('2024-01-21'),
      performed_by: user[0].id,
      cost: 150.00,
      status: 'Completed',
      notes: 'Battery replaced successfully'
    };

    const result = await updateMaintenanceRecord(testInput, user[0].id);

    // Query database to verify changes
    const updatedRecords = await db.select()
      .from(maintenanceRecordsTable)
      .where(eq(maintenanceRecordsTable.id, result.id))
      .execute();

    expect(updatedRecords).toHaveLength(1);
    const updatedRecord = updatedRecords[0];
    expect(updatedRecord.completed_date).toEqual(new Date('2024-01-21'));
    expect(updatedRecord.performed_by).toEqual(user[0].id);
    expect(parseFloat(updatedRecord.cost!)).toEqual(150.00);
    expect(updatedRecord.status).toEqual('Completed');
    expect(updatedRecord.notes).toEqual('Battery replaced successfully');
  });

  it('should create activity log entry', async () => {
    // Create prerequisite data
    const user = await db.insert(usersTable)
      .values({
        id: 'user1',
        email: 'user@example.com',
        name: 'Test User',
        role: 'Admin'
      })
      .returning()
      .execute();

    const assetModel = await db.insert(assetModelsTable)
      .values({
        manufacturer: 'Apple',
        model_number: 'MacBook Pro',
        category: 'Laptops',
        specs: 'M2 chip, 16GB RAM'
      })
      .returning()
      .execute();

    const asset = await db.insert(assetsTable)
      .values({
        asset_id: 'ASSET-003',
        model_id: assetModel[0].id,
        status: 'Under Maintenance'
      })
      .returning()
      .execute();

    const maintenanceRecord = await db.insert(maintenanceRecordsTable)
      .values({
        asset_id: asset[0].id,
        scheduled_date: new Date('2024-02-01'),
        description: 'Keyboard cleaning',
        status: 'Scheduled'
      })
      .returning()
      .execute();

    const testInput: UpdateMaintenanceRecordInput = {
      id: maintenanceRecord[0].id,
      completed_date: new Date('2024-02-01'),
      performed_by: user[0].id,
      cost: 25.00,
      status: 'Completed',
      notes: 'Keyboard cleaned and sanitized'
    };

    await updateMaintenanceRecord(testInput, user[0].id);

    // Verify activity log entry was created
    const activityLogs = await db.select()
      .from(activityLogTable)
      .where(eq(activityLogTable.entity_id, maintenanceRecord[0].id.toString()))
      .execute();

    expect(activityLogs).toHaveLength(1);
    const activityLog = activityLogs[0];
    expect(activityLog.activity_type).toEqual('Maintenance Completed');
    expect(activityLog.entity_type).toEqual('maintenance_record');
    expect(activityLog.user_id).toEqual(user[0].id);
    expect(activityLog.description).toEqual(`Maintenance record updated for asset ID ${asset[0].id}`);
    expect(activityLog.created_at).toBeInstanceOf(Date);
  });

  it('should handle null cost values', async () => {
    // Create prerequisite data
    const user = await db.insert(usersTable)
      .values({
        id: 'user1',
        email: 'user@example.com',
        name: 'Test User',
        role: 'Admin'
      })
      .returning()
      .execute();

    const assetModel = await db.insert(assetModelsTable)
      .values({
        manufacturer: 'Lenovo',
        model_number: 'ThinkPad',
        category: 'Laptops',
        specs: 'Intel i5, 8GB RAM'
      })
      .returning()
      .execute();

    const asset = await db.insert(assetsTable)
      .values({
        asset_id: 'ASSET-004',
        model_id: assetModel[0].id,
        status: 'Under Maintenance'
      })
      .returning()
      .execute();

    const maintenanceRecord = await db.insert(maintenanceRecordsTable)
      .values({
        asset_id: asset[0].id,
        scheduled_date: new Date('2024-02-10'),
        description: 'Software update',
        status: 'In Progress'
      })
      .returning()
      .execute();

    const testInput: UpdateMaintenanceRecordInput = {
      id: maintenanceRecord[0].id,
      completed_date: new Date('2024-02-10'),
      performed_by: user[0].id,
      cost: null,
      status: 'Completed',
      notes: 'Software updated to latest version'
    };

    const result = await updateMaintenanceRecord(testInput, user[0].id);

    expect(result.cost).toBeNull();
  });

  it('should throw error for non-existent maintenance record', async () => {
    const testInput: UpdateMaintenanceRecordInput = {
      id: 999999,
      completed_date: new Date('2024-01-01'),
      performed_by: 'user1',
      cost: 100.00,
      status: 'Completed',
      notes: 'Test notes'
    };

    await expect(updateMaintenanceRecord(testInput, 'user1')).rejects.toThrow(/not found/i);
  });
});
