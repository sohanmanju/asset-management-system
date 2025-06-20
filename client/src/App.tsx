
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CalendarIcon, SearchIcon, PlusIcon, SettingsIcon, AlertTriangleIcon, ClockIcon, UsersIcon, PackageIcon, ActivityIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { trpc } from '@/utils/trpc';
import type { 
  AssetWithRelations, 
  User, 
  AssetModel, 
  CreateAssetInput, 
  CreateAssetModelInput, 
  AssignAssetInput, 
  CreateMaintenanceRecordInput,
  MaintenanceRecord,
  ActivityLog,
  AssetSearchInput,
  AssetCategory,
  AssetStatus
} from '../../server/src/schema';

// Current user - this would come from your authentication system
const currentUser = { id: 'user_123', role: 'Admin' as const, name: 'Admin User', email: 'admin@company.com' };

function App() {
  const [assets, setAssets] = useState<AssetWithRelations[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [assetModels, setAssetModels] = useState<AssetModel[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [upcomingMaintenance, setUpcomingMaintenance] = useState<MaintenanceRecord[]>([]);
  const [expiringWarranties, setExpiringWarranties] = useState<AssetWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchFilters, setSearchFilters] = useState<AssetSearchInput>({
    search: '',
    category: undefined,
    status: undefined,
    limit: 50,
    offset: 0
  });

  // Form states
  const [assetForm, setAssetForm] = useState<CreateAssetInput>({
    asset_id: '',
    model_id: 0,
    purchase_date: null,
    warranty_expiry: null,
    location: null,
    notes: null
  });

  const [modelForm, setModelForm] = useState<CreateAssetModelInput>({
    manufacturer: '',
    model_number: '',
    category: 'Laptops',
    specs: null
  });

  const [assignmentForm, setAssignmentForm] = useState<AssignAssetInput>({
    asset_id: 0,
    user_id: '',
    notes: null
  });

  const [maintenanceForm, setMaintenanceForm] = useState<CreateMaintenanceRecordInput>({
    asset_id: 0,
    scheduled_date: new Date(),
    description: '',
    notes: null
  });

  const [selectedAsset, setSelectedAsset] = useState<AssetWithRelations | null>(null);

  // Load initial data
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [assetsData, usersData, modelsData, maintenanceData, activityData, upcomingData, warrantyData] = await Promise.all([
        trpc.getAssets.query(),
        trpc.getUsers.query(),
        trpc.getAssetModels.query(),
        trpc.getMaintenanceRecords.query(),
        trpc.getActivityLog.query({ limit: 20 }),
        trpc.getUpcomingMaintenance.query(30),
        trpc.getExpiringWarranties.query(30)
      ]);

      setAssets(assetsData);
      setUsers(usersData);
      setAssetModels(modelsData);
      setMaintenanceRecords(maintenanceData);
      setActivityLogs(activityData.activities);
      setUpcomingMaintenance(upcomingData);
      setExpiringWarranties(warrantyData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Search assets
  const searchAssets = useCallback(async () => {
    try {
      const result = await trpc.searchAssets.query(searchFilters);
      setAssets(result.assets);
    } catch (error) {
      console.error('Failed to search assets:', error);
    }
  }, [searchFilters]);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchAssets();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchAssets]);

  // Asset creation
  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      const newAsset = await trpc.createAsset.mutate(assetForm);
      setAssets((prev: AssetWithRelations[]) => [...prev, newAsset]);
      setAssetForm({
        asset_id: '',
        model_id: 0,
        purchase_date: null,
        warranty_expiry: null,
        location: null,
        notes: null
      });
    } catch (error) {
      console.error('Failed to create asset:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Asset model creation
  const handleCreateModel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      const newModel = await trpc.createAssetModel.mutate(modelForm);
      setAssetModels((prev: AssetModel[]) => [...prev, newModel]);
      setModelForm({
        manufacturer: '',
        model_number: '',
        category: 'Laptops',
        specs: null
      });
    } catch (error) {
      console.error('Failed to create asset model:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Asset assignment
  const handleAssignAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      await trpc.assignAsset.mutate(assignmentForm);
      await loadData(); // Refresh data
      setAssignmentForm({
        asset_id: 0,
        user_id: '',
        notes: null
      });
    } catch (error) {
      console.error('Failed to assign asset:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Maintenance record creation
  const handleCreateMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      const newRecord = await trpc.createMaintenanceRecord.mutate(maintenanceForm);
      setMaintenanceRecords((prev: MaintenanceRecord[]) => [...prev, newRecord]);
      setMaintenanceForm({
        asset_id: 0,
        scheduled_date: new Date(),
        description: '',
        notes: null
      });
    } catch (error) {
      console.error('Failed to create maintenance record:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Asset retirement
  const handleRetireAsset = async (assetId: number) => {
    try {
      setIsLoading(true);
      await trpc.retireAsset.mutate(assetId);
      await loadData(); // Refresh data
    } catch (error) {
      console.error('Failed to retire asset:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Status badge colors
  const getStatusColor = (status: AssetStatus) => {
    switch (status) {
      case 'In Stock': return 'bg-green-100 text-green-800';
      case 'Assigned': return 'bg-blue-100 text-blue-800';
      case 'Under Maintenance': return 'bg-yellow-100 text-yellow-800';
      case 'Retired': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryColor = (category: AssetCategory) => {
    switch (category) {
      case 'Laptops': return 'bg-purple-100 text-purple-800';
      case 'Monitors': return 'bg-indigo-100 text-indigo-800';
      case 'Keyboards': return 'bg-pink-100 text-pink-800';
      case 'Accessories': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Statistics
  const stats = useMemo(() => {
    const totalAssets = assets.length;
    const assignedAssets = assets.filter(a => a.status === 'Assigned').length;
    const availableAssets = assets.filter(a => a.status === 'In Stock').length;
    const maintenanceAssets = assets.filter(a => a.status === 'Under Maintenance').length;
    
    return {
      total: totalAssets,
      assigned: assignedAssets,
      available: availableAssets,
      maintenance: maintenanceAssets
    };
  }, [assets]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <PackageIcon className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Asset Management System</h1>
                <p className="text-gray-600">Manage your company's IT assets efficiently</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="outline" className="text-sm">
                {currentUser.role} - {currentUser.name}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
              <PackageIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assigned</CardTitle>
              <UsersIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.assigned}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available</CardTitle>
              <PackageIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.available}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Under Maintenance</CardTitle>
              <SettingsIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.maintenance}</div>
            </CardContent>
          </Card>
        </div>

        {/* Alert Cards */}
        {(upcomingMaintenance.length > 0 || expiringWarranties.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {upcomingMaintenance.length > 0 && (
              <Card className="border-yellow-200 bg-yellow-50">
                <CardHeader>
                  <CardTitle className="flex items-center text-yellow-800">
                    <ClockIcon className="h-5 w-5 mr-2" />
                    Upcoming Maintenance ({upcomingMaintenance.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {upcomingMaintenance.slice(0, 3).map((record: MaintenanceRecord) => (
                      <div key={record.id} className="flex justify-between text-sm">
                        <span>Asset #{record.asset_id}</span>
                        <span>{format(record.scheduled_date, 'MMM dd')}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {expiringWarranties.length > 0 && (
              <Card className="border-red-200 bg-red-50">
                <CardHeader>
                  <CardTitle className="flex items-center text-red-800">
                    <AlertTriangleIcon className="h-5 w-5 mr-2" />
                    Expiring Warranties ({expiringWarranties.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {expiringWarranties.slice(0, 3).map((asset: AssetWithRelations) => (
                      <div key={asset.id} className="flex justify-between text-sm">
                        <span>{asset.asset_id}</span>
                        <span>{asset.warranty_expiry ? format(asset.warranty_expiry, 'MMM dd') : 'N/A'}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <Tabs defaultValue="assets" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="assets">Assets</TabsTrigger>
            <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
            <TabsTrigger value="models">Asset Models</TabsTrigger>
            <TabsTrigger value="activity">Activity Log</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          {/* Assets Tab */}
          <TabsContent value="assets" className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <h2 className="text-xl font-semibold">Asset Management</h2>
              <div className="flex gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button><PlusIcon className="h-4 w-4 mr-2" />Add Asset</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Create New Asset</DialogTitle>
                      <DialogDescription>Add a new asset to your inventory</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateAsset} className="space-y-4">
                      <div>
                        <Label htmlFor="asset_id">Asset ID</Label>
                        <Input
                          id="asset_id"
                          value={assetForm.asset_id}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setAssetForm((prev: CreateAssetInput) => ({ ...prev, asset_id: e.target.value }))
                          }
                          placeholder="AST-001"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="model_id">Asset Model</Label>
                        <Select
                          value={assetForm.model_id > 0 ? assetForm.model_id.toString() : ''}
                          onValueChange={(value: string) =>
                            setAssetForm((prev: CreateAssetInput) => ({ ...prev, model_id: parseInt(value) }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select model" />
                          </SelectTrigger>
                          <SelectContent>
                            {assetModels.map((model: AssetModel) => (
                              <SelectItem key={model.id} value={model.id.toString()}>
                                {model.manufacturer} {model.model_number}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="location">Location</Label>
                        <Input
                          id="location"
                          value={assetForm.location || ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setAssetForm((prev: CreateAssetInput) => ({ ...prev, location: e.target.value || null }))
                          }
                          placeholder="Office floor, room number"
                        />
                      </div>
                      <div>
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                          id="notes"
                          value={assetForm.notes || ''}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                            setAssetForm((prev: CreateAssetInput) => ({ ...prev, notes: e.target.value || null }))
                          }
                          placeholder="Additional notes"
                        />
                      </div>
                      <Button type="submit" disabled={isLoading} className="w-full">
                        {isLoading ? 'Creating...' : 'Create Asset'}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Search and Filters */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Search assets..."
                        value={searchFilters.search || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setSearchFilters((prev: AssetSearchInput) => ({ ...prev, search: e.target.value || undefined }))
                        }
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Select
                    value={searchFilters.category || 'all'}
                    onValueChange={(value: string) =>
                      setSearchFilters((prev: AssetSearchInput) => ({ ...prev, category: value === 'all' ? undefined : value as AssetCategory }))
                    }
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="Laptops">Laptops</SelectItem>
                      <SelectItem value="Monitors">Monitors</SelectItem>
                      <SelectItem value="Keyboards">Keyboards</SelectItem>
                      <SelectItem value="Accessories">Accessories</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={searchFilters.status || 'all'}
                    onValueChange={(value: string) =>
                      setSearchFilters((prev: AssetSearchInput) => ({ ...prev, status: value === 'all' ? undefined : value as AssetStatus }))
                    }
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="In Stock">In Stock</SelectItem>
                      <SelectItem value="Assigned">Assigned</SelectItem>
                      <SelectItem value="Under Maintenance">Under Maintenance</SelectItem>
                      <SelectItem value="Retired">Retired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Assets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {assets.map((asset: AssetWithRelations) => (
                <Card key={asset.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{asset.asset_id}</CardTitle>
                      <div className="flex gap-2">
                        <Badge className={getCategoryColor(asset.model.category)}>
                          {asset.model.category}
                        </Badge>
                        <Badge className={getStatusColor(asset.status)}>
                          {asset.status}
                        </Badge>
                      </div>
                    </div>
                    <CardDescription>
                      {asset.model.manufacturer} {asset.model.model_number}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {asset.assigned_user && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Assigned to:</span>
                          <span className="font-medium">{asset.assigned_user.name}</span>
                        </div>
                      )}
                      {asset.location && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Location:</span>
                          <span>{asset.location}</span>
                        </div>
                      )}
                      {asset.purchase_date && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Purchase Date:</span>
                          <span>{format(asset.purchase_date, 'MMM dd, yyyy')}</span>
                        </div>
                      )}
                      {asset.warranty_expiry && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Warranty:</span>
                          <span className={asset.warranty_expiry < new Date() ? 'text-red-600' : ''}>
                            {format(asset.warranty_expiry, 'MMM dd, yyyy')}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => setSelectedAsset(asset)}>
                            View Details
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Asset Details - {selectedAsset?.asset_id}</DialogTitle>
                          </DialogHeader>
                          {selectedAsset && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label className="text-sm font-medium text-gray-500">Manufacturer</Label>
                                  <p>{selectedAsset.model.manufacturer}</p>
                                </div>
                                <div>
                                  <Label className="text-sm font-medium text-gray-500">Model</Label>
                                  <p>{selectedAsset.model.model_number}</p>
                                </div>
                                <div>
                                  <Label className="text-sm font-medium text-gray-500">Category</Label>
                                  <p>{selectedAsset.model.category}</p>
                                </div>
                                <div>
                                  <Label className="text-sm font-medium text-gray-500">Status</Label>
                                  <Badge className={getStatusColor(selectedAsset.status)}>
                                    {selectedAsset.status}
                                  </Badge>
                                </div>
                              </div>
                              {selectedAsset.model.specs && (
                                <div>
                                  <Label className="text-sm font-medium text-gray-500">Specifications</Label>
                                  <p className="mt-1">{selectedAsset.model.specs}</p>
                                </div>
                              )}
                              {selectedAsset.notes && (
                                <div>
                                  <Label className="text-sm font-medium text-gray-500">Notes</Label>
                                  <p className="mt-1">{selectedAsset.notes}</p>
                                </div>
                              )}
                              <div className="flex gap-2">
                                {selectedAsset.status === 'In Stock' && (
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button onClick={() => setAssignmentForm((prev: AssignAssetInput) => ({ ...prev, asset_id: selectedAsset.id }))}>
                                        Assign Asset
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle>Assign Asset</DialogTitle>
                                      </DialogHeader>
                                      <form onSubmit={handleAssignAsset} className="space-y-4">
                                        <div>
                                          <Label htmlFor="user_id">Assign to User</Label>
                                          <Select
                                            value={assignmentForm.user_id}
                                            onValueChange={(value: string) =>
                                              setAssignmentForm((prev: AssignAssetInput) => ({ ...prev, user_id: value }))
                                            }
                                          >
                                            <SelectTrigger>
                                              <SelectValue placeholder="Select user" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {users.map((user: User) => (
                                                <SelectItem key={user.id} value={user.id}>
                                                  {user.name} ({user.email})
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div>
                                          <Label htmlFor="assignment_notes">Notes</Label>
                                          <Textarea
                                            id="assignment_notes"
                                            value={assignmentForm.notes || ''}
                                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                                              setAssignmentForm((prev: AssignAssetInput) => ({ ...prev, notes: e.target.value || null }))
                                            }
                                            placeholder="Assignment notes"
                                          />
                                        </div>
                                        <Button type="submit" disabled={isLoading} className="w-full">
                                          {isLoading ? 'Assigning...' : 'Assign Asset'}
                                        </Button>
                                      </form>
                                    </DialogContent>
                                  </Dialog>
                                )}
                                {selectedAsset.status !== 'Retired' && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="destructive">Retire Asset</Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Retire Asset</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to retire this asset? This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleRetireAsset(selectedAsset.id)}>
                                          Retire Asset
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {assets.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <PackageIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No assets found. Create your first asset to get started!</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Maintenance Tab */}
          <TabsContent value="maintenance" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Maintenance Management</h2>
              <Dialog>
                <DialogTrigger asChild>
                  <Button><PlusIcon className="h-4 w-4 mr-2" />Schedule Maintenance</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Schedule Maintenance</DialogTitle>
                    <DialogDescription>Schedule maintenance for an asset</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateMaintenance} className="space-y-4">
                    <div>
                      <Label htmlFor="maintenance_asset_id">Asset</Label>
                      <Select
                        value={maintenanceForm.asset_id > 0 ? maintenanceForm.asset_id.toString() : ''}
                        onValueChange={(value: string) =>
                          setMaintenanceForm((prev: CreateMaintenanceRecordInput) => ({ ...prev, asset_id: parseInt(value) }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select asset" />
                        </SelectTrigger>
                        <SelectContent>
                          {assets.map((asset: AssetWithRelations) => (
                            <SelectItem key={asset.id} value={asset.id.toString()}>
                              {asset.asset_id} - {asset.model.manufacturer} {asset.model.model_number}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="maintenance_date">Scheduled Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !maintenanceForm.scheduled_date && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {maintenanceForm.scheduled_date ? format(maintenanceForm.scheduled_date, "PPP") : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={maintenanceForm.scheduled_date}
                            onSelect={(date: Date | undefined) =>
                              setMaintenanceForm((prev: CreateMaintenanceRecordInput) => ({ ...prev, scheduled_date: date || new Date() }))
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <Label htmlFor="maintenance_description">Description</Label>
                      <Textarea
                        id="maintenance_description"
                        value={maintenanceForm.description}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                          setMaintenanceForm((prev: CreateMaintenanceRecordInput) => ({ ...prev, description: e.target.value }))
                        }
                        placeholder="Describe the maintenance work"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="maintenance_notes">Notes</Label>
                      <Textarea
                        id="maintenance_notes"
                        value={maintenanceForm.notes || ''}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                          setMaintenanceForm((prev: CreateMaintenanceRecordInput) => ({ ...prev, notes: e.target.value || null }))
                        }
                        placeholder="Additional notes"
                      />
                    </div>
                    <Button type="submit" disabled={isLoading} className="w-full">
                      {isLoading ? 'Scheduling...' : 'Schedule Maintenance'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {maintenanceRecords.map((record: MaintenanceRecord) => (
                <Card key={record.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">Asset #{record.asset_id}</CardTitle>
                    <CardDescription>{record.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Scheduled:</span>
                        <span>{format(record.scheduled_date, 'MMM dd, yyyy')}</span>
                      </div>
                      {record.completed_date && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Completed:</span>
                          <span>{format(record.completed_date, 'MMM dd, yyyy')}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-500">Status:</span>
                        <Badge variant={record.status === 'Completed' ? 'default' : 'secondary'}>
                          {record.status}
                        </Badge>
                      </div>
                      {record.cost && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Cost:</span>
                          <span>${record.cost.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {maintenanceRecords.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <SettingsIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No maintenance records found. Schedule maintenance for your assets!</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Asset Models Tab */}
          <TabsContent value="models" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Asset Models</h2>
              <Dialog>
                <DialogTrigger asChild>
                  <Button><PlusIcon className="h-4 w-4 mr-2" />Add Model</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Asset Model</DialogTitle>
                    <DialogDescription>Add a new asset model to your catalog</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateModel} className="space-y-4">
                    <div>
                      <Label htmlFor="manufacturer">Manufacturer</Label>
                      <Input
                        id="manufacturer"
                        value={modelForm.manufacturer}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setModelForm((prev: CreateAssetModelInput) => ({ ...prev, manufacturer: e.target.value }))
                        }
                        placeholder="Dell, Apple, HP, etc."
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="model_number">Model Number</Label>
                      <Input
                        id="model_number"
                        value={modelForm.model_number}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setModelForm((prev: CreateAssetModelInput) => ({ ...prev, model_number: e.target.value }))
                        }
                        placeholder="XPS 13, MacBook Pro, etc."
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="category">Category</Label>
                      <Select
                        value={modelForm.category}
                        onValueChange={(value: AssetCategory) =>
                          setModelForm((prev: CreateAssetModelInput) => ({ ...prev, category: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Laptops">Laptops</SelectItem>
                          <SelectItem value="Monitors">Monitors</SelectItem>
                          <SelectItem value="Keyboards">Keyboards</SelectItem>
                          <SelectItem value="Accessories">Accessories</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="specs">Specifications</Label>
                      <Textarea
                        id="specs"
                        value={modelForm.specs || ''}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                          setModelForm((prev: CreateAssetModelInput) => ({ ...prev, specs: e.target.value || null }))
                        }
                        placeholder="Technical specifications"
                      />
                    </div>
                    <Button type="submit" disabled={isLoading} className="w-full">
                      {isLoading ? 'Creating...' : 'Create Model'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {assetModels.map((model: AssetModel) => (
                <Card key={model.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">{model.manufacturer}</CardTitle>
                    <CardDescription>{model.model_number}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Badge className={getCategoryColor(model.category)}>
                        {model.category}
                      </Badge>
                      {model.specs && (
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Specifications</Label>
                          <p className="text-sm mt-1">{model.specs}</p>
                        </div>
                      )}
                      <div className="text-xs text-gray-400">
                        Created: {format(model.created_at, 'MMM dd, yyyy')}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {assetModels.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <PackageIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No asset models found. Create your first model to get started!</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Activity Log Tab */}
          <TabsContent value="activity" className="space-y-6">
            <h2 className="text-xl font-semibold">Activity Log</h2>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <ActivityIcon className="h-5 w-5 mr-2" />
                  Recent Activities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activityLogs.map((log: ActivityLog) => (
                    <div key={log.id} className="flex items-start space-x-4 pb-4 border-b last:border-b-0">
                      <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {log.description}
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {log.activity_type}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {format(log.created_at, 'MMM dd, yyyy HH:mm')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {activityLogs.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <ActivityIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No activity logs found.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-6">
            <h2 className="text-xl font-semibold">Reports & Analytics</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Asset Status Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">In Stock</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-600 h-2 rounded-full" 
                            style={{ width: `${stats.total > 0 ? (stats.available / stats.total) * 100 : 0}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium">{stats.available}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Assigned</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${stats.total > 0 ? (stats.assigned / stats.total) * 100 : 0}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium">{stats.assigned}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Under Maintenance</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-yellow-600 h-2 rounded-full" 
                            style={{ width: `${stats.total > 0 ? (stats.maintenance / stats.total) * 100 : 0}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium">{stats.maintenance}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Asset Categories</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(['Laptops', 'Monitors', 'Keyboards', 'Accessories'] as AssetCategory[]).map((category: AssetCategory) => {
                      const count = assets.filter(a => a.model.category === category).length;
                      return (
                        <div key={category} className="flex justify-between items-center">
                          <span className="text-sm">{category}</span>
                          <div className="flex items-center space-x-2">
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-purple-600 h-2 rounded-full" 
                                style={{ width: `${stats.total > 0 ? (count / stats.total) * 100 : 0}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-medium">{count}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Quick Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{users.length}</div>
                    <div className="text-sm text-gray-500">Total Users</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{assetModels.length}</div>
                    <div className="text-sm text-gray-500">Asset Models</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">{maintenanceRecords.length}</div>
                    <div className="text-sm text-gray-500">Maintenance Records</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{activityLogs.length}</div>
                    <div className="text-sm text-gray-500">Recent Activities</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default App;
