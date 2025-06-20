
import { type ActivityLog } from '../schema';

export declare function getActivityLog(limit?: number, offset?: number): Promise<{
  activities: ActivityLog[];
  total: number;
}>;
