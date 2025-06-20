
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, assetModelsTable, assetsTable, assetAssignmentsTable, maintenanceRecordsTable } from '../db/schema';
import { type AssetSearchInput } from '../schema';
import { searchAssets } from '../handlers/search_assets';

describe('searchAssets', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Test data setup helper
  const setupTestData = async () => {
    // Create test user
    const user = await db.insert(usersTable)
      .values({
        id: 'user1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'User'
      })
      .returning()
      .execute();

    // Create test asset models
    const laptopModel = await db.insert(assetModelsTable)
      .values({
        manufacturer: 'Dell',
        model_number: 'Latitude 5520',
        category: 'Laptops',
        specs: 'Intel i7, 16GB RAM'
      })
      .returning()
      .execute();

    const monitorModel = await db.insert(assetModelsTable)
      .values({
        manufacturer: 'Samsung',
        model_number: 'U28E590D',
        category: 'Monitors',
        specs: '28" 4K UHD'
      })
      .returning()
      .execute();

    // Create test assets
    const laptopAsset = await db.insert(assetsTable)
      .values({
        asset_id: 'LAPTOP001',
        model_id: laptopModel[0].id,
        status: 'Assigned',
        assigned_to: user[0].id,
        location: 'Office A'
      })
      .returning()
      .execute();

    const monitorAsset = await db.insert(assetsTable)
      .values({
        asset_id: 'MONITOR001',
        model_id: monitorModel[0].id,
        status: 'In Stock',
        location: 'Storage Room'
      })
      .returning()
      .execute();

    // Create assignment record
    await db.insert(assetAssignmentsTable)
      .values({
        asset_id: laptopAsset[0].id,
        user_id: user[0].id,
        assigned_by: user[0].id,
        notes: 'Initial assignment'
      })
      .execute();

    // Create maintenance record
    await db.insert(maintenanceRecordsTable)
      .values({
        asset_id: laptopAsset[0].id,
        scheduled_date: new Date(),
        description: 'Regular maintenance',
        cost: '150.00',
        status: 'Completed'
      })
      .execute();

    return {
      user: user[0],
      laptopModel: laptopModel[0],
      monitorModel: monitorModel[0],
      laptopAsset: laptopAsset[0],
      monitorAsset: monitorAsset[0]
    };
  };

  it('should return all assets with default pagination', async () => {
    await setupTestData();

    const input: AssetSearchInput = {
      limit: 50,
      offset: 0
    };

    const result = await searchAssets(input);

    expect(result.assets).toHaveLength(2);
    expect(result.total).toBe(2);

    // Check structure includes relations
    const asset = result.assets[0];
    expect(asset.model).toBeDefined();
    expect(asset.model.manufacturer).toBeDefined();
    expect(asset.maintenance_records).toBeInstanceOf(Array);
  });

  it('should filter by category', async () => {
    await setupTestData();

    const input: AssetSearchInput = {
      category: 'Laptops',
      limit: 50,
      offset: 0
    };

    const result = await searchAssets(input);

    expect(result.assets).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.assets[0].model.category).toBe('Laptops');
  });

  it('should filter by status', async () => {
    await setupTestData();

    const input: AssetSearchInput = {
      status: 'In Stock',
      limit: 50,
      offset: 0
    };

    const result = await searchAssets(input);

    expect(result.assets).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.assets[0].status).toBe('In Stock');
  });

  it('should filter by manufacturer', async () => {
    await setupTestData();

    const input: AssetSearchInput = {
      manufacturer: 'Dell',
      limit: 50,
      offset: 0
    };

    const result = await searchAssets(input);

    expect(result.assets).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.assets[0].model.manufacturer).toBe('Dell');
  });

  it('should filter by assigned user', async () => {
    const testData = await setupTestData();

    const input: AssetSearchInput = {
      assigned_to: testData.user.id,
      limit: 50,
      offset: 0
    };

    const result = await searchAssets(input);

    expect(result.assets).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.assets[0].assigned_to).toBe(testData.user.id);
    expect(result.assets[0].assigned_user).toBeDefined();
    expect(result.assets[0].assigned_user!.name).toBe('Test User');
  });

  it('should search by asset ID', async () => {
    await setupTestData();

    const input: AssetSearchInput = {
      search: 'LAPTOP',
      limit: 50,
      offset: 0
    };

    const result = await searchAssets(input);

    expect(result.assets).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.assets[0].asset_id).toBe('LAPTOP001');
  });

  it('should handle pagination correctly', async () => {
    await setupTestData();

    const input: AssetSearchInput = {
      limit: 1,
      offset: 0
    };

    const result = await searchAssets(input);

    expect(result.assets).toHaveLength(1);
    expect(result.total).toBe(2);

    const input2: AssetSearchInput = {
      limit: 1,
      offset: 1
    };

    const result2 = await searchAssets(input2);

    expect(result2.assets).toHaveLength(1);
    expect(result2.total).toBe(2);
    expect(result2.assets[0].id).not.toBe(result.assets[0].id);
  });

  it('should include maintenance records with numeric cost conversion', async () => {
    await setupTestData();

    const input: AssetSearchInput = {
      category: 'Laptops',
      limit: 50,
      offset: 0
    };

    const result = await searchAssets(input);

    expect(result.assets).toHaveLength(1);
    const asset = result.assets[0];
    expect(asset.maintenance_records).toHaveLength(1);
    expect(asset.maintenance_records[0].cost).toBe(150);
    expect(typeof asset.maintenance_records[0].cost).toBe('number');
  });

  it('should handle multiple filters combined', async () => {
    await setupTestData();

    const input: AssetSearchInput = {
      category: 'Laptops',
      status: 'Assigned',
      manufacturer: 'Dell',
      limit: 50,
      offset: 0
    };

    const result = await searchAssets(input);

    expect(result.assets).toHaveLength(1);
    expect(result.total).toBe(1);
    const asset = result.assets[0];
    expect(asset.model.category).toBe('Laptops');
    expect(asset.status).toBe('Assigned');
    expect(asset.model.manufacturer).toBe('Dell');
  });

  it('should return empty results when no assets match', async () => {
    await setupTestData();

    const input: AssetSearchInput = {
      category: 'Keyboards',
      limit: 50,
      offset: 0
    };

    const result = await searchAssets(input);

    expect(result.assets).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});
