
import { type CreateAssetInput, type AssetWithRelations } from '../schema';

export declare function createAsset(input: CreateAssetInput, userId: string): Promise<AssetWithRelations>;
