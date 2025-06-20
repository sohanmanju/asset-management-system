
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { assetModelsTable } from '../db/schema';
import { type CreateAssetModelInput } from '../schema';
import { getAssetModels } from '../handlers/get_asset_models';

// Test asset model inputs
const testAssetModel1: CreateAssetModelInput = {
  manufacturer: 'Dell',
  model_number: 'Latitude-5520',
  category: 'Laptops',
  specs: '16GB RAM, 512GB SSD, Intel i7'
};

const testAssetModel2: CreateAssetModelInput = {
  manufacturer: 'HP',
  model_number: 'ProBook-450',
  category: 'Laptops',
  specs: '8GB RAM, 256GB SSD, Intel i5'
};

const testAssetModel3: CreateAssetModelInput = {
  manufacturer: 'Samsung',
  model_number: 'M27F390',
  category: 'Monitors',
  specs: null
};

describe('getAssetModels', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no asset models exist', async () => {
    const result = await getAssetModels();

    expect(result).toEqual([]);
  });

  it('should return all asset models', async () => {
    // Create test asset models
    await db.insert(assetModelsTable).values([
      testAssetModel1,
      testAssetModel2,
      testAssetModel3
    ]).execute();

    const result = await getAssetModels();

    expect(result).toHaveLength(3);
    
    // Check first asset model
    const dellModel = result.find(model => model.manufacturer === 'Dell');
    expect(dellModel).toBeDefined();
    expect(dellModel!.model_number).toEqual('Latitude-5520');
    expect(dellModel!.category).toEqual('Laptops');
    expect(dellModel!.specs).toEqual('16GB RAM, 512GB SSD, Intel i7');
    expect(dellModel!.id).toBeDefined();
    expect(dellModel!.created_at).toBeInstanceOf(Date);
    expect(dellModel!.updated_at).toBeInstanceOf(Date);

    // Check HP model
    const hpModel = result.find(model => model.manufacturer === 'HP');
    expect(hpModel).toBeDefined();
    expect(hpModel!.model_number).toEqual('ProBook-450');
    expect(hpModel!.category).toEqual('Laptops');

    // Check Samsung model with null specs
    const samsungModel = result.find(model => model.manufacturer === 'Samsung');
    expect(samsungModel).toBeDefined();
    expect(samsungModel!.model_number).toEqual('M27F390');
    expect(samsungModel!.category).toEqual('Monitors');
    expect(samsungModel!.specs).toBeNull();
  });

  it('should return asset models with correct data types', async () => {
    await db.insert(assetModelsTable).values(testAssetModel1).execute();

    const result = await getAssetModels();

    expect(result).toHaveLength(1);
    const model = result[0];
    
    expect(typeof model.id).toBe('number');
    expect(typeof model.manufacturer).toBe('string');
    expect(typeof model.model_number).toBe('string');
    expect(typeof model.category).toBe('string');
    expect(model.specs === null || typeof model.specs === 'string').toBe(true);
    expect(model.created_at).toBeInstanceOf(Date);
    expect(model.updated_at).toBeInstanceOf(Date);
  });
});
