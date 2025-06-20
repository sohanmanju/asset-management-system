
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, assetModelsTable, assetsTable, assetDisposalsTable } from '../db/schema';
import { type DisposeAssetInput } from '../schema';
import { disposeAsset } from '../handlers/dispose_asset';
import { eq } from 'drizzle-orm';

describe('disposeAsset', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should dispose an asset and create disposal record', async () => {
    // Create test user
    await db.insert(usersTable).values({
      id: 'user1',
      email: 'admin@test.com',
      name: 'Admin User',
      role: 'Admin'
    }).execute();

    // Create test asset model
    const modelResult = await db.insert(assetModelsTable).values({
      manufacturer: 'Dell',
      model_number: 'OptiPlex 7090',
      category: 'Laptops',
      specs: 'Intel i7, 16GB RAM'
    }).returning().execute();

    // Create test asset
    const assetResult = await db.insert(assetsTable).values({
      asset_id: 'ASSET001',
      model_id: modelResult[0].id,
      status: 'In Stock',
      location: 'Office A'
    }).returning().execute();

    const testInput: DisposeAssetInput = {
      asset_id: assetResult[0].id,
      disposal_date: new Date('2024-01-15'),
      disposal_method: 'Recycling',
      cost: 25.50,
      notes: 'End of life disposal'
    };

    const result = await disposeAsset(testInput, 'user1');

    // Verify disposal record fields
    expect(result.asset_id).toEqual(assetResult[0].id);
    expect(result.disposal_date).toEqual(new Date('2024-01-15'));
    expect(result.disposal_method).toEqual('Recycling');
    expect(result.cost).toEqual(25.50);
    expect(typeof result.cost).toBe('number');
    expect(result.disposed_by).toEqual('user1');
    expect(result.notes).toEqual('End of life disposal');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should update asset status to Retired', async () => {
    // Create test user
    await db.insert(usersTable).values({
      id: 'user1',
      email: 'admin@test.com',
      name: 'Admin User',
      role: 'Admin'
    }).execute();

    // Create test asset model
    const modelResult = await db.insert(assetModelsTable).values({
      manufacturer: 'Dell',
      model_number: 'OptiPlex 7090',
      category: 'Laptops',
      specs: 'Intel i7, 16GB RAM'
    }).returning().execute();

    // Create test asset
    const assetResult = await db.insert(assetsTable).values({
      asset_id: 'ASSET001',
      model_id: modelResult[0].id,
      status: 'In Stock',
      location: 'Office A'
    }).returning().execute();

    const testInput: DisposeAssetInput = {
      asset_id: assetResult[0].id,
      disposal_date: new Date('2024-01-15'),
      disposal_method: 'Recycling',
      cost: null,
      notes: null
    };

    await disposeAsset(testInput, 'user1');

    // Verify asset status updated
    const updatedAsset = await db.select()
      .from(assetsTable)
      .where(eq(assetsTable.id, assetResult[0].id))
      .execute();

    expect(updatedAsset[0].status).toEqual('Retired');
    expect(updatedAsset[0].assigned_to).toBeNull();
  });

  it('should unassign asset if currently assigned', async () => {
    // Create test users
    await db.insert(usersTable).values([
      {
        id: 'admin1',
        email: 'admin@test.com',
        name: 'Admin User',
        role: 'Admin'
      },
      {
        id: 'user1',
        email: 'user@test.com',
        name: 'Test User',
        role: 'User'
      }
    ]).execute();

    // Create test asset model
    const modelResult = await db.insert(assetModelsTable).values({
      manufacturer: 'Dell',
      model_number: 'OptiPlex 7090',
      category: 'Laptops',
      specs: 'Intel i7, 16GB RAM'
    }).returning().execute();

    // Create assigned asset
    const assetResult = await db.insert(assetsTable).values({
      asset_id: 'ASSET001',
      model_id: modelResult[0].id,
      status: 'Assigned',
      assigned_to: 'user1',
      location: 'Office A'
    }).returning().execute();

    const testInput: DisposeAssetInput = {
      asset_id: assetResult[0].id,
      disposal_date: new Date('2024-01-15'),
      disposal_method: 'Recycling',
      cost: null,
      notes: null
    };

    await disposeAsset(testInput, 'admin1');

    // Verify asset is unassigned and retired
    const updatedAsset = await db.select()
      .from(assetsTable)
      .where(eq(assetsTable.id, assetResult[0].id))
      .execute();

    expect(updatedAsset[0].status).toEqual('Retired');
    expect(updatedAsset[0].assigned_to).toBeNull();
  });

  it('should handle disposal without cost', async () => {
    // Create test user
    await db.insert(usersTable).values({
      id: 'user1',
      email: 'admin@test.com',
      name: 'Admin User',
      role: 'Admin'
    }).execute();

    // Create test asset model
    const modelResult = await db.insert(assetModelsTable).values({
      manufacturer: 'Dell',
      model_number: 'OptiPlex 7090',
      category: 'Laptops',
      specs: 'Intel i7, 16GB RAM'
    }).returning().execute();

    // Create test asset
    const assetResult = await db.insert(assetsTable).values({
      asset_id: 'ASSET001',
      model_id: modelResult[0].id,
      status: 'In Stock',
      location: 'Office A'
    }).returning().execute();

    const testInput: DisposeAssetInput = {
      asset_id: assetResult[0].id,
      disposal_date: new Date('2024-01-15'),
      disposal_method: 'Donation',
      cost: null,
      notes: null
    };

    const result = await disposeAsset(testInput, 'user1');

    expect(result.cost).toBeNull();
    expect(result.disposal_method).toEqual('Donation');
  });

  it('should save disposal record to database', async () => {
    // Create test user
    await db.insert(usersTable).values({
      id: 'user1',
      email: 'admin@test.com',
      name: 'Admin User',
      role: 'Admin'
    }).execute();

    // Create test asset model
    const modelResult = await db.insert(assetModelsTable).values({
      manufacturer: 'Dell',
      model_number: 'OptiPlex 7090',
      category: 'Laptops',
      specs: 'Intel i7, 16GB RAM'
    }).returning().execute();

    // Create test asset
    const assetResult = await db.insert(assetsTable).values({
      asset_id: 'ASSET001',
      model_id: modelResult[0].id,
      status: 'In Stock',
      location: 'Office A'
    }).returning().execute();

    const testInput: DisposeAssetInput = {
      asset_id: assetResult[0].id,
      disposal_date: new Date('2024-01-15'),
      disposal_method: 'Recycling',
      cost: 35.75,
      notes: 'Proper disposal'
    };

    const result = await disposeAsset(testInput, 'user1');

    // Verify record exists in database
    const disposalRecords = await db.select()
      .from(assetDisposalsTable)
      .where(eq(assetDisposalsTable.id, result.id))
      .execute();

    expect(disposalRecords).toHaveLength(1);
    expect(disposalRecords[0].asset_id).toEqual(assetResult[0].id);
    expect(disposalRecords[0].disposal_method).toEqual('Recycling');
    expect(parseFloat(disposalRecords[0].cost!)).toEqual(35.75);
    expect(disposalRecords[0].disposed_by).toEqual('user1');
    expect(disposalRecords[0].notes).toEqual('Proper disposal');
  });

  it('should throw error for non-existent asset', async () => {
    const testInput: DisposeAssetInput = {
      asset_id: 999,
      disposal_date: new Date('2024-01-15'),
      disposal_method: 'Recycling',
      cost: null,
      notes: null
    };

    await expect(disposeAsset(testInput, 'user1')).rejects.toThrow(/asset not found/i);
  });
});
