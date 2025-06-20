
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { createUser } from '../handlers/create_user';
import { eq } from 'drizzle-orm';

// Test input data
const testUserInput: CreateUserInput = {
  email: 'test@example.com',
  name: 'Test User',
  role: 'User'
};

const testAdminInput: CreateUserInput = {
  email: 'admin@example.com',
  name: 'Admin User',
  role: 'Admin'
};

describe('createUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a user with User role', async () => {
    const result = await createUser(testUserInput);

    // Basic field validation
    expect(result.email).toEqual('test@example.com');
    expect(result.name).toEqual('Test User');
    expect(result.role).toEqual('User');
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('string');
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a user with Admin role', async () => {
    const result = await createUser(testAdminInput);

    expect(result.email).toEqual('admin@example.com');
    expect(result.name).toEqual('Admin User');
    expect(result.role).toEqual('Admin');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save user to database', async () => {
    const result = await createUser(testUserInput);

    // Query the database to verify the user was saved
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].email).toEqual('test@example.com');
    expect(users[0].name).toEqual('Test User');
    expect(users[0].role).toEqual('User');
    expect(users[0].created_at).toBeInstanceOf(Date);
    expect(users[0].updated_at).toBeInstanceOf(Date);
  });

  it('should generate unique IDs for different users', async () => {
    const user1 = await createUser(testUserInput);
    const user2 = await createUser({
      ...testUserInput,
      email: 'user2@example.com'
    });

    expect(user1.id).toBeDefined();
    expect(user2.id).toBeDefined();
    expect(user1.id).not.toEqual(user2.id);
  });

  it('should handle unique email constraint violation', async () => {
    // Create first user
    await createUser(testUserInput);

    // Try to create second user with same email
    await expect(createUser(testUserInput))
      .rejects
      .toThrow(/duplicate key value violates unique constraint|unique constraint/i);
  });
});
