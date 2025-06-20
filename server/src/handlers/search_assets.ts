
import { type AssetSearchInput, type AssetWithRelations } from '../schema';

export declare function searchAssets(input: AssetSearchInput): Promise<{
  assets: AssetWithRelations[];
  total: number;
}>;
