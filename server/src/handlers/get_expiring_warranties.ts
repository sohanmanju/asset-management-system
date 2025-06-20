
import { type AssetWithRelations } from '../schema';

export declare function getExpiringWarranties(days?: number): Promise<AssetWithRelations[]>;
