
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, assetModelsTable, assetsTable, assetDisposalsTable } from '../db/schema';
import { getExpiringWarranties } from '../handlers/get_expiring_warranties';

describe('getExpiringWarranties', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return assets with warranties expiring within default 30 days', async () => {
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

    // Create test asset model
    const model = await db.insert(assetModelsTable)
      .values({
        manufacturer: 'Dell',
        model_number: 'XPS-13',
        category: 'Laptops',
        specs: 'Intel i7, 16GB RAM'
      })
      .returning()
      .execute();

    // Create asset with warranty expiring in 15 days
    const expiringDate = new Date();
    expiringDate.setDate(expiringDate.getDate() + 15);

    const asset = await db.insert(assetsTable)
      .values({
        asset_id: 'LAPTOP001',
        model_id: model[0].id,
        status: 'Assigned',
        assigned_to: user[0].id,
        warranty_expiry: expiringDate,
        location: 'Office A'
      })
      .returning()
      .execute();

    const results = await getExpiringWarranties();

    expect(results).toHaveLength(1);
    expect(results[0].asset_id).toEqual('LAPTOP001');
    expect(results[0].warranty_expiry).toEqual(expiringDate);
    expect(results[0].model.manufacturer).toEqual('Dell');
    expect(results[0].assigned_user?.name).toEqual('Test User');
  });

  it('should return assets with warranties expiring within custom days parameter', async () => {
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

    // Create test asset model
    const model = await db.insert(assetModelsTable)
      .values({
        manufacturer: 'HP',
        model_number: 'ProBook',
        category: 'Laptops'
      })
      .returning()
      .execute();

    // Create asset with warranty expiring in 45 days
    const expiringDate = new Date();
    expiringDate.setDate(expiringDate.getDate() + 45);

    await db.insert(assetsTable)
      .values({
        asset_id: 'LAPTOP002',
        model_id: model[0].id,
        warranty_expiry: expiringDate
      })
      .returning()
      .execute();

    // Should not find it with 30 days
    const results30 = await getExpiringWarranties(30);
    expect(results30).toHaveLength(0);

    // Should find it with 60 days
    const results60 = await getExpiringWarranties(60);
    expect(results60).toHaveLength(1);
    expect(results60[0].asset_id).toEqual('LAPTOP002');
  });

  it('should exclude disposed assets from results', async () => {
    // Create test asset model
    const model = await db.insert(assetModelsTable)
      .values({
        manufacturer: 'Lenovo',
        model_number: 'ThinkPad',
        category: 'Laptops'
      })
      .returning()
      .execute();

    // Create asset with warranty expiring in 10 days
    const expiringDate = new Date();
    expiringDate.setDate(expiringDate.getDate() + 10);

    const asset = await db.insert(assetsTable)
      .values({
        asset_id: 'LAPTOP003',
        model_id: model[0].id,
        status: 'Retired',
        warranty_expiry: expiringDate
      })
      .returning()
      .execute();

    // Dispose the asset
    await db.insert(assetDisposalsTable)
      .values({
        asset_id: asset[0].id,
        disposal_date: new Date(),
        disposal_method: 'Recycling',
        disposed_by: 'admin'
      })
      .execute();

    const results = await getExpiringWarranties();

    // Should not include disposed asset
    expect(results).toHaveLength(0);
  });

  it('should not return assets with warranties expiring beyond the threshold', async () => {
    // Create test asset model
    const model = await db.insert(assetModelsTable)
      .values({
        manufacturer: 'Apple',
        model_number: 'MacBook Pro',
        category: 'Laptops'
      })
      .returning()
      .execute();

    // Create asset with warranty expiring in 60 days
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 60);

    await db.insert(assetsTable)
      .values({
        asset_id: 'LAPTOP004',
        model_id: model[0].id,
        warranty_expiry: futureDate
      })
      .execute();

    const results = await getExpiringWarranties(30);

    expect(results).toHaveLength(0);
  });

  it('should return assets with all related data populated', async () => {
    // Create test user
    const user = await db.insert(usersTable)
      .values({
        id: 'user1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'Admin'
      })
      .returning()
      .execute();

    // Create test asset model
    const model = await db.insert(assetModelsTable)
      .values({
        manufacturer: 'Microsoft',
        model_number: 'Surface Pro',
        category: 'Laptops',
        specs: 'Intel i5, 8GB RAM'
      })
      .returning()
      .execute();

    // Create asset with warranty expiring in 20 days
    const expiringDate = new Date();
    expiringDate.setDate(expiringDate.getDate() + 20);

    await db.insert(assetsTable)
      .values({
        asset_id: 'SURFACE001',
        model_id: model[0].id,
        status: 'Assigned',
        assigned_to: user[0].id,
        warranty_expiry: expiringDate,
        location: 'Office B',
        notes: 'Executive laptop'
      })
      .execute();

    const results = await getExpiringWarranties();

    expect(results).toHaveLength(1);
    const asset = results[0];

    // Verify all fields are populated
    expect(asset.asset_id).toEqual('SURFACE001');
    expect(asset.status).toEqual('Assigned');
    expect(asset.location).toEqual('Office B');
    expect(asset.notes).toEqual('Executive laptop');
    expect(asset.warranty_expiry).toEqual(expiringDate);

    // Verify model data
    expect(asset.model.manufacturer).toEqual('Microsoft');
    expect(asset.model.model_number).toEqual('Surface Pro');
    expect(asset.model.category).toEqual('Laptops');
    expect(asset.model.specs).toEqual('Intel i5, 8GB RAM');

    // Verify assigned user data
    expect(asset.assigned_user?.name).toEqual('Test User');
    expect(asset.assigned_user?.email).toEqual('test@example.com');
    expect(asset.assigned_user?.role).toEqual('Admin');

    // Verify arrays are initialized
    expect(Array.isArray(asset.maintenance_records)).toBe(true);
    expect(asset.disposal).toBeNull();
  });
});
