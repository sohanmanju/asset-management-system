
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { assetModelsTable, activityLogTable, usersTable } from '../db/schema';
import { type CreateAssetModelInput } from '../schema';
import { createAssetModel } from '../handlers/create_asset_model';
import { eq } from 'drizzle-orm';

// Test user data
const testUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'Admin' as const
};

// Test input data
const testInput: CreateAssetModelInput = {
  manufacturer: 'Dell',
  model_number: 'Latitude 7420',
  category: 'Laptops',
  specs: '16GB RAM, 512GB SSD, Intel i7'
};

describe('createAssetModel', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create an asset model', async () => {
    // Create test user first
    await db.insert(usersTable)
      .values(testUser)
      .execute();

    const result = await createAssetModel(testInput, testUser.id);

    // Basic field validation
    expect(result.manufacturer).toEqual('Dell');
    expect(result.model_number).toEqual('Latitude 7420');
    expect(result.category).toEqual('Laptops');
    expect(result.specs).toEqual('16GB RAM, 512GB SSD, Intel i7');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save asset model to database', async () => {
    // Create test user first
    await db.insert(usersTable)
      .values(testUser)
      .execute();

    const result = await createAssetModel(testInput, testUser.id);

    // Verify asset model was saved
    const assetModels = await db.select()
      .from(assetModelsTable)
      .where(eq(assetModelsTable.id, result.id))
      .execute();

    expect(assetModels).toHaveLength(1);
    expect(assetModels[0].manufacturer).toEqual('Dell');
    expect(assetModels[0].model_number).toEqual('Latitude 7420');
    expect(assetModels[0].category).toEqual('Laptops');
    expect(assetModels[0].specs).toEqual('16GB RAM, 512GB SSD, Intel i7');
    expect(assetModels[0].created_at).toBeInstanceOf(Date);
    expect(assetModels[0].updated_at).toBeInstanceOf(Date);
  });

  it('should log activity when asset model is created', async () => {
    // Create test user first
    await db.insert(usersTable)
      .values(testUser)
      .execute();

    const result = await createAssetModel(testInput, testUser.id);

    // Verify activity log was created
    const activityLogs = await db.select()
      .from(activityLogTable)
      .where(eq(activityLogTable.entity_id, result.id.toString()))
      .execute();

    expect(activityLogs).toHaveLength(1);
    expect(activityLogs[0].activity_type).toEqual('Asset Created');
    expect(activityLogs[0].entity_type).toEqual('AssetModel');
    expect(activityLogs[0].entity_id).toEqual(result.id.toString());
    expect(activityLogs[0].user_id).toEqual(testUser.id);
    expect(activityLogs[0].description).toEqual('Asset model created: Dell Latitude 7420');
    
    // Since metadata is JSONB, it's stored as a parsed object, not a string
    expect(activityLogs[0].metadata).toEqual({
      manufacturer: 'Dell',
      model_number: 'Latitude 7420',
      category: 'Laptops'
    });
    expect(activityLogs[0].created_at).toBeInstanceOf(Date);
  });

  it('should handle asset model with null specs', async () => {
    // Create test user first
    await db.insert(usersTable)
      .values(testUser)
      .execute();

    const inputWithoutSpecs: CreateAssetModelInput = {
      manufacturer: 'Apple',
      model_number: 'MacBook Pro 14',
      category: 'Laptops',
      specs: null
    };

    const result = await createAssetModel(inputWithoutSpecs, testUser.id);

    expect(result.manufacturer).toEqual('Apple');
    expect(result.model_number).toEqual('MacBook Pro 14');
    expect(result.category).toEqual('Laptops');
    expect(result.specs).toBeNull();
    expect(result.id).toBeDefined();
  });

  it('should handle different asset categories', async () => {
    // Create test user first
    await db.insert(usersTable)
      .values(testUser)
      .execute();

    const monitorInput: CreateAssetModelInput = {
      manufacturer: 'Samsung',
      model_number: 'U28E590D',
      category: 'Monitors',
      specs: '28" 4K UHD, 1ms response time'
    };

    const result = await createAssetModel(monitorInput, testUser.id);

    expect(result.manufacturer).toEqual('Samsung');
    expect(result.model_number).toEqual('U28E590D');
    expect(result.category).toEqual('Monitors');
    expect(result.specs).toEqual('28" 4K UHD, 1ms response time');
  });
});
