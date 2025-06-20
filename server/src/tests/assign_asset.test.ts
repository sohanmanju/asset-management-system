
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, assetModelsTable, assetsTable, assetAssignmentsTable } from '../db/schema';
import { type AssignAssetInput, type CreateUserInput, type CreateAssetModelInput, type CreateAssetInput } from '../schema';
import { assignAsset } from '../handlers/assign_asset';
import { eq } from 'drizzle-orm';

// Test data
const testUser: CreateUserInput = {
  email: 'user@example.com',
  name: 'Test User',
  role: 'User'
};

const testAdmin: CreateUserInput = {
  email: 'admin@example.com',
  name: 'Test Admin',
  role: 'Admin'
};

const testAssetModel: CreateAssetModelInput = {
  manufacturer: 'Dell',
  model_number: 'Latitude 7420',
  category: 'Laptops',
  specs: '16GB RAM, 512GB SSD'
};

const testAsset: CreateAssetInput = {
  asset_id: 'LAPTOP-001',
  model_id: 1,
  purchase_date: new Date('2024-01-15'),
  warranty_expiry: new Date('2027-01-15'),
  location: 'Office A',
  notes: 'Brand new laptop'
};

describe('assignAsset', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should assign an asset to a user', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable)
      .values({ id: 'user-1', ...testUser })
      .returning()
      .execute();

    const adminResult = await db.insert(usersTable)
      .values({ id: 'admin-1', ...testAdmin })
      .returning()
      .execute();

    const modelResult = await db.insert(assetModelsTable)
      .values(testAssetModel)
      .returning()
      .execute();

    const assetResult = await db.insert(assetsTable)
      .values({ ...testAsset, model_id: modelResult[0].id })
      .returning()
      .execute();

    const assignmentInput: AssignAssetInput = {
      asset_id: assetResult[0].id,
      user_id: userResult[0].id,
      notes: 'Initial assignment for new employee'
    };

    // Perform assignment
    const result = await assignAsset(assignmentInput, adminResult[0].id);

    // Verify assignment record
    expect(result.asset_id).toEqual(assetResult[0].id);
    expect(result.user_id).toEqual(userResult[0].id);
    expect(result.assigned_by).toEqual(adminResult[0].id);
    expect(result.notes).toEqual('Initial assignment for new employee');
    expect(result.assigned_at).toBeInstanceOf(Date);
    expect(result.unassigned_at).toBeNull();
    expect(result.id).toBeDefined();
  });

  it('should update asset status and assigned_to field', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable)
      .values({ id: 'user-2', ...testUser })
      .returning()
      .execute();

    const adminResult = await db.insert(usersTable)
      .values({ id: 'admin-2', ...testAdmin })
      .returning()
      .execute();

    const modelResult = await db.insert(assetModelsTable)
      .values(testAssetModel)
      .returning()
      .execute();

    const assetResult = await db.insert(assetsTable)
      .values({ ...testAsset, model_id: modelResult[0].id })
      .returning()
      .execute();

    const assignmentInput: AssignAssetInput = {
      asset_id: assetResult[0].id,
      user_id: userResult[0].id,
      notes: null
    };

    // Perform assignment
    await assignAsset(assignmentInput, adminResult[0].id);

    // Verify asset was updated
    const updatedAsset = await db.select()
      .from(assetsTable)
      .where(eq(assetsTable.id, assetResult[0].id))
      .execute();

    expect(updatedAsset).toHaveLength(1);
    expect(updatedAsset[0].status).toEqual('Assigned');
    expect(updatedAsset[0].assigned_to).toEqual(userResult[0].id);
    expect(updatedAsset[0].updated_at).toBeInstanceOf(Date);
  });

  it('should create assignment record in database', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable)
      .values({ id: 'user-3', ...testUser })
      .returning()
      .execute();

    const adminResult = await db.insert(usersTable)
      .values({ id: 'admin-3', ...testAdmin })
      .returning()
      .execute();

    const modelResult = await db.insert(assetModelsTable)
      .values(testAssetModel)
      .returning()
      .execute();

    const assetResult = await db.insert(assetsTable)
      .values({ ...testAsset, model_id: modelResult[0].id })
      .returning()
      .execute();

    const assignmentInput: AssignAssetInput = {
      asset_id: assetResult[0].id,
      user_id: userResult[0].id,
      notes: 'Database verification test'
    };

    // Perform assignment
    const result = await assignAsset(assignmentInput, adminResult[0].id);

    // Verify assignment exists in database
    const assignments = await db.select()
      .from(assetAssignmentsTable)
      .where(eq(assetAssignmentsTable.id, result.id))
      .execute();

    expect(assignments).toHaveLength(1);
    expect(assignments[0].asset_id).toEqual(assetResult[0].id);
    expect(assignments[0].user_id).toEqual(userResult[0].id);
    expect(assignments[0].assigned_by).toEqual(adminResult[0].id);
    expect(assignments[0].notes).toEqual('Database verification test');
    expect(assignments[0].unassigned_at).toBeNull();
  });

  it('should throw error when asset does not exist', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable)
      .values({ id: 'user-4', ...testUser })
      .returning()
      .execute();

    const adminResult = await db.insert(usersTable)
      .values({ id: 'admin-4', ...testAdmin })
      .returning()
      .execute();

    const assignmentInput: AssignAssetInput = {
      asset_id: 999,
      user_id: userResult[0].id,
      notes: null
    };

    await expect(assignAsset(assignmentInput, adminResult[0].id))
      .rejects.toThrow(/asset not found/i);
  });

  it('should throw error when user does not exist', async () => {
    // Create prerequisite data
    const adminResult = await db.insert(usersTable)
      .values({ id: 'admin-5', ...testAdmin })
      .returning()
      .execute();

    const modelResult = await db.insert(assetModelsTable)
      .values(testAssetModel)
      .returning()
      .execute();

    const assetResult = await db.insert(assetsTable)
      .values({ ...testAsset, model_id: modelResult[0].id })
      .returning()
      .execute();

    const assignmentInput: AssignAssetInput = {
      asset_id: assetResult[0].id,
      user_id: 'nonexistent-user',
      notes: null
    };

    await expect(assignAsset(assignmentInput, adminResult[0].id))
      .rejects.toThrow(/user not found/i);
  });

  it('should throw error when assigning user does not exist', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable)
      .values({ id: 'user-6', ...testUser })
      .returning()
      .execute();

    const modelResult = await db.insert(assetModelsTable)
      .values(testAssetModel)
      .returning()
      .execute();

    const assetResult = await db.insert(assetsTable)
      .values({ ...testAsset, model_id: modelResult[0].id })
      .returning()
      .execute();

    const assignmentInput: AssignAssetInput = {
      asset_id: assetResult[0].id,
      user_id: userResult[0].id,
      notes: null
    };

    await expect(assignAsset(assignmentInput, 'nonexistent-admin'))
      .rejects.toThrow(/assigning user not found/i);
  });

  it('should throw error when asset is not in stock', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable)
      .values({ id: 'user-7', ...testUser })
      .returning()
      .execute();

    const adminResult = await db.insert(usersTable)
      .values({ id: 'admin-7', ...testAdmin })
      .returning()
      .execute();

    const modelResult = await db.insert(assetModelsTable)
      .values(testAssetModel)
      .returning()
      .execute();

    // Create asset with 'Assigned' status
    const assetResult = await db.insert(assetsTable)
      .values({ 
        ...testAsset, 
        model_id: modelResult[0].id,
        status: 'Assigned'
      })
      .returning()
      .execute();

    const assignmentInput: AssignAssetInput = {
      asset_id: assetResult[0].id,
      user_id: userResult[0].id,
      notes: null
    };

    await expect(assignAsset(assignmentInput, adminResult[0].id))
      .rejects.toThrow(/asset is not available for assignment/i);
  });

  it('should throw error when asset already has active assignment', async () => {
    // Create prerequisite data
    const user1Result = await db.insert(usersTable)
      .values({ id: 'user-8a', ...testUser })
      .returning()
      .execute();

    const user2Result = await db.insert(usersTable)
      .values({ id: 'user-8b', email: 'user2@example.com', name: 'Test User 2', role: 'User' })
      .returning()
      .execute();

    const adminResult = await db.insert(usersTable)
      .values({ id: 'admin-8', ...testAdmin })
      .returning()
      .execute();

    const modelResult = await db.insert(assetModelsTable)
      .values(testAssetModel)
      .returning()
      .execute();

    const assetResult = await db.insert(assetsTable)
      .values({ ...testAsset, model_id: modelResult[0].id })
      .returning()
      .execute();

    // Create existing active assignment
    await db.insert(assetAssignmentsTable)
      .values({
        asset_id: assetResult[0].id,
        user_id: user1Result[0].id,
        assigned_by: adminResult[0].id,
        notes: 'First assignment'
      })
      .execute();

    const assignmentInput: AssignAssetInput = {
      asset_id: assetResult[0].id,
      user_id: user2Result[0].id,
      notes: null
    };

    await expect(assignAsset(assignmentInput, adminResult[0].id))
      .rejects.toThrow(/asset is already assigned to another user/i);
  });
});
