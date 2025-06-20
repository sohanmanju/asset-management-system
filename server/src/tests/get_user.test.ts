
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { getUser } from '../handlers/get_user';

// Test user data
const testUser: CreateUserInput = {
  email: 'test@example.com',
  name: 'Test User',
  role: 'User'
};

describe('getUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return user when found', async () => {
    // Create test user
    const insertResult = await db.insert(usersTable)
      .values({
        id: 'test-user-123',
        email: testUser.email,
        name: testUser.name,
        role: testUser.role
      })
      .returning()
      .execute();

    const createdUser = insertResult[0];

    // Test retrieval
    const result = await getUser('test-user-123');

    expect(result).not.toBeNull();
    expect(result!.id).toEqual('test-user-123');
    expect(result!.email).toEqual('test@example.com');
    expect(result!.name).toEqual('Test User');
    expect(result!.role).toEqual('User');
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should return null when user not found', async () => {
    const result = await getUser('non-existent-id');

    expect(result).toBeNull();
  });

  it('should return correct user from multiple users', async () => {
    // Create multiple users
    await db.insert(usersTable)
      .values([
        {
          id: 'user-1',
          email: 'user1@example.com',
          name: 'User One',
          role: 'User'
        },
        {
          id: 'user-2',
          email: 'user2@example.com',
          name: 'User Two',
          role: 'Admin'
        },
        {
          id: 'user-3',
          email: 'user3@example.com',
          name: 'User Three',
          role: 'User'
        }
      ])
      .execute();

    // Test retrieving specific user
    const result = await getUser('user-2');

    expect(result).not.toBeNull();
    expect(result!.id).toEqual('user-2');
    expect(result!.email).toEqual('user2@example.com');
    expect(result!.name).toEqual('User Two');
    expect(result!.role).toEqual('Admin');
  });
});
