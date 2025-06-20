
import { z } from 'zod';

// Enums
export const assetCategoryEnum = z.enum(['Laptops', 'Monitors', 'Keyboards', 'Accessories']);
export const assetStatusEnum = z.enum(['In Stock', 'Assigned', 'Under Maintenance', 'Retired']);
export const userRoleEnum = z.enum(['Admin', 'User']);
export const maintenanceStatusEnum = z.enum(['Scheduled', 'In Progress', 'Completed', 'Cancelled']);
export const activityTypeEnum = z.enum(['Asset Created', 'Asset Updated', 'Asset Assigned', 'Asset Unassigned', 'Asset Retired', 'Maintenance Scheduled', 'Maintenance Completed', 'Asset Disposed']);

// Types from enums
export type AssetCategory = z.infer<typeof assetCategoryEnum>;
export type AssetStatus = z.infer<typeof assetStatusEnum>;
export type UserRole = z.infer<typeof userRoleEnum>;
export type MaintenanceStatus = z.infer<typeof maintenanceStatusEnum>;
export type ActivityType = z.infer<typeof activityTypeEnum>;

// User schema
export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: userRoleEnum,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Asset Model schema
export const assetModelSchema = z.object({
  id: z.number(),
  manufacturer: z.string(),
  model_number: z.string(),
  category: assetCategoryEnum,
  specs: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type AssetModel = z.infer<typeof assetModelSchema>;

// Asset schema
export const assetSchema = z.object({
  id: z.number(),
  asset_id: z.string(),
  model_id: z.number(),
  status: assetStatusEnum,
  assigned_to: z.string().nullable(),
  purchase_date: z.coerce.date().nullable(),
  warranty_expiry: z.coerce.date().nullable(),
  location: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Asset = z.infer<typeof assetSchema>;

// Asset Assignment schema
export const assetAssignmentSchema = z.object({
  id: z.number(),
  asset_id: z.number(),
  user_id: z.string(),
  assigned_by: z.string(),
  assigned_at: z.coerce.date(),
  unassigned_at: z.coerce.date().nullable(),
  notes: z.string().nullable()
});

export type AssetAssignment = z.infer<typeof assetAssignmentSchema>;

// Maintenance Record schema
export const maintenanceRecordSchema = z.object({
  id: z.number(),
  asset_id: z.number(),
  scheduled_date: z.coerce.date(),
  completed_date: z.coerce.date().nullable(),
  description: z.string(),
  performed_by: z.string().nullable(),
  cost: z.number().nullable(),
  status: maintenanceStatusEnum,
  notes: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type MaintenanceRecord = z.infer<typeof maintenanceRecordSchema>;

// Asset Disposal schema
export const assetDisposalSchema = z.object({
  id: z.number(),
  asset_id: z.number(),
  disposal_date: z.coerce.date(),
  disposal_method: z.string(),
  cost: z.number().nullable(),
  disposed_by: z.string(),
  notes: z.string().nullable(),
  created_at: z.coerce.date()
});

export type AssetDisposal = z.infer<typeof assetDisposalSchema>;

// Activity Log schema
export const activityLogSchema = z.object({
  id: z.number(),
  activity_type: activityTypeEnum,
  entity_type: z.string(),
  entity_id: z.string(),
  user_id: z.string(),
  description: z.string(),
  metadata: z.string().nullable(),
  created_at: z.coerce.date()
});

export type ActivityLog = z.infer<typeof activityLogSchema>;

// Input schemas for creating entities
export const createUserInputSchema = z.object({
  email: z.string().email(),
  name: z.string(),
  role: userRoleEnum
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const createAssetModelInputSchema = z.object({
  manufacturer: z.string(),
  model_number: z.string(),
  category: assetCategoryEnum,
  specs: z.string().nullable()
});

export type CreateAssetModelInput = z.infer<typeof createAssetModelInputSchema>;

export const createAssetInputSchema = z.object({
  asset_id: z.string(),
  model_id: z.number(),
  purchase_date: z.coerce.date().nullable(),
  warranty_expiry: z.coerce.date().nullable(),
  location: z.string().nullable(),
  notes: z.string().nullable()
});

export type CreateAssetInput = z.infer<typeof createAssetInputSchema>;

export const assignAssetInputSchema = z.object({
  asset_id: z.number(),
  user_id: z.string(),
  notes: z.string().nullable()
});

export type AssignAssetInput = z.infer<typeof assignAssetInputSchema>;

export const unassignAssetInputSchema = z.object({
  asset_id: z.number(),
  notes: z.string().nullable()
});

export type UnassignAssetInput = z.infer<typeof unassignAssetInputSchema>;

export const createMaintenanceRecordInputSchema = z.object({
  asset_id: z.number(),
  scheduled_date: z.coerce.date(),
  description: z.string(),
  notes: z.string().nullable()
});

export type CreateMaintenanceRecordInput = z.infer<typeof createMaintenanceRecordInputSchema>;

export const updateMaintenanceRecordInputSchema = z.object({
  id: z.number(),
  completed_date: z.coerce.date().nullable(),
  performed_by: z.string().nullable(),
  cost: z.number().nullable(),
  status: maintenanceStatusEnum,
  notes: z.string().nullable()
});

export type UpdateMaintenanceRecordInput = z.infer<typeof updateMaintenanceRecordInputSchema>;

export const disposeAssetInputSchema = z.object({
  asset_id: z.number(),
  disposal_date: z.coerce.date(),
  disposal_method: z.string(),
  cost: z.number().nullable(),
  notes: z.string().nullable()
});

export type DisposeAssetInput = z.infer<typeof disposeAssetInputSchema>;

export const updateAssetInputSchema = z.object({
  id: z.number(),
  asset_id: z.string().optional(),
  model_id: z.number().optional(),
  status: assetStatusEnum.optional(),
  purchase_date: z.coerce.date().nullable().optional(),
  warranty_expiry: z.coerce.date().nullable().optional(),
  location: z.string().nullable().optional(),
  notes: z.string().nullable().optional()
});

export type UpdateAssetInput = z.infer<typeof updateAssetInputSchema>;

export const assetSearchInputSchema = z.object({
  category: assetCategoryEnum.optional(),
  status: assetStatusEnum.optional(),
  manufacturer: z.string().optional(),
  model_number: z.string().optional(),
  assigned_to: z.string().optional(),
  search: z.string().optional(),
  limit: z.number().int().positive().default(50),
  offset: z.number().int().nonnegative().default(0)
});

export type AssetSearchInput = z.infer<typeof assetSearchInputSchema>;

// Extended types with relations
export const assetWithRelationsSchema = assetSchema.extend({
  model: assetModelSchema,
  assigned_user: userSchema.nullable(),
  current_assignment: assetAssignmentSchema.nullable(),
  maintenance_records: z.array(maintenanceRecordSchema),
  disposal: assetDisposalSchema.nullable()
});

export type AssetWithRelations = z.infer<typeof assetWithRelationsSchema>;

export const userAssetsSchema = z.object({
  user: userSchema,
  current_assets: z.array(assetWithRelationsSchema),
  past_assignments: z.array(assetAssignmentSchema.extend({
    asset: assetWithRelationsSchema
  }))
});

export type UserAssets = z.infer<typeof userAssetsSchema>;
