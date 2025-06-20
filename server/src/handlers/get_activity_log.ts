
import { db } from '../db';
import { activityLogTable } from '../db/schema';
import { type ActivityLog } from '../schema';
import { desc, count } from 'drizzle-orm';

export const getActivityLog = async (limit: number = 50, offset: number = 0): Promise<{
  activities: ActivityLog[];
  total: number;
}> => {
  try {
    // Get total count
    const totalResult = await db.select({ count: count() })
      .from(activityLogTable)
      .execute();
    
    const total = totalResult[0].count;

    // Get paginated activities ordered by most recent first
    const rawActivities = await db.select()
      .from(activityLogTable)
      .orderBy(desc(activityLogTable.created_at))
      .limit(limit)
      .offset(offset)
      .execute();

    // Transform metadata field from unknown to string | null
    const activities = rawActivities.map(activity => ({
      ...activity,
      metadata: activity.metadata as string | null
    }));

    return {
      activities,
      total
    };
  } catch (error) {
    console.error('Activity log retrieval failed:', error);
    throw error;
  }
};
