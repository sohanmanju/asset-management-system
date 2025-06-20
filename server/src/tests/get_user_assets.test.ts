
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, assetModelsTable, assetsTable, assetAssignmentsTable, maintenanceRecordsTable, assetDisposalsTable } from '../db/schema';
import { getUserAssets } from '../handlers/get_user_assets';

describe('getUserAssets', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return user assets with empty arrays for user with no assets', async () => {
    // Create a user
    const user = await db.insert(usersTable)
      .values({
        id: 'user1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'User'
      })
      .returning()
      .execute();

    const result = await getUserAssets('user1');

    expect(result.user).toEqual(user[0]);
    expect(result.current_assets).toEqual([]);
    expect(result.past_assignments).toEqual([]);
  });

  it('should return user with current assets', async () => {
    // Create user
    const user = await db.insert(usersTable)
      .values({
        id: 'user1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'User'
      })
      .returning()
      .execute();

    // Create asset model
    const assetModel = await db.insert(assetModelsTable)
      .values({
        manufacturer: 'Dell',
        model_number: 'Latitude 7420',
        category: 'Laptops',
        specs: 'Intel i7, 16GB RAM'
      })
      .returning()
      .execute();

    // Create asset
    const asset = await db.insert(assetsTable)
      .values({
        asset_id: 'LAPTOP001',
        model_id: assetModel[0].id,
        status: 'Assigned',
        assigned_to: 'user1',
        location: 'Office A'
      })
      .returning()
      .execute();

    // Create assignment record (current - no unassigned_at)
    const assignment = await db.insert(assetAssignmentsTable)
      .values({
        asset_id: asset[0].id,
        user_id: 'user1',
        assigned_by: 'admin1',
        notes: 'Initial assignment'
      })
      .returning()
      .execute();

    // Create maintenance record
    const maintenance = await db.insert(maintenanceRecordsTable)
      .values({
        asset_id: asset[0].id,
        scheduled_date: new Date('2024-01-15'),
        description: 'Regular maintenance',
        cost: '150.00',
        status: 'Scheduled'
      })
      .returning()
      .execute();

    const result = await getUserAssets('user1');

    expect(result.user).toEqual(user[0]);
    expect(result.current_assets).toHaveLength(1);
    expect(result.past_assignments).toHaveLength(0);

    const currentAsset = result.current_assets[0];
    expect(currentAsset.id).toEqual(asset[0].id);
    expect(currentAsset.asset_id).toEqual('LAPTOP001');
    expect(currentAsset.status).toEqual('Assigned');
    expect(currentAsset.assigned_to).toEqual('user1');
    expect(currentAsset.model).toEqual(assetModel[0]);
    expect(currentAsset.assigned_user).toEqual(user[0]);
    expect(currentAsset.current_assignment).toEqual(assignment[0]);
    expect(currentAsset.maintenance_records).toHaveLength(1);
    expect(currentAsset.maintenance_records[0].cost).toEqual(150.00);
    expect(typeof currentAsset.maintenance_records[0].cost).toEqual('number');
    expect(currentAsset.disposal).toBeNull();
  });

  it('should return user with past assignments', async () => {
    // Create user
    await db.insert(usersTable)
      .values({
        id: 'user1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'User'
      })
      .execute();

    // Create asset model
    const assetModel = await db.insert(assetModelsTable)
      .values({
        manufacturer: 'Apple',
        model_number: 'MacBook Pro',
        category: 'Laptops',
        specs: 'M1 Pro, 32GB RAM'
      })
      .returning()
      .execute();

    // Create asset (not currently assigned to user1)
    const asset = await db.insert(assetsTable)
      .values({
        asset_id: 'LAPTOP002',
        model_id: assetModel[0].id,
        status: 'In Stock',
        assigned_to: null,
        location: 'Warehouse'
      })
      .returning()
      .execute();

    // Create past assignment (with unassigned_at date)
    const pastAssignment = await db.insert(assetAssignmentsTable)
      .values({
        asset_id: asset[0].id,
        user_id: 'user1',
        assigned_by: 'admin1',
        assigned_at: new Date('2023-01-01'),
        unassigned_at: new Date('2023-12-31'),
        notes: 'Previous assignment'
      })
      .returning()
      .execute();

    // Create disposal record
    const disposal = await db.insert(assetDisposalsTable)
      .values({
        asset_id: asset[0].id,
        disposal_date: new Date('2024-01-01'),
        disposal_method: 'Recycling',
        cost: '50.00',
        disposed_by: 'admin1',
        notes: 'End of life disposal'
      })
      .returning()
      .execute();

    const result = await getUserAssets('user1');

    expect(result.current_assets).toHaveLength(0);
    expect(result.past_assignments).toHaveLength(1);

    const pastAssignmentResult = result.past_assignments[0];
    expect(pastAssignmentResult.id).toEqual(pastAssignment[0].id);
    expect(pastAssignmentResult.asset_id).toEqual(asset[0].id);
    expect(pastAssignmentResult.user_id).toEqual('user1');
    expect(pastAssignmentResult.unassigned_at).toEqual(pastAssignment[0].unassigned_at);

    const assetInPastAssignment = pastAssignmentResult.asset;
    expect(assetInPastAssignment.id).toEqual(asset[0].id);
    expect(assetInPastAssignment.asset_id).toEqual('LAPTOP002');
    expect(assetInPastAssignment.model).toEqual(assetModel[0]);
    expect(assetInPastAssignment.current_assignment).toBeNull();
    expect(assetInPastAssignment.disposal).toBeDefined();
    expect(assetInPastAssignment.disposal).not.toBeNull();
    
    if (assetInPastAssignment.disposal) {
      expect(assetInPastAssignment.disposal.cost).toEqual(50.00);
      expect(typeof assetInPastAssignment.disposal.cost).toEqual('number');
    }
  });

  it('should throw error for non-existent user', async () => {
    await expect(getUserAssets('nonexistent')).rejects.toThrow(/User with id nonexistent not found/i);
  });

  it('should handle user with both current and past assignments', async () => {
    // Create user
    await db.insert(usersTable)
      .values({
        id: 'user1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'User'
      })
      .execute();

    // Create asset model
    const assetModel = await db.insert(assetModelsTable)
      .values({
        manufacturer: 'HP',
        model_number: 'EliteBook 840',
        category: 'Laptops'
      })
      .returning()
      .execute();

    // Create current asset
    const currentAsset = await db.insert(assetsTable)
      .values({
        asset_id: 'LAPTOP003',
        model_id: assetModel[0].id,
        status: 'Assigned',
        assigned_to: 'user1'
      })
      .returning()
      .execute();

    // Create past asset
    const pastAsset = await db.insert(assetsTable)
      .values({
        asset_id: 'LAPTOP004',
        model_id: assetModel[0].id,
        status: 'In Stock',
        assigned_to: null
      })
      .returning()
      .execute();

    // Create current assignment (no unassigned_at)
    await db.insert(assetAssignmentsTable)
      .values({
        asset_id: currentAsset[0].id,
        user_id: 'user1',
        assigned_by: 'admin1'
      })
      .execute();

    // Create past assignment (with unassigned_at)
    await db.insert(assetAssignmentsTable)
      .values({
        asset_id: pastAsset[0].id,
        user_id: 'user1',
        assigned_by: 'admin1',
        assigned_at: new Date('2023-01-01'),
        unassigned_at: new Date('2023-12-31')
      })
      .execute();

    const result = await getUserAssets('user1');

    expect(result.current_assets).toHaveLength(1);
    expect(result.past_assignments).toHaveLength(1);
    expect(result.current_assets[0].asset_id).toEqual('LAPTOP003');
    expect(result.past_assignments[0].asset.asset_id).toEqual('LAPTOP004');
  });
});
