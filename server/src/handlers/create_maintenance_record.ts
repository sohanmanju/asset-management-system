
import { type CreateMaintenanceRecordInput, type MaintenanceRecord } from '../schema';

export declare function createMaintenanceRecord(input: CreateMaintenanceRecordInput, userId: string): Promise<MaintenanceRecord>;
