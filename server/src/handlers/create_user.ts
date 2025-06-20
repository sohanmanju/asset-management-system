
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type User } from '../schema';
import { nanoid } from 'nanoid';

export const createUser = async (input: CreateUserInput): Promise<User> => {
  try {
    // Generate a unique ID for the user
    const userId = nanoid();

    // Insert user record
    const result = await db.insert(usersTable)
      .values({
        id: userId,
        email: input.email,
        name: input.name,
        role: input.role
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('User creation failed:', error);
    throw error;
  }
};
