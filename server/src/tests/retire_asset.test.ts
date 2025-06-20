
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, assetModelsTable, assetsTable, activityLogTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { retireAsset } from '../handlers/retire_asset';

describe('retireAsset', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  const testUserId = 'user-123';
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
        specs: 'Test specs'
      })
      .returning()
      .execute();

    testModelId = modelResult[0].id;
  });

  it('should retire an asset successfully', async () => {
    // Create test asset for this specific test
    const assetResult = await db.insert(assetsTable)
      .values({
        asset_id: 'TEST-001',
        model_id: testModelId,
        status: 'In Stock',
        location: 'Office A'
      })
      .returning()
      .execute();

    const testAssetId = assetResult[0].id;

    await retireAsset(testAssetId, testUserId);

    // Verify asset status is updated
    const updatedAsset = await db.select()
      .from(assetsTable)
      .where(eq(assetsTable.id, testAssetId))
      .execute();

    expect(updatedAsset).toHaveLength(1);
    expect(updatedAsset[0].status).toEqual('Retired');
    expect(updatedAsset[0].assigned_to).toBeNull();
    expect(updatedAsset[0].updated_at).toBeInstanceOf(Date);
  });

  it('should clear assignment when retiring assigned asset', async () => {
    // Create test asset for this specific test
    const assetResult = await db.insert(assetsTable)
      .values({
        asset_id: 'TEST-002',
        model_id: testModelId,
        status: 'Assigned',
        assigned_to: testUserId,
        location: 'Office A'
      })
      .returning()
      .execute();

    const testAssetId = assetResult[0].id;

    await retireAsset(testAssetId, testUserId);

    // Verify asset is retired and assignment cleared
    const updatedAsset = await db.select()
      .from(assetsTable)
      .where(eq(assetsTable.id, testAssetId))
      .execute();

    expect(updatedAsset[0].status).toEqual('Retired');
    expect(updatedAsset[0].assigned_to).toBeNull();
  });

  it('should log retirement activity', async () => {
    // Create test asset for this specific test
    const assetResult = await db.insert(assetsTable)
      .values({
        asset_id: 'TEST-003',
        model_id: testModelId,
        status: 'In Stock',
        location: 'Office A'
      })
      .returning()
      .execute();

    const testAssetId = assetResult[0].id;

    await retireAsset(testAssetId, testUserId);

    // Verify activity log entry
    const activityLogs = await db.select()
      .from(activityLogTable)
      .where(eq(activityLogTable.entity_id, testAssetId.toString()))
      .execute();

    expect(activityLogs).toHaveLength(1);
    expect(activityLogs[0].activity_type).toEqual('Asset Retired');
    expect(activityLogs[0].entity_type).toEqual('asset');
    expect(activityLogs[0].user_id).toEqual(testUserId);
    expect(activityLogs[0].description).toContain('TEST-003');
    expect(activityLogs[0].description).toContain('retired');
    expect(activityLogs[0].created_at).toBeInstanceOf(Date);
  });

  it('should include previous status in activity metadata', async () => {
    // Create test asset for this specific test
    const assetResult = await db.insert(assetsTable)
      .values({
        asset_id: 'TEST-004',
        model_id: testModelId,
        status: 'Assigned',
        assigned_to: testUserId,
        location: 'Office A'
      })
      .returning()
      .execute();

    const testAssetId = assetResult[0].id;

    await retireAsset(testAssetId, testUserId);

    // Check metadata includes previous status
    const activityLogs = await db.select()
      .from(activityLogTable)
      .where(eq(activityLogTable.entity_id, testAssetId.toString()))
      .execute();

    const metadata = activityLogs[0].metadata as any;
    expect(metadata.previous_status).toEqual('Assigned');
    expect(metadata.previous_assigned_to).toEqual(testUserId);
  });

  it('should throw error for non-existent asset', async () => {
    const nonExistentAssetId = 999999;

    await expect(retireAsset(nonExistentAssetId, testUserId))
      .rejects.toThrow(/asset not found/i);
  });

  it('should throw error when trying to retire already retired asset', async () => {
    // Create test asset for this specific test
    const assetResult = await db.insert(assetsTable)
      .values({
        asset_id: 'TEST-005',
        model_id: testModelId,
        status: 'In Stock',
        location: 'Office A'
      })
      .returning()
      .execute();

    const testAssetId = assetResult[0].id;

    // First retire the asset
    await retireAsset(testAssetId, testUserId);

    // Try to retire again
    await expect(retireAsset(testAssetId, testUserId))
      .rejects.toThrow(/already retired/i);
  });

  it('should handle different asset statuses before retirement', async () => {
    // Create test asset for this specific test with 'Under Maintenance' status
    const assetResult = await db.insert(assetsTable)
      .values({
        asset_id: 'TEST-006',
        model_id: testModelId,
        status: 'Under Maintenance',
        location: 'Office A'
      })
      .returning()
      .execute();

    const testAssetId = assetResult[0].id;

    await retireAsset(testAssetId, testUserId);

    const updatedAsset = await db.select()
      .from(assetsTable)
      .where(eq(assetsTable.id, testAssetId))
      .execute();

    expect(updatedAsset[0].status).toEqual('Retired');

    // Verify metadata captured previous status
    const activityLogs = await db.select()
      .from(activityLogTable)
      .where(eq(activityLogTable.entity_id, testAssetId.toString()))
      .execute();

    const metadata = activityLogs[0].metadata as any;
    expect(metadata.previous_status).toEqual('Under Maintenance');
  });
});
