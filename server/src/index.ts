
import { initTRPC, TRPCError } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import { 
  createUserInputSchema,
  createAssetModelInputSchema,
  createAssetInputSchema,
  updateAssetInputSchema,
  assetSearchInputSchema,
  assignAssetInputSchema,
  unassignAssetInputSchema,
  createMaintenanceRecordInputSchema,
  updateMaintenanceRecordInputSchema,
  disposeAssetInputSchema
} from './schema';

// Import handlers
import { createUser } from './handlers/create_user';
import { getUsers } from './handlers/get_users';
import { getUser } from './handlers/get_user';
import { createAssetModel } from './handlers/create_asset_model';
import { getAssetModels } from './handlers/get_asset_models';
import { createAsset } from './handlers/create_asset';
import { getAssets } from './handlers/get_assets';
import { getAsset } from './handlers/get_asset';
import { updateAsset } from './handlers/update_asset';
import { searchAssets } from './handlers/search_assets';
import { assignAsset } from './handlers/assign_asset';
import { unassignAsset } from './handlers/unassign_asset';
import { getUserAssets } from './handlers/get_user_assets';
import { createMaintenanceRecord } from './handlers/create_maintenance_record';
import { getMaintenanceRecords } from './handlers/get_maintenance_records';
import { updateMaintenanceRecord } from './handlers/update_maintenance_record';
import { disposeAsset } from './handlers/dispose_asset';
import { getActivityLog } from './handlers/get_activity_log';
import { retireAsset } from './handlers/retire_asset';
import { getUpcomingMaintenance } from './handlers/get_upcoming_maintenance';
import { getExpiringWarranties } from './handlers/get_expiring_warranties';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

// Mock authentication middleware - replace with actual auth
const authenticatedProcedure = publicProcedure.use(({ next, ctx }) => {
  // Mock user - replace with actual authentication
  const mockUser = { id: 'user_123', role: 'Admin' as const };
  return next({
    ctx: {
      ...ctx,
      user: mockUser,
    },
  });
});

const adminProcedure = authenticatedProcedure.use(({ next, ctx }) => {
  if (ctx.user.role !== 'Admin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admin access required',
    });
  }
  return next();
});

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // User management
  createUser: adminProcedure
    .input(createUserInputSchema)
    .mutation(({ input }) => createUser(input)),
  
  getUsers: adminProcedure
    .query(() => getUsers()),
  
  getUser: authenticatedProcedure
    .input(z.string())
    .query(({ input }) => getUser(input)),

  // Asset models
  createAssetModel: adminProcedure
    .input(createAssetModelInputSchema)
    .mutation(({ input, ctx }) => createAssetModel(input, ctx.user.id)),
  
  getAssetModels: authenticatedProcedure
    .query(() => getAssetModels()),

  // Assets
  createAsset: adminProcedure
    .input(createAssetInputSchema)
    .mutation(({ input, ctx }) => createAsset(input, ctx.user.id)),
  
  getAssets: authenticatedProcedure
    .query(() => getAssets()),
  
  getAsset: authenticatedProcedure
    .input(z.number())
    .query(({ input }) => getAsset(input)),
  
  updateAsset: adminProcedure
    .input(updateAssetInputSchema)
    .mutation(({ input, ctx }) => updateAsset(input, ctx.user.id)),
  
  searchAssets: authenticatedProcedure
    .input(assetSearchInputSchema)
    .query(({ input }) => searchAssets(input)),
  
  retireAsset: adminProcedure
    .input(z.number())
    .mutation(({ input, ctx }) => retireAsset(input, ctx.user.id)),

  // Asset assignments
  assignAsset: adminProcedure
    .input(assignAssetInputSchema)
    .mutation(({ input, ctx }) => assignAsset(input, ctx.user.id)),
  
  unassignAsset: adminProcedure
    .input(unassignAssetInputSchema)
    .mutation(({ input, ctx }) => unassignAsset(input, ctx.user.id)),
  
  getUserAssets: authenticatedProcedure
    .input(z.string().optional())
    .query(({ input, ctx }) => getUserAssets(input || ctx.user.id)),

  // Maintenance
  createMaintenanceRecord: adminProcedure
    .input(createMaintenanceRecordInputSchema)
    .mutation(({ input, ctx }) => createMaintenanceRecord(input, ctx.user.id)),
  
  getMaintenanceRecords: authenticatedProcedure
    .input(z.number().optional())
    .query(({ input }) => getMaintenanceRecords(input)),
  
  updateMaintenanceRecord: adminProcedure
    .input(updateMaintenanceRecordInputSchema)
    .mutation(({ input, ctx }) => updateMaintenanceRecord(input, ctx.user.id)),
  
  getUpcomingMaintenance: authenticatedProcedure
    .input(z.number().default(30))
    .query(({ input }) => getUpcomingMaintenance(input)),

  // Asset disposal
  disposeAsset: adminProcedure
    .input(disposeAssetInputSchema)
    .mutation(({ input, ctx }) => disposeAsset(input, ctx.user.id)),

  // Activity log
  getActivityLog: adminProcedure
    .input(z.object({
      limit: z.number().default(50),
      offset: z.number().default(0)
    }))
    .query(({ input }) => getActivityLog(input.limit, input.offset)),

  // Alerts and notifications
  getExpiringWarranties: authenticatedProcedure
    .input(z.number().default(30))
    .query(({ input }) => getExpiringWarranties(input)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`Asset Management System TRPC server listening at port: ${port}`);
}

start();
