
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, assetModelsTable, assetsTable, assetAssignmentsTable } from '../db/schema';
import { type UnassignAssetInput } from '../schema';
import { unassignAsset } from '../handlers/unassign_asset';
import { eq, isNull, and } from 'drizzle-orm';

describe('unassignAsset', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  const testInput: UnassignAssetInput = {
    asset_id: 1,
    notes: 'Asset returned for maintenance'
  };

  it('should unassign an asset successfully', async () => {
    // Create prerequisite data
    await db.insert(usersTable).values([
      { id: 'user-1', email: 'user@test.com', name: 'Test User', role: 'User' },
      { id: 'admin-1', email: 'admin@test.com', name: 'Test Admin', role: 'Admin' }
    ]).execute();

    const modelResult = await db.insert(assetModelsTable).values({
      manufacturer: 'Dell',
      model_number: 'Latitude 5520',
      category: 'Laptops',
      specs: 'i7, 16GB RAM'
    }).returning().execute();

    const assetResult = await db.insert(assetsTable).values({
      asset_id: 'LAPTOP-001',
      model_id: modelResult[0].id,
      status: 'Assigned',
      assigned_to: 'user-1',
      location: 'Office A'
    }).returning().execute();

    // Create active assignment
    await db.insert(assetAssignmentsTable).values({
      asset_id: assetResult[0].id,
      user_id: 'user-1',
      assigned_by: 'admin-1',
      notes: 'Initial assignment'
    }).execute();

    // Unassign the asset
    await unassignAsset({ ...testInput, asset_id: assetResult[0].id }, 'admin-1');

    // Verify asset status is updated
    const updatedAsset = await db.select()
      .from(assetsTable)
      .where(eq(assetsTable.id, assetResult[0].id))
      .execute();

    expect(updatedAsset[0].status).toEqual('In Stock');
    expect(updatedAsset[0].assigned_to).toBeNull();
    expect(updatedAsset[0].updated_at).toBeInstanceOf(Date);

    // Verify assignment record is updated
    const assignment = await db.select()
      .from(assetAssignmentsTable)
      .where(eq(assetAssignmentsTable.asset_id, assetResult[0].id))
      .execute();

    expect(assignment[0].unassigned_at).toBeInstanceOf(Date);
    expect(assignment[0].notes).toEqual('Asset returned for maintenance');
  });

  it('should throw error for non-existent asset', async () => {
    await expect(unassignAsset(testInput, 'admin-1'))
      .rejects.toThrow(/asset not found/i);
  });

  it('should throw error for asset that is not assigned', async () => {
    // Create prerequisite data
    await db.insert(usersTable).values({
      id: 'admin-1',
      email: 'admin@test.com',
      name: 'Test Admin',
      role: 'Admin'
    }).execute();

    const modelResult = await db.insert(assetModelsTable).values({
      manufacturer: 'Dell',
      model_number: 'Latitude 5520',
      category: 'Laptops',
      specs: 'i7, 16GB RAM'
    }).returning().execute();

    const assetResult = await db.insert(assetsTable).values({
      asset_id: 'LAPTOP-001',
      model_id: modelResult[0].id,
      status: 'In Stock',
      assigned_to: null
    }).returning().execute();

    await expect(unassignAsset({ ...testInput, asset_id: assetResult[0].id }, 'admin-1'))
      .rejects.toThrow(/asset is not currently assigned/i);
  });

  it('should throw error when no active assignment exists', async () => {
    // Create prerequisite data
    await db.insert(usersTable).values([
      { id: 'user-1', email: 'user@test.com', name: 'Test User', role: 'User' },
      { id: 'admin-1', email: 'admin@test.com', name: 'Test Admin', role: 'Admin' }
    ]).execute();

    const modelResult = await db.insert(assetModelsTable).values({
      manufacturer: 'Dell',
      model_number: 'Latitude 5520',
      category: 'Laptops',
      specs: 'i7, 16GB RAM'
    }).returning().execute();

    const assetResult = await db.insert(assetsTable).values({
      asset_id: 'LAPTOP-001',
      model_id: modelResult[0].id,
      status: 'Assigned',
      assigned_to: 'user-1'
    }).returning().execute();

    // Create assignment that's already unassigned
    await db.insert(assetAssignmentsTable).values({
      asset_id: assetResult[0].id,
      user_id: 'user-1',
      assigned_by: 'admin-1',
      unassigned_at: new Date()
    }).execute();

    await expect(unassignAsset({ ...testInput, asset_id: assetResult[0].id }, 'admin-1'))
      .rejects.toThrow(/no active assignment found/i);
  });

  it('should preserve existing notes when no new notes provided', async () => {
    // Create prerequisite data
    await db.insert(usersTable).values([
      { id: 'user-1', email: 'user@test.com', name: 'Test User', role: 'User' },
      { id: 'admin-1', email: 'admin@test.com', name: 'Test Admin', role: 'Admin' }
    ]).execute();

    const modelResult = await db.insert(assetModelsTable).values({
      manufacturer: 'Dell',
      model_number: 'Latitude 5520',
      category: 'Laptops',
      specs: 'i7, 16GB RAM'
    }).returning().execute();

    const assetResult = await db.insert(assetsTable).values({
      asset_id: 'LAPTOP-001',
      model_id: modelResult[0].id,
      status: 'Assigned',
      assigned_to: 'user-1'
    }).returning().execute();

    // Create active assignment with original notes
    await db.insert(assetAssignmentsTable).values({
      asset_id: assetResult[0].id,
      user_id: 'user-1',
      assigned_by: 'admin-1',
      notes: 'Original assignment notes'
    }).execute();

    // Unassign without providing notes
    await unassignAsset({ asset_id: assetResult[0].id, notes: null }, 'admin-1');

    // Verify original notes are preserved
    const assignment = await db.select()
      .from(assetAssignmentsTable)
      .where(eq(assetAssignmentsTable.asset_id, assetResult[0].id))
      .execute();

    expect(assignment[0].notes).toEqual('Original assignment notes');
    expect(assignment[0].unassigned_at).toBeInstanceOf(Date);
  });
});
