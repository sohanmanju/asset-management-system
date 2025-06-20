
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, assetModelsTable, assetsTable, assetAssignmentsTable, maintenanceRecordsTable, assetDisposalsTable } from '../db/schema';
import { getAssets } from '../handlers/get_assets';

describe('getAssets', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no assets exist', async () => {
    const result = await getAssets();
    expect(result).toEqual([]);
  });

  it('should return assets with basic model information', async () => {
    // Create test user
    await db.insert(usersTable).values({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'User'
    }).execute();

    // Create test asset model
    await db.insert(assetModelsTable).values({
      manufacturer: 'Dell',
      model_number: 'Latitude 5520',
      category: 'Laptops',
      specs: 'Intel i7, 16GB RAM'
    }).execute();

    // Create test asset
    await db.insert(assetsTable).values({
      asset_id: 'LAPTOP-001',
      model_id: 1,
      status: 'In Stock',
      location: 'Warehouse A',
      notes: 'Test asset'
    }).execute();

    const result = await getAssets();

    expect(result).toHaveLength(1);
    expect(result[0].asset_id).toEqual('LAPTOP-001');
    expect(result[0].status).toEqual('In Stock');
    expect(result[0].location).toEqual('Warehouse A');
    expect(result[0].notes).toEqual('Test asset');

    // Check model relation
    expect(result[0].model.manufacturer).toEqual('Dell');
    expect(result[0].model.model_number).toEqual('Latitude 5520');
    expect(result[0].model.category).toEqual('Laptops');
    expect(result[0].model.specs).toEqual('Intel i7, 16GB RAM');

    // Check null relations
    expect(result[0].assigned_user).toBeNull();
    expect(result[0].current_assignment).toBeNull();
    expect(result[0].maintenance_records).toEqual([]);
    expect(result[0].disposal).toBeNull();
  });

  it('should return assets with assigned user information', async () => {
    // Create test user
    await db.insert(usersTable).values({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'User'
    }).execute();

    // Create test asset model
    await db.insert(assetModelsTable).values({
      manufacturer: 'Apple',
      model_number: 'MacBook Pro',
      category: 'Laptops'
    }).execute();

    // Create assigned asset
    await db.insert(assetsTable).values({
      asset_id: 'LAPTOP-002',
      model_id: 1,
      status: 'Assigned',
      assigned_to: 'user-1'
    }).execute();

    // Create current assignment
    await db.insert(assetAssignmentsTable).values({
      asset_id: 1,
      user_id: 'user-1',
      assigned_by: 'user-1',
      notes: 'Primary laptop'
    }).execute();

    const result = await getAssets();

    expect(result).toHaveLength(1);
    expect(result[0].status).toEqual('Assigned');
    expect(result[0].assigned_to).toEqual('user-1');

    // Check assigned user relation
    expect(result[0].assigned_user).toBeDefined();
    expect(result[0].assigned_user!.id).toEqual('user-1');
    expect(result[0].assigned_user!.name).toEqual('Test User');
    expect(result[0].assigned_user!.email).toEqual('test@example.com');

    // Check current assignment
    expect(result[0].current_assignment).toBeDefined();
    expect(result[0].current_assignment!.asset_id).toEqual(1);
    expect(result[0].current_assignment!.user_id).toEqual('user-1');
    expect(result[0].current_assignment!.notes).toEqual('Primary laptop');
  });

  it('should return assets with maintenance records and disposal information', async () => {
    // Create test user
    await db.insert(usersTable).values({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'Admin'
    }).execute();

    // Create test asset model
    await db.insert(assetModelsTable).values({
      manufacturer: 'HP',
      model_number: 'EliteBook 840',
      category: 'Laptops'
    }).execute();

    // Create test asset
    await db.insert(assetsTable).values({
      asset_id: 'LAPTOP-003',
      model_id: 1,
      status: 'Retired'
    }).execute();

    // Create maintenance records
    await db.insert(maintenanceRecordsTable).values([
      {
        asset_id: 1,
        scheduled_date: new Date('2023-01-15'),
        completed_date: new Date('2023-01-16'),
        description: 'Screen replacement',
        performed_by: 'user-1',
        cost: '150.00',
        status: 'Completed',
        notes: 'Replaced cracked screen'
      },
      {
        asset_id: 1,
        scheduled_date: new Date('2023-06-01'),
        description: 'Battery replacement',
        status: 'Scheduled'
      }
    ]).execute();

    // Create disposal record
    await db.insert(assetDisposalsTable).values({
      asset_id: 1,
      disposal_date: new Date('2023-12-01'),
      disposal_method: 'Recycling',
      cost: '25.50',
      disposed_by: 'user-1',
      notes: 'End of life disposal'
    }).execute();

    const result = await getAssets();

    expect(result).toHaveLength(1);
    expect(result[0].asset_id).toEqual('LAPTOP-003');

    // Check maintenance records
    expect(result[0].maintenance_records).toHaveLength(2);
    
    const completedRecord = result[0].maintenance_records.find(r => r.status === 'Completed');
    expect(completedRecord).toBeDefined();
    expect(completedRecord!.description).toEqual('Screen replacement');
    expect(completedRecord!.cost).toEqual(150.00);
    expect(typeof completedRecord!.cost).toEqual('number');

    const scheduledRecord = result[0].maintenance_records.find(r => r.status === 'Scheduled');
    expect(scheduledRecord).toBeDefined();
    expect(scheduledRecord!.description).toEqual('Battery replacement');
    expect(scheduledRecord!.cost).toBeNull();

    // Check disposal
    expect(result[0].disposal).toBeDefined();
    expect(result[0].disposal!.disposal_method).toEqual('Recycling');
    expect(result[0].disposal!.cost).toEqual(25.50);
    expect(typeof result[0].disposal!.cost).toEqual('number');
    expect(result[0].disposal!.notes).toEqual('End of life disposal');
  });

  it('should handle multiple assets with different relationships', async () => {
    // Create test users
    await db.insert(usersTable).values([
      {
        id: 'user-1',
        email: 'user1@example.com',
        name: 'User One',
        role: 'User'
      },
      {
        id: 'admin-1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'Admin'
      }
    ]).execute();

    // Create test asset models
    await db.insert(assetModelsTable).values([
      {
        manufacturer: 'Dell',
        model_number: 'OptiPlex 7090',
        category: 'Laptops'
      },
      {
        manufacturer: 'Samsung',
        model_number: 'Odyssey G7',
        category: 'Monitors'
      }
    ]).execute();

    // Create test assets
    await db.insert(assetsTable).values([
      {
        asset_id: 'PC-001',
        model_id: 1,
        status: 'Assigned',
        assigned_to: 'user-1'
      },
      {
        asset_id: 'MON-001',
        model_id: 2,
        status: 'In Stock'
      }
    ]).execute();

    // Create assignment for first asset only
    await db.insert(assetAssignmentsTable).values({
      asset_id: 1,
      user_id: 'user-1',
      assigned_by: 'admin-1'
    }).execute();

    const result = await getAssets();

    expect(result).toHaveLength(2);

    // Check assigned asset
    const assignedAsset = result.find(a => a.asset_id === 'PC-001');
    expect(assignedAsset).toBeDefined();
    expect(assignedAsset!.status).toEqual('Assigned');
    expect(assignedAsset!.assigned_user).toBeDefined();
    expect(assignedAsset!.assigned_user!.name).toEqual('User One');
    expect(assignedAsset!.current_assignment).toBeDefined();

    // Check unassigned asset
    const unassignedAsset = result.find(a => a.asset_id === 'MON-001');
    expect(unassignedAsset).toBeDefined();
    expect(unassignedAsset!.status).toEqual('In Stock');
    expect(unassignedAsset!.assigned_user).toBeNull();
    expect(unassignedAsset!.current_assignment).toBeNull();
    expect(unassignedAsset!.model.category).toEqual('Monitors');
  });
});
