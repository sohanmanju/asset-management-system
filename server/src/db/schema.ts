
import { 
  serial, 
  text, 
  pgTable, 
  timestamp, 
  numeric, 
  integer, 
  pgEnum,
  varchar,
  jsonb
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const assetCategoryEnum = pgEnum('asset_category', ['Laptops', 'Monitors', 'Keyboards', 'Accessories']);
export const assetStatusEnum = pgEnum('asset_status', ['In Stock', 'Assigned', 'Under Maintenance', 'Retired']);
export const userRoleEnum = pgEnum('user_role', ['Admin', 'User']);
export const maintenanceStatusEnum = pgEnum('maintenance_status', ['Scheduled', 'In Progress', 'Completed', 'Cancelled']);
export const activityTypeEnum = pgEnum('activity_type', ['Asset Created', 'Asset Updated', 'Asset Assigned', 'Asset Unassigned', 'Asset Retired', 'Maintenance Scheduled', 'Maintenance Completed', 'Asset Disposed']);

// Users table
export const usersTable = pgTable('users', {
  id: varchar('id', { length: 255 }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull().default('User'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Asset Models table
export const assetModelsTable = pgTable('asset_models', {
  id: serial('id').primaryKey(),
  manufacturer: varchar('manufacturer', { length: 255 }).notNull(),
  model_number: varchar('model_number', { length: 255 }).notNull(),
  category: assetCategoryEnum('category').notNull(),
  specs: text('specs'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Assets table
export const assetsTable = pgTable('assets', {
  id: serial('id').primaryKey(),
  asset_id: varchar('asset_id', { length: 255 }).notNull().unique(),
  model_id: integer('model_id').notNull(),
  status: assetStatusEnum('status').notNull().default('In Stock'),
  assigned_to: varchar('assigned_to', { length: 255 }),
  purchase_date: timestamp('purchase_date'),
  warranty_expiry: timestamp('warranty_expiry'),
  location: varchar('location', { length: 255 }),
  notes: text('notes'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Asset Assignments table
export const assetAssignmentsTable = pgTable('asset_assignments', {
  id: serial('id').primaryKey(),
  asset_id: integer('asset_id').notNull(),
  user_id: varchar('user_id', { length: 255 }).notNull(),
  assigned_by: varchar('assigned_by', { length: 255 }).notNull(),
  assigned_at: timestamp('assigned_at').defaultNow().notNull(),
  unassigned_at: timestamp('unassigned_at'),
  notes: text('notes')
});

// Maintenance Records table
export const maintenanceRecordsTable = pgTable('maintenance_records', {
  id: serial('id').primaryKey(),
  asset_id: integer('asset_id').notNull(),
  scheduled_date: timestamp('scheduled_date').notNull(),
  completed_date: timestamp('completed_date'),
  description: text('description').notNull(),
  performed_by: varchar('performed_by', { length: 255 }),
  cost: numeric('cost', { precision: 10, scale: 2 }),
  status: maintenanceStatusEnum('status').notNull().default('Scheduled'),
  notes: text('notes'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Asset Disposals table
export const assetDisposalsTable = pgTable('asset_disposals', {
  id: serial('id').primaryKey(),
  asset_id: integer('asset_id').notNull(),
  disposal_date: timestamp('disposal_date').notNull(),
  disposal_method: varchar('disposal_method', { length: 255 }).notNull(),
  cost: numeric('cost', { precision: 10, scale: 2 }),
  disposed_by: varchar('disposed_by', { length: 255 }).notNull(),
  notes: text('notes'),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Activity Log table
export const activityLogTable = pgTable('activity_log', {
  id: serial('id').primaryKey(),
  activity_type: activityTypeEnum('activity_type').notNull(),
  entity_type: varchar('entity_type', { length: 100 }).notNull(),
  entity_id: varchar('entity_id', { length: 255 }).notNull(),
  user_id: varchar('user_id', { length: 255 }).notNull(),
  description: text('description').notNull(),
  metadata: jsonb('metadata'),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  assignedAssets: many(assetsTable),
  assignments: many(assetAssignmentsTable),
  activityLogs: many(activityLogTable)
}));

export const assetModelsRelations = relations(assetModelsTable, ({ many }) => ({
  assets: many(assetsTable)
}));

export const assetsRelations = relations(assetsTable, ({ one, many }) => ({
  model: one(assetModelsTable, {
    fields: [assetsTable.model_id],
    references: [assetModelsTable.id]
  }),
  assignedUser: one(usersTable, {
    fields: [assetsTable.assigned_to],
    references: [usersTable.id]
  }),
  assignments: many(assetAssignmentsTable),
  maintenanceRecords: many(maintenanceRecordsTable),
  disposal: one(assetDisposalsTable)
}));

export const assetAssignmentsRelations = relations(assetAssignmentsTable, ({ one }) => ({
  asset: one(assetsTable, {
    fields: [assetAssignmentsTable.asset_id],
    references: [assetsTable.id]
  }),
  user: one(usersTable, {
    fields: [assetAssignmentsTable.user_id],
    references: [usersTable.id]
  }),
  assignedBy: one(usersTable, {
    fields: [assetAssignmentsTable.assigned_by],
    references: [usersTable.id]
  })
}));

export const maintenanceRecordsRelations = relations(maintenanceRecordsTable, ({ one }) => ({
  asset: one(assetsTable, {
    fields: [maintenanceRecordsTable.asset_id],
    references: [assetsTable.id]
  }),
  performedBy: one(usersTable, {
    fields: [maintenanceRecordsTable.performed_by],
    references: [usersTable.id]
  })
}));

export const assetDisposalsRelations = relations(assetDisposalsTable, ({ one }) => ({
  asset: one(assetsTable, {
    fields: [assetDisposalsTable.asset_id],
    references: [assetsTable.id]
  }),
  disposedBy: one(usersTable, {
    fields: [assetDisposalsTable.disposed_by],
    references: [usersTable.id]
  })
}));

export const activityLogRelations = relations(activityLogTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [activityLogTable.user_id],
    references: [usersTable.id]
  })
}));

// Export all tables
export const tables = {
  users: usersTable,
  assetModels: assetModelsTable,
  assets: assetsTable,
  assetAssignments: assetAssignmentsTable,
  maintenanceRecords: maintenanceRecordsTable,
  assetDisposals: assetDisposalsTable,
  activityLog: activityLogTable
};
