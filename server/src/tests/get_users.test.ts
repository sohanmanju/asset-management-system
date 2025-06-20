
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { getUsers } from '../handlers/get_users';

describe('getUsers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no users exist', async () => {
    const result = await getUsers();
    expect(result).toEqual([]);
  });

  it('should return all users', async () => {
    // Create test users
    const testUsers: CreateUserInput[] = [
      {
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'Admin'
      },
      {
        email: 'user@example.com',
        name: 'Regular User',
        role: 'User'
      }
    ];

    // Insert users directly
    await db.insert(usersTable)
      .values([
        {
          id: 'admin-1',
          email: testUsers[0].email,
          name: testUsers[0].name,
          role: testUsers[0].role
        },
        {
          id: 'user-1',
          email: testUsers[1].email,
          name: testUsers[1].name,
          role: testUsers[1].role
        }
      ])
      .execute();

    const result = await getUsers();

    expect(result).toHaveLength(2);
    
    // Verify first user
    const adminUser = result.find(u => u.email === 'admin@example.com');
    expect(adminUser).toBeDefined();
    expect(adminUser!.name).toEqual('Admin User');
    expect(adminUser!.role).toEqual('Admin');
    expect(adminUser!.id).toEqual('admin-1');
    expect(adminUser!.created_at).toBeInstanceOf(Date);
    expect(adminUser!.updated_at).toBeInstanceOf(Date);

    // Verify second user
    const regularUser = result.find(u => u.email === 'user@example.com');
    expect(regularUser).toBeDefined();
    expect(regularUser!.name).toEqual('Regular User');
    expect(regularUser!.role).toEqual('User');
    expect(regularUser!.id).toEqual('user-1');
    expect(regularUser!.created_at).toBeInstanceOf(Date);
    expect(regularUser!.updated_at).toBeInstanceOf(Date);
  });

  it('should return users with proper field types', async () => {
    // Insert a single user
    await db.insert(usersTable)
      .values({
        id: 'test-user',
        email: 'test@example.com',
        name: 'Test User',
        role: 'User'
      })
      .execute();

    const result = await getUsers();

    expect(result).toHaveLength(1);
    const user = result[0];
    
    // Verify all field types
    expect(typeof user.id).toBe('string');
    expect(typeof user.email).toBe('string');
    expect(typeof user.name).toBe('string');
    expect(typeof user.role).toBe('string');
    expect(user.created_at).toBeInstanceOf(Date);
    expect(user.updated_at).toBeInstanceOf(Date);
  });
});
