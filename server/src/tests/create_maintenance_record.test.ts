
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { maintenanceRecordsTable, activityLogTable, usersTable, assetModelsTable, assetsTable } from '../db/schema';
import { type CreateMaintenanceRecordInput } from '../schema';
import { createMaintenanceRecord } from '../handlers/create_maintenance_record';
import { eq } from 'drizzle-orm';

// Test data
const testUser = {
  id: 'user123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'Admin' as const
};

const testAssetModel = {
  manufacturer: 'Dell',
  model_number: 'Latitude 5520',
  category: 'Laptops' as const,
  specs: 'Intel i7, 16GB RAM'
};

const testAsset = {
  asset_id: 'LAPTOP001',
  model_id: 1, // Will be set after model creation
  purchase_date: new Date('2023-01-15'),
  warranty_expiry: new Date('2026-01-15'),
  location: 'Office A',
  notes: 'Initial asset'
};

const testInput: CreateMaintenanceRecordInput = {
  asset_id: 1, // Will be set after asset creation
  scheduled_date: new Date('2024-02-15'),
  description: 'Routine hardware check and cleaning',
  notes: 'Check fans, clean keyboard, update drivers'
};

describe('createMaintenanceRecord', () => {
  beforeEach(async () => {
    await createDB();
    
    // Create prerequisite data
    await db.insert(usersTable).values(testUser).execute();
    
    const modelResult = await db.insert(assetModelsTable)
      .values(testAssetModel)
      .returning()
      .execute();
    
    const assetResult = await db.insert(assetsTable)
      .values({
        ...testAsset,
        model_id: modelResult[0].id
      })
      .returning()
      .execute();
    
    // Update test input with actual asset ID
    testInput.asset_id = assetResult[0].id;
  });

  afterEach(resetDB);

  it('should create a maintenance record', async () => {
    const result = await createMaintenanceRecord(testInput, testUser.id);

    // Basic field validation
    expect(result.asset_id).toEqual(testInput.asset_id);
    expect(result.scheduled_date).toEqual(testInput.scheduled_date);
    expect(result.description).toEqual('Routine hardware check and cleaning');
    expect(result.notes).toEqual(testInput.notes);
    expect(result.status).toEqual('Scheduled');
    expect(result.completed_date).toBeNull();
    expect(result.performed_by).toBeNull();
    expect(result.cost).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save maintenance record to database', async () => {
    const result = await createMaintenanceRecord(testInput, testUser.id);

    const records = await db.select()
      .from(maintenanceRecordsTable)
      .where(eq(maintenanceRecordsTable.id, result.id))
      .execute();

    expect(records).toHaveLength(1);
    expect(records[0].asset_id).toEqual(testInput.asset_id);
    expect(records[0].scheduled_date).toEqual(testInput.scheduled_date);
    expect(records[0].description).toEqual('Routine hardware check and cleaning');
    expect(records[0].notes).toEqual(testInput.notes);
    expect(records[0].status).toEqual('Scheduled');
    expect(records[0].created_at).toBeInstanceOf(Date);
  });

  it('should log maintenance scheduled activity', async () => {
    const result = await createMaintenanceRecord(testInput, testUser.id);

    const activities = await db.select()
      .from(activityLogTable)
      .where(eq(activityLogTable.entity_id, result.id.toString()))
      .execute();

    expect(activities).toHaveLength(1);
    expect(activities[0].activity_type).toEqual('Maintenance Scheduled');
    expect(activities[0].entity_type).toEqual('MaintenanceRecord');
    expect(activities[0].entity_id).toEqual(result.id.toString());
    expect(activities[0].user_id).toEqual(testUser.id);
    expect(activities[0].description).toContain('Maintenance scheduled for asset LAPTOP001');
    expect(activities[0].description).toContain('Routine hardware check and cleaning');
    expect(activities[0].metadata).toBeDefined();
    expect(activities[0].created_at).toBeInstanceOf(Date);
  });

  it('should throw error for non-existent asset', async () => {
    const invalidInput = {
      ...testInput,
      asset_id: 99999
    };

    await expect(createMaintenanceRecord(invalidInput, testUser.id))
      .rejects.toThrow(/Asset with id 99999 not found/i);
  });

  it('should handle maintenance record with minimal data', async () => {
    const minimalInput: CreateMaintenanceRecordInput = {
      asset_id: testInput.asset_id,
      scheduled_date: new Date('2024-03-01'),
      description: 'Quick check',
      notes: null
    };

    const result = await createMaintenanceRecord(minimalInput, testUser.id);

    expect(result.asset_id).toEqual(minimalInput.asset_id);
    expect(result.scheduled_date).toEqual(minimalInput.scheduled_date);
    expect(result.description).toEqual('Quick check');
    expect(result.notes).toBeNull();
    expect(result.status).toEqual('Scheduled');
    expect(result.id).toBeDefined();
  });

  it('should handle future scheduled dates correctly', async () => {
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 6);

    const futureInput: CreateMaintenanceRecordInput = {
      asset_id: testInput.asset_id,
      scheduled_date: futureDate,
      description: 'Future maintenance',
      notes: 'Scheduled for next quarter'
    };

    const result = await createMaintenanceRecord(futureInput, testUser.id);

    expect(result.scheduled_date).toEqual(futureDate);
    expect(result.description).toEqual('Future maintenance');
    expect(result.status).toEqual('Scheduled');
  });
});
