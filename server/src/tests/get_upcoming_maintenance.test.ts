
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, assetModelsTable, assetsTable, maintenanceRecordsTable } from '../db/schema';
import { getUpcomingMaintenance } from '../handlers/get_upcoming_maintenance';

describe('getUpcomingMaintenance', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return scheduled maintenance within specified days', async () => {
    // Create test user
    await db.insert(usersTable).values({
      id: 'user1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'Admin'
    });

    // Create test asset model
    const assetModelResult = await db.insert(assetModelsTable).values({
      manufacturer: 'Dell',
      model_number: 'Latitude 5520',
      category: 'Laptops'
    }).returning();

    // Create test asset
    const assetResult = await db.insert(assetsTable).values({
      asset_id: 'LAPTOP001',
      model_id: assetModelResult[0].id,
      status: 'In Stock'
    }).returning();

    // Create maintenance records with different dates
    const today = new Date();
    const in10Days = new Date();
    in10Days.setDate(today.getDate() + 10);
    const in45Days = new Date();
    in45Days.setDate(today.getDate() + 45);

    await db.insert(maintenanceRecordsTable).values([
      {
        asset_id: assetResult[0].id,
        scheduled_date: in10Days,
        description: 'Routine maintenance',
        status: 'Scheduled',
        cost: '150.00'
      },
      {
        asset_id: assetResult[0].id,
        scheduled_date: in45Days,
        description: 'Extended maintenance',
        status: 'Scheduled',
        cost: '300.50'
      }
    ]);

    const results = await getUpcomingMaintenance(30);

    expect(results).toHaveLength(1);
    expect(results[0].description).toEqual('Routine maintenance');
    expect(results[0].status).toEqual('Scheduled');
    expect(results[0].cost).toEqual(150);
    expect(typeof results[0].cost).toBe('number');
  });

  it('should exclude completed maintenance records', async () => {
    // Create test user
    await db.insert(usersTable).values({
      id: 'user1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'Admin'
    });

    // Create test asset model
    const assetModelResult = await db.insert(assetModelsTable).values({
      manufacturer: 'HP',
      model_number: 'EliteBook 840',
      category: 'Laptops'
    }).returning();

    // Create test asset
    const assetResult = await db.insert(assetsTable).values({
      asset_id: 'LAPTOP002',
      model_id: assetModelResult[0].id,
      status: 'In Stock'
    }).returning();

    // Create maintenance records with different statuses
    const in5Days = new Date();
    in5Days.setDate(new Date().getDate() + 5);

    await db.insert(maintenanceRecordsTable).values([
      {
        asset_id: assetResult[0].id,
        scheduled_date: in5Days,
        description: 'Scheduled maintenance',
        status: 'Scheduled'
      },
      {
        asset_id: assetResult[0].id,
        scheduled_date: in5Days,
        description: 'Completed maintenance',
        status: 'Completed'
      },
      {
        asset_id: assetResult[0].id,
        scheduled_date: in5Days,
        description: 'In progress maintenance',
        status: 'In Progress'
      }
    ]);

    const results = await getUpcomingMaintenance(30);

    expect(results).toHaveLength(1);
    expect(results[0].description).toEqual('Scheduled maintenance');
    expect(results[0].status).toEqual('Scheduled');
  });

  it('should return empty array when no maintenance is scheduled', async () => {
    const results = await getUpcomingMaintenance(30);
    expect(results).toHaveLength(0);
  });

  it('should handle null cost values correctly', async () => {
    // Create test user
    await db.insert(usersTable).values({
      id: 'user1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'Admin'
    });

    // Create test asset model
    const assetModelResult = await db.insert(assetModelsTable).values({
      manufacturer: 'Lenovo',
      model_number: 'ThinkPad X1',
      category: 'Laptops'
    }).returning();

    // Create test asset
    const assetResult = await db.insert(assetsTable).values({
      asset_id: 'LAPTOP003',
      model_id: assetModelResult[0].id,
      status: 'In Stock'
    }).returning();

    // Create maintenance record without cost
    const tomorrow = new Date();
    tomorrow.setDate(new Date().getDate() + 1);

    await db.insert(maintenanceRecordsTable).values({
      asset_id: assetResult[0].id,
      scheduled_date: tomorrow,
      description: 'Free maintenance',
      status: 'Scheduled'
      // cost is intentionally omitted (null)
    });

    const results = await getUpcomingMaintenance(30);

    expect(results).toHaveLength(1);
    expect(results[0].cost).toBeNull();
    expect(results[0].description).toEqual('Free maintenance');
  });
});
