
import { type MaintenanceRecord } from '../schema';

export declare function getUpcomingMaintenance(days?: number): Promise<MaintenanceRecord[]>;
