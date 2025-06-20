
import { type DisposeAssetInput, type AssetDisposal } from '../schema';

export declare function disposeAsset(input: DisposeAssetInput, disposedBy: string): Promise<AssetDisposal>;
