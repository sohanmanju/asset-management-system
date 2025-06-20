
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, assetModelsTable, assetsTable, assetAssignmentsTable, maintenanceRecordsTable, assetDisposalsTable } from '../db/schema';
import { getAsset } from '../handlers/get_asset';

describe('getAsset', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return null for non-existent asset', async () => {
    const result = await getAsset(999);
    expect(result).toBeNull();
  });

  it('should get asset with model and all relations', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'User'
      })
      .returning()
      .execute();

    const user = userResult[0];

    // Create asset model
    const modelResult = await db.insert(assetModelsTable)
      .values({
        manufacturer: 'Dell',
        model_number: 'XPS-13',
        category: 'Laptops',
        specs: 'Intel i7, 16GB RAM'
      })
      .returning()
      .execute();

    const model = modelResult[0];

    // Create asset
    const assetResult = await db.insert(assetsTable)
      .values({
        asset_id: 'ASSET-001',
        model_id: model.id,
        status: 'Assigned',
        assigned_to: user.id,
        location: 'Office Floor 1',
        notes: 'Test asset'
      })
      .returning()
      .execute();

    const asset = assetResult[0];

    // Create assignment record
    await db.insert(assetAssignmentsTable)
      .values({
        asset_id: asset.id,
        user_id: user.id,
        assigned_by: user.id,
        notes: 'Initial assignment'
      })
      .execute();

    // Create maintenance record
    await db.insert(maintenanceRecordsTable)
      .values({
        asset_id: asset.id,
        scheduled_date: new Date('2024-01-15'),
        description: 'Routine maintenance',
        cost: '150.00',
        status: 'Completed'
      })
      .execute();

    // Create disposal record
    await db.insert(assetDisposalsTable)
      .values({
        asset_id: asset.id,
        disposal_date: new Date('2024-12-01'),
        disposal_method: 'Recycling',
        cost: '25.50',
        disposed_by: user.id,
        notes: 'End of life disposal'
      })
      .execute();

    const result = await getAsset(asset.id);

    expect(result).toBeDefined();
    expect(result!.id).toBe(asset.id);
    expect(result!.asset_id).toBe('ASSET-001');
    expect(result!.status).toBe('Assigned');
    expect(result!.assigned_to).toBe(user.id);
    expect(result!.location).toBe('Office Floor 1');
    expect(result!.notes).toBe('Test asset');

    // Check model relation
    expect(result!.model).toBeDefined();
    expect(result!.model.manufacturer).toBe('Dell');
    expect(result!.model.model_number).toBe('XPS-13');
    expect(result!.model.category).toBe('Laptops');
    expect(result!.model.specs).toBe('Intel i7, 16GB RAM');

    // Check assigned user relation
    expect(result!.assigned_user).toBeDefined();
    expect(result!.assigned_user!.id).toBe(user.id);
    expect(result!.assigned_user!.email).toBe('test@example.com');
    expect(result!.assigned_user!.name).toBe('Test User');

    // Check current assignment
    expect(result!.current_assignment).toBeDefined();
    expect(result!.current_assignment!.asset_id).toBe(asset.id);
    expect(result!.current_assignment!.user_id).toBe(user.id);
    expect(result!.current_assignment!.unassigned_at).toBeNull();

    // Check maintenance records
    expect(result!.maintenance_records).toHaveLength(1);
    expect(result!.maintenance_records[0].description).toBe('Routine maintenance');
    expect(result!.maintenance_records[0].cost).toBe(150.00);
    expect(typeof result!.maintenance_records[0].cost).toBe('number');
    expect(result!.maintenance_records[0].status).toBe('Completed');

    // Check disposal record
    expect(result!.disposal).toBeDefined();
    expect(result!.disposal!.disposal_method).toBe('Recycling');
    expect(result!.disposal!.cost).toBe(25.50);
    expect(typeof result!.disposal!.cost).toBe('number');
    expect(result!.disposal!.disposed_by).toBe(user.id);
  });

  it('should get asset without assigned user', async () => {
    // Create asset model
    const modelResult = await db.insert(assetModelsTable)
      .values({
        manufacturer: 'HP',
        model_number: 'ProBook-450',
        category: 'Laptops',
        specs: null
      })
      .returning()
      .execute();

    const model = modelResult[0];

    // Create unassigned asset
    const assetResult = await db.insert(assetsTable)
      .values({
        asset_id: 'ASSET-002',
        model_id: model.id,
        status: 'In Stock'
      })
      .returning()
      .execute();

    const asset = assetResult[0];

    const result = await getAsset(asset.id);

    expect(result).toBeDefined();
    expect(result!.id).toBe(asset.id);
    expect(result!.status).toBe('In Stock');
    expect(result!.assigned_to).toBeNull();
    expect(result!.assigned_user).toBeNull();
    expect(result!.current_assignment).toBeNull();
    expect(result!.maintenance_records).toHaveLength(0);
    expect(result!.disposal).toBeNull();

    // Model should still be populated
    expect(result!.model).toBeDefined();
    expect(result!.model.manufacturer).toBe('HP');
    expect(result!.model.specs).toBeNull();
  });

  it('should handle multiple assignments correctly', async () => {
    // Create test users
    const user1Result = await db.insert(usersTable)
      .values({
        id: 'user-1',
        email: 'user1@example.com',
        name: 'User One',
        role: 'User'
      })
      .returning()
      .execute();

    const user2Result = await db.insert(usersTable)
      .values({
        id: 'user-2',
        email: 'user2@example.com',
        name: 'User Two',
        role: 'User'
      })
      .returning()
      .execute();

    // Create asset model
    const modelResult = await db.insert(assetModelsTable)
      .values({
        manufacturer: 'Apple',
        model_number: 'MacBook-Pro',
        category: 'Laptops'
      })
      .returning()
      .execute();

    // Create asset assigned to user2
    const assetResult = await db.insert(assetsTable)
      .values({
        asset_id: 'ASSET-003',
        model_id: modelResult[0].id,
        status: 'Assigned',
        assigned_to: user2Result[0].id
      })
      .returning()
      .execute();

    const asset = assetResult[0];

    // Create first assignment (completed)
    await db.insert(assetAssignmentsTable)
      .values({
        asset_id: asset.id,
        user_id: user1Result[0].id,
        assigned_by: user1Result[0].id,
        assigned_at: new Date('2024-01-01'),
        unassigned_at: new Date('2024-06-01')
      })
      .execute();

    // Create current assignment
    await db.insert(assetAssignmentsTable)
      .values({
        asset_id: asset.id,
        user_id: user2Result[0].id,
        assigned_by: user1Result[0].id,
        assigned_at: new Date('2024-06-02')
      })
      .execute();

    const result = await getAsset(asset.id);

    expect(result).toBeDefined();
    expect(result!.assigned_to).toBe(user2Result[0].id);
    expect(result!.assigned_user!.id).toBe(user2Result[0].id);
    
    // Should return the current assignment (without unassigned_at)
    expect(result!.current_assignment).toBeDefined();
    expect(result!.current_assignment!.user_id).toBe(user2Result[0].id);
    expect(result!.current_assignment!.unassigned_at).toBeNull();
  });
});
