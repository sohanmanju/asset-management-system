
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { assetsTable, assetModelsTable, usersTable, activityLogTable } from '../db/schema';
import { type CreateAssetInput } from '../schema';
import { createAsset } from '../handlers/create_asset';
import { eq } from 'drizzle-orm';

describe('createAsset', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  const testUserId = 'test-user-123';
  let testModelId: number;

  beforeEach(async () => {
    // Create test user
    await db.insert(usersTable)
      .values({
        id: testUserId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'Admin'
      })
      .execute();

    // Create test asset model
    const modelResult = await db.insert(assetModelsTable)
      .values({
        manufacturer: 'Dell',
        model_number: 'XPS-13',
        category: 'Laptops',
        specs: 'Intel i7, 16GB RAM, 512GB SSD'
      })
      .returning()
      .execute();

    testModelId = modelResult[0].id;
  });

  const testInput: CreateAssetInput = {
    asset_id: 'LAPTOP-001',
    model_id: 0, // Will be set in beforeEach
    purchase_date: new Date('2023-01-15'),
    warranty_expiry: new Date('2026-01-15'),
    location: 'Office A',
    notes: 'Initial setup complete'
  };

  it('should create an asset successfully', async () => {
    const input = { ...testInput, model_id: testModelId };
    const result = await createAsset(input, testUserId);

    expect(result.asset_id).toEqual('LAPTOP-001');
    expect(result.model_id).toEqual(testModelId);
    expect(result.status).toEqual('In Stock');
    expect(result.assigned_to).toBeNull();
    expect(result.purchase_date).toEqual(new Date('2023-01-15'));
    expect(result.warranty_expiry).toEqual(new Date('2026-01-15'));
    expect(result.location).toEqual('Office A');
    expect(result.notes).toEqual('Initial setup complete');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);

    // Check relations
    expect(result.model).toBeDefined();
    expect(result.model.manufacturer).toEqual('Dell');
    expect(result.model.model_number).toEqual('XPS-13');
    expect(result.assigned_user).toBeNull();
    expect(result.current_assignment).toBeNull();
    expect(result.maintenance_records).toEqual([]);
    expect(result.disposal).toBeNull();
  });

  it('should save asset to database', async () => {
    const input = { ...testInput, model_id: testModelId };
    const result = await createAsset(input, testUserId);

    const assets = await db.select()
      .from(assetsTable)
      .where(eq(assetsTable.id, result.id))
      .execute();

    expect(assets).toHaveLength(1);
    expect(assets[0].asset_id).toEqual('LAPTOP-001');
    expect(assets[0].model_id).toEqual(testModelId);
    expect(assets[0].status).toEqual('In Stock');
    expect(assets[0].assigned_to).toBeNull();
  });

  it('should create activity log entry', async () => {
    const input = { ...testInput, model_id: testModelId };
    const result = await createAsset(input, testUserId);

    const activities = await db.select()
      .from(activityLogTable)
      .where(eq(activityLogTable.entity_id, result.id.toString()))
      .execute();

    expect(activities).toHaveLength(1);
    expect(activities[0].activity_type).toEqual('Asset Created');
    expect(activities[0].entity_type).toEqual('Asset');
    expect(activities[0].user_id).toEqual(testUserId);
    expect(activities[0].description).toEqual('Asset LAPTOP-001 created');
  });

  it('should handle nullable fields correctly', async () => {
    const input: CreateAssetInput = {
      asset_id: 'LAPTOP-002',
      model_id: testModelId,
      purchase_date: null,
      warranty_expiry: null,
      location: null,
      notes: null
    };

    const result = await createAsset(input, testUserId);

    expect(result.purchase_date).toBeNull();
    expect(result.warranty_expiry).toBeNull();
    expect(result.location).toBeNull();
    expect(result.notes).toBeNull();
  });

  it('should throw error for non-existent asset model', async () => {
    const input = { ...testInput, model_id: 99999 };

    await expect(createAsset(input, testUserId)).rejects.toThrow(/Asset model with id 99999 not found/);
  });

  it('should throw error for non-existent user', async () => {
    const input = { ...testInput, model_id: testModelId };

    await expect(createAsset(input, 'non-existent-user')).rejects.toThrow(/User with id non-existent-user not found/);
  });
});
