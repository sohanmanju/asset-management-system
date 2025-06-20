
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { activityLogTable, usersTable } from '../db/schema';
import { getActivityLog } from '../handlers/get_activity_log';
import type { ActivityType } from '../schema';

describe('getActivityLog', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty results when no activities exist', async () => {
    const result = await getActivityLog();

    expect(result.activities).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('should return activities with pagination', async () => {
    // Create test user first
    await db.insert(usersTable).values({
      id: 'user1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'User'
    }).execute();

    // Create test activities with distinct timestamps to ensure proper ordering
    const baseTime = new Date();
    const testActivities = [
      {
        activity_type: 'Asset Created' as ActivityType,
        entity_type: 'Asset',
        entity_id: '1',
        user_id: 'user1',
        description: 'Asset LAPTOP001 was created',
        metadata: null,
        created_at: new Date(baseTime.getTime() + 1000) // +1 second
      },
      {
        activity_type: 'Asset Assigned' as ActivityType,
        entity_type: 'Asset',
        entity_id: '1',
        user_id: 'user1',
        description: 'Asset LAPTOP001 was assigned to user1',
        metadata: null,
        created_at: new Date(baseTime.getTime() + 2000) // +2 seconds
      },
      {
        activity_type: 'Asset Updated' as ActivityType,
        entity_type: 'Asset',
        entity_id: '1',
        user_id: 'user1',
        description: 'Asset LAPTOP001 was updated',
        metadata: null,
        created_at: new Date(baseTime.getTime() + 3000) // +3 seconds
      }
    ];

    await db.insert(activityLogTable).values(testActivities).execute();

    const result = await getActivityLog(2, 0);

    expect(result.activities).toHaveLength(2);
    expect(result.total).toBe(3);
    
    // Verify ordering (most recent first)
    expect(result.activities[0].activity_type).toBe('Asset Updated');
    expect(result.activities[1].activity_type).toBe('Asset Assigned');
    
    // Verify activity structure
    expect(result.activities[0].id).toBeDefined();
    expect(result.activities[0].entity_type).toBe('Asset');
    expect(result.activities[0].entity_id).toBe('1');
    expect(result.activities[0].user_id).toBe('user1');
    expect(result.activities[0].description).toBe('Asset LAPTOP001 was updated');
    expect(result.activities[0].created_at).toBeInstanceOf(Date);
  });

  it('should handle pagination correctly', async () => {
    // Create test user first
    await db.insert(usersTable).values({
      id: 'user1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'User'
    }).execute();

    // Create 5 test activities with distinct timestamps
    const baseTime = new Date();
    const testActivities = Array.from({ length: 5 }, (_, i) => ({
      activity_type: 'Asset Created' as ActivityType,
      entity_type: 'Asset',
      entity_id: `${i + 1}`,
      user_id: 'user1',
      description: `Asset ${i + 1} was created`,
      metadata: null,
      created_at: new Date(baseTime.getTime() + (i * 1000)) // Each activity 1 second apart
    }));

    await db.insert(activityLogTable).values(testActivities).execute();

    // Test first page
    const firstPage = await getActivityLog(2, 0);
    expect(firstPage.activities).toHaveLength(2);
    expect(firstPage.total).toBe(5);

    // Test second page
    const secondPage = await getActivityLog(2, 2);
    expect(secondPage.activities).toHaveLength(2);
    expect(secondPage.total).toBe(5);

    // Test third page
    const thirdPage = await getActivityLog(2, 4);
    expect(thirdPage.activities).toHaveLength(1);
    expect(thirdPage.total).toBe(5);

    // Verify no overlap between pages
    const firstPageIds = firstPage.activities.map(a => a.id);
    const secondPageIds = secondPage.activities.map(a => a.id);
    const thirdPageIds = thirdPage.activities.map(a => a.id);

    expect(firstPageIds.some(id => secondPageIds.includes(id))).toBe(false);
    expect(secondPageIds.some(id => thirdPageIds.includes(id))).toBe(false);
  });

  it('should use default pagination parameters', async () => {
    // Create test user first
    await db.insert(usersTable).values({
      id: 'user1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'User'
    }).execute();

    // Create test activity
    await db.insert(activityLogTable).values({
      activity_type: 'Asset Created' as ActivityType,
      entity_type: 'Asset',
      entity_id: '1',
      user_id: 'user1',
      description: 'Asset was created',
      metadata: null
    }).execute();

    const result = await getActivityLog();

    expect(result.activities).toHaveLength(1);
    expect(result.total).toBe(1);
  });
});
