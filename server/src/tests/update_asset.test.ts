
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, assetModelsTable, assetsTable, activityLogTable } from '../db/schema';
import { type UpdateAssetInput } from '../schema';
import { updateAsset } from '../handlers/update_asset';
import { eq } from 'drizzle-orm';

describe('updateAsset', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: string;
  let testModelId: number;
  let testAssetId: number;

  beforeEach(async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values({
        id: 'test-user-1',
        email: 'admin@test.com',
        name: 'Test Admin',
        role: 'Admin'
      })
      .returning()
      .execute();
    testUserId = users[0].id;

    // Create test asset model
    const models = await db.insert(assetModelsTable)
      .values({
        manufacturer: 'Dell',
        model_number: 'Latitude 5520',
        category: 'Laptops',
        specs: 'Intel i5, 8GB RAM, 256GB SSD'
      })
      .returning()
      .execute();
    testModelId = models[0].id;

    // Create test asset
    const assets = await db.insert(assetsTable)
      .values({
        asset_id: 'LAPTOP-001',
        model_id: testModelId,
        status: 'In Stock',
        location: 'Storage Room A',
        notes: 'Initial notes'
      })
      .returning()
      .execute();
    testAssetId = assets[0].id;
  });

  it('should update asset basic fields', async () => {
    const input: UpdateAssetInput = {
      id: testAssetId,
      asset_id: 'LAPTOP-001-UPDATED',
      status: 'Assigned',
      location: 'Office Floor 2',
      notes: 'Updated notes'
    };

    const result = await updateAsset(input, testUserId);

    expect(result.id).toEqual(testAssetId);
    expect(result.asset_id).toEqual('LAPTOP-001-UPDATED');
    expect(result.status).toEqual('Assigned');
    expect(result.location).toEqual('Office Floor 2');
    expect(result.notes).toEqual('Updated notes');
    expect(result.model_id).toEqual(testModelId);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update asset dates', async () => {
    const purchaseDate = new Date('2023-01-15');
    const warrantyExpiry = new Date('2025-01-15');

    const input: UpdateAssetInput = {
      id: testAssetId,
      purchase_date: purchaseDate,
      warranty_expiry: warrantyExpiry
    };

    const result = await updateAsset(input, testUserId);

    expect(result.purchase_date).toEqual(purchaseDate);
    expect(result.warranty_expiry).toEqual(warrantyExpiry);
  });

  it('should update asset model', async () => {
    // Create another asset model
    const newModels = await db.insert(assetModelsTable)
      .values({
        manufacturer: 'HP',
        model_number: 'EliteBook 840',
        category: 'Laptops',
        specs: 'Intel i7, 16GB RAM, 512GB SSD'
      })
      .returning()
      .execute();
    const newModelId = newModels[0].id;

    const input: UpdateAssetInput = {
      id: testAssetId,
      model_id: newModelId
    };

    const result = await updateAsset(input, testUserId);

    expect(result.model_id).toEqual(newModelId);
    expect(result.model.manufacturer).toEqual('HP');
    expect(result.model.model_number).toEqual('EliteBook 840');
  });

  it('should include all relations in response', async () => {
    const input: UpdateAssetInput = {
      id: testAssetId,
      notes: 'Updated with relations check'
    };

    const result = await updateAsset(input, testUserId);

    expect(result.model).toBeDefined();
    expect(result.model.manufacturer).toEqual('Dell');
    expect(result.assigned_user).toBeNull();
    expect(result.current_assignment).toBeNull();
    expect(result.maintenance_records).toEqual([]);
    expect(result.disposal).toBeNull();
  });

  it('should create activity log entry', async () => {
    const input: UpdateAssetInput = {
      id: testAssetId,
      status: 'Under Maintenance'
    };

    await updateAsset(input, testUserId);

    const activities = await db.select()
      .from(activityLogTable)
      .where(eq(activityLogTable.entity_id, testAssetId.toString()))
      .execute();

    expect(activities).toHaveLength(1);
    expect(activities[0].activity_type).toEqual('Asset Updated');
    expect(activities[0].entity_type).toEqual('asset');
    expect(activities[0].user_id).toEqual(testUserId);
    expect(activities[0].description).toMatch(/LAPTOP-001.*was updated/);
  });

  it('should throw error for non-existent asset', async () => {
    const input: UpdateAssetInput = {
      id: 99999,
      status: 'Assigned'
    };

    expect(updateAsset(input, testUserId)).rejects.toThrow(/Asset with ID 99999 not found/i);
  });

  it('should throw error for non-existent model', async () => {
    const input: UpdateAssetInput = {
      id: testAssetId,
      model_id: 99999
    };

    expect(updateAsset(input, testUserId)).rejects.toThrow(/Asset model with ID 99999 not found/i);
  });

  it('should throw error for duplicate asset_id', async () => {
    // Create another asset
    await db.insert(assetsTable)
      .values({
        asset_id: 'LAPTOP-002',
        model_id: testModelId,
        status: 'In Stock'
      })
      .execute();

    const input: UpdateAssetInput = {
      id: testAssetId,
      asset_id: 'LAPTOP-002'
    };

    expect(updateAsset(input, testUserId)).rejects.toThrow(/Asset ID LAPTOP-002 already exists/i);
  });

  it('should allow updating asset_id to same value', async () => {
    const input: UpdateAssetInput = {
      id: testAssetId,
      asset_id: 'LAPTOP-001', // Same as current
      notes: 'Same asset ID update'
    };

    const result = await updateAsset(input, testUserId);

    expect(result.asset_id).toEqual('LAPTOP-001');
    expect(result.notes).toEqual('Same asset ID update');
  });

  it('should update only provided fields', async () => {
    const input: UpdateAssetInput = {
      id: testAssetId,
      status: 'Under Maintenance'
    };

    const result = await updateAsset(input, testUserId);

    // Updated field
    expect(result.status).toEqual('Under Maintenance');
    
    // Unchanged fields
    expect(result.asset_id).toEqual('LAPTOP-001');
    expect(result.location).toEqual('Storage Room A');
    expect(result.notes).toEqual('Initial notes');
  });
});
