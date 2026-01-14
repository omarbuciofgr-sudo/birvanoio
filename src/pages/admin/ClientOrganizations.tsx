import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Users, Building2, Mail, Phone } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { toast } from 'sonner';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { clientOrganizationsApi } from '@/lib/api/scraper';
import type { ClientOrganization, CreateClientOrganizationInput } from '@/types/scraper';

const organizationSchema = z.object({
  name: z.string().min(1, 'Organization name is required'),
  contact_email: z.string().email('Invalid email').optional().or(z.literal('')),
  contact_phone: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof organizationSchema>;

export default function ClientOrganizations() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<ClientOrganization | null>(null);
  const queryClient = useQueryClient();

  const { data: organizations, isLoading } = useQuery({
    queryKey: ['client-organizations'],
    queryFn: clientOrganizationsApi.list,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      name: '',
      contact_email: '',
      contact_phone: '',
      notes: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: clientOrganizationsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-organizations'] });
      toast.success('Organization created');
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error('Failed to create organization', { description: error.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateClientOrganizationInput> }) =>
      clientOrganizationsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-organizations'] });
      toast.success('Organization updated');
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error('Failed to update organization', { description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: clientOrganizationsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-organizations'] });
      toast.success('Organization deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete organization', { description: error.message });
    },
  });

  const handleOpenDialog = (org?: ClientOrganization) => {
    if (org) {
      setEditingOrg(org);
      form.reset({
        name: org.name,
        contact_email: org.contact_email || '',
        contact_phone: org.contact_phone || '',
        notes: org.notes || '',
      });
    } else {
      setEditingOrg(null);
      form.reset({
        name: '',
        contact_email: '',
        contact_phone: '',
        notes: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingOrg(null);
    form.reset();
  };

  const handleSubmit = (data: FormData) => {
    const cleanData: CreateClientOrganizationInput = {
      name: data.name,
      contact_email: data.contact_email || undefined,
      contact_phone: data.contact_phone || undefined,
      notes: data.notes || undefined,
    };

    if (editingOrg) {
      updateMutation.mutate({ id: editingOrg.id, data: cleanData });
    } else {
      createMutation.mutate(cleanData);
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6 px-4 max-w-5xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Client Organizations</h1>
            <p className="text-muted-foreground">
              Manage client accounts for lead assignment
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Client
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        ) : organizations?.length === 0 ? (
          <Card className="p-8 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No clients yet</h3>
            <p className="text-muted-foreground mb-4">
              Add your first client organization to start assigning leads.
            </p>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Client
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {organizations?.map((org) => (
              <Card key={org.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{org.name}</CardTitle>
                      <Badge
                        variant={org.is_active ? 'default' : 'secondary'}
                        className="mt-1"
                      >
                        {org.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(org)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Organization?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete "{org.name}" and unassign all
                              leads from this organization.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(org.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {org.contact_email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span>{org.contact_email}</span>
                    </div>
                  )}
                  {org.contact_phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>{org.contact_phone}</span>
                    </div>
                  )}
                  {org.notes && (
                    <p className="text-sm text-muted-foreground line-clamp-2 pt-2">
                      {org.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingOrg ? 'Edit Organization' : 'Add Client Organization'}
              </DialogTitle>
              <DialogDescription>
                {editingOrg
                  ? 'Update the organization details'
                  : 'Create a new client organization to assign leads to'}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organization Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Acme Corp" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contact_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="contact@acme.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contact_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="+1 (555) 123-4567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Additional notes about this client..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCloseDialog}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {editingOrg ? 'Update' : 'Create'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
