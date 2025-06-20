
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, assetModelsTable, assetsTable, maintenanceRecordsTable } from '../db/schema';
import { getMaintenanceRecords } from '../handlers/get_maintenance_records';

describe('getMaintenanceRecords', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return all maintenance records when no assetId is provided', async () => {
    // Create test user
    await db.insert(usersTable).values({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'Admin'
    });

    // Create asset model
    const assetModelResult = await db.insert(assetModelsTable).values({
      manufacturer: 'Dell',
      model_number: 'Laptop-123',
      category: 'Laptops',
      specs: 'Test specs'
    }).returning();

    // Create assets
    const asset1Result = await db.insert(assetsTable).values({
      asset_id: 'ASSET-001',
      model_id: assetModelResult[0].id,
      status: 'In Stock'
    }).returning();

    const asset2Result = await db.insert(assetsTable).values({
      asset_id: 'ASSET-002',
      model_id: assetModelResult[0].id,
      status: 'In Stock'
    }).returning();

    // Create maintenance records
    await db.insert(maintenanceRecordsTable).values([
      {
        asset_id: asset1Result[0].id,
        scheduled_date: new Date('2024-01-15'),
        description: 'Regular maintenance',
        cost: '100.50',
        status: 'Completed'
      },
      {
        asset_id: asset2Result[0].id,
        scheduled_date: new Date('2024-01-20'),
        description: 'Hardware repair',
        cost: '250.75',
        status: 'In Progress'
      }
    ]);

    const results = await getMaintenanceRecords();

    expect(results).toHaveLength(2);
    expect(results[0].description).toEqual('Regular maintenance');
    expect(results[0].cost).toEqual(100.50);
    expect(typeof results[0].cost).toBe('number');
    expect(results[1].description).toEqual('Hardware repair');
    expect(results[1].cost).toEqual(250.75);
    expect(typeof results[1].cost).toBe('number');
  });

  it('should return maintenance records for specific asset when assetId is provided', async () => {
    // Create test user
    await db.insert(usersTable).values({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'Admin'
    });

    // Create asset model
    const assetModelResult = await db.insert(assetModelsTable).values({
      manufacturer: 'Dell',
      model_number: 'Laptop-123',
      category: 'Laptops',
      specs: 'Test specs'
    }).returning();

    // Create assets
    const asset1Result = await db.insert(assetsTable).values({
      asset_id: 'ASSET-001',
      model_id: assetModelResult[0].id,
      status: 'In Stock'
    }).returning();

    const asset2Result = await db.insert(assetsTable).values({
      asset_id: 'ASSET-002',
      model_id: assetModelResult[0].id,
      status: 'In Stock'
    }).returning();

    // Create maintenance records for both assets
    await db.insert(maintenanceRecordsTable).values([
      {
        asset_id: asset1Result[0].id,
        scheduled_date: new Date('2024-01-15'),
        description: 'Asset 1 maintenance',
        cost: '100.50',
        status: 'Completed'
      },
      {
        asset_id: asset2Result[0].id,
        scheduled_date: new Date('2024-01-20'),
        description: 'Asset 2 maintenance',
        cost: '250.75',
        status: 'In Progress'
      }
    ]);

    const results = await getMaintenanceRecords(asset1Result[0].id);

    expect(results).toHaveLength(1);
    expect(results[0].asset_id).toEqual(asset1Result[0].id);
    expect(results[0].description).toEqual('Asset 1 maintenance');
    expect(results[0].cost).toEqual(100.50);
    expect(typeof results[0].cost).toBe('number');
  });

  it('should return empty array when no maintenance records exist for asset', async () => {
    // Create test user
    await db.insert(usersTable).values({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'Admin'
    });

    // Create asset model
    const assetModelResult = await db.insert(assetModelsTable).values({
      manufacturer: 'Dell',
      model_number: 'Laptop-123',
      category: 'Laptops',
      specs: 'Test specs'
    }).returning();

    // Create asset
    const assetResult = await db.insert(assetsTable).values({
      asset_id: 'ASSET-001',
      model_id: assetModelResult[0].id,
      status: 'In Stock'
    }).returning();

    const results = await getMaintenanceRecords(assetResult[0].id);

    expect(results).toHaveLength(0);
  });

  it('should handle maintenance records with null cost', async () => {
    // Create test user
    await db.insert(usersTable).values({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'Admin'
    });

    // Create asset model
    const assetModelResult = await db.insert(assetModelsTable).values({
      manufacturer: 'Dell',
      model_number: 'Laptop-123',
      category: 'Laptops',
      specs: 'Test specs'
    }).returning();

    // Create asset
    const assetResult = await db.insert(assetsTable).values({
      asset_id: 'ASSET-001',
      model_id: assetModelResult[0].id,
      status: 'In Stock'
    }).returning();

    // Create maintenance record with null cost
    await db.insert(maintenanceRecordsTable).values({
      asset_id: assetResult[0].id,
      scheduled_date: new Date('2024-01-15'),
      description: 'Free maintenance',
      cost: null,
      status: 'Scheduled'
    });

    const results = await getMaintenanceRecords(assetResult[0].id);

    expect(results).toHaveLength(1);
    expect(results[0].cost).toBeNull();
    expect(results[0].description).toEqual('Free maintenance');
  });

  it('should return records with correct field types', async () => {
    // Create test user
    await db.insert(usersTable).values({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'Admin'
    });

    // Create asset model
    const assetModelResult = await db.insert(assetModelsTable).values({
      manufacturer: 'Dell',
      model_number: 'Laptop-123',
      category: 'Laptops',
      specs: 'Test specs'
    }).returning();

    // Create asset
    const assetResult = await db.insert(assetsTable).values({
      asset_id: 'ASSET-001',
      model_id: assetModelResult[0].id,
      status: 'In Stock'
    }).returning();

    // Create maintenance record
    await db.insert(maintenanceRecordsTable).values({
      asset_id: assetResult[0].id,
      scheduled_date: new Date('2024-01-15'),
      description: 'Test maintenance',
      cost: '199.99',
      status: 'Completed',
      performed_by: 'user-1',
      notes: 'Test notes'
    });

    const results = await getMaintenanceRecords();

    expect(results).toHaveLength(1);
    const record = results[0];
    
    expect(typeof record.id).toBe('number');
    expect(typeof record.asset_id).toBe('number');
    expect(record.scheduled_date).toBeInstanceOf(Date);
    expect(typeof record.description).toBe('string');
    expect(typeof record.cost).toBe('number');
    expect(record.status).toEqual('Completed');
    expect(record.performed_by).toEqual('user-1');
    expect(record.notes).toEqual('Test notes');
    expect(record.created_at).toBeInstanceOf(Date);
    expect(record.updated_at).toBeInstanceOf(Date);
  });
});
