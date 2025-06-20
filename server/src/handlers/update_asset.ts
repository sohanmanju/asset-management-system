
import { type UpdateAssetInput, type AssetWithRelations } from '../schema';

export declare function updateAsset(input: UpdateAssetInput, userId: string): Promise<AssetWithRelations>;
