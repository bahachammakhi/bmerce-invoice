'use client';

import { useState, useEffect, use } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const clientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  taxId: z.string().optional(),
});

type ClientFormData = z.infer<typeof clientSchema>;

export default function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const resolvedParams = use(params);
  const { data: client, isLoading } = api.clients.getById.useQuery({ id: resolvedParams.id });
  const updateClientMutation = api.clients.update.useMutation();

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps -- reset form when client data loads
  useEffect(() => {
    if (client) {
      reset({
        name: client.name,
        email: client.email || '',
        phone: client.phone || '',
        address: client.address || '',
        city: client.city || '',
        postalCode: client.postalCode || '',
        country: client.country || '',
        taxId: client.taxId || '',
      });
    }
  }, [client?.id, reset]);

  const onSubmit = async (data: ClientFormData) => {
    setIsSubmitting(true);
    try {
      await updateClientMutation.mutateAsync({
        id: resolvedParams.id,
        ...data,
        email: data.email || undefined,
      });
      router.push('/dashboard/clients');
    } catch (error) {
      console.error('Error updating client:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    router.push('/auth/signin');
    return null;
  }

  if (!client) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Client not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="text-xl font-semibold">
                Invoice Manager
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">Welcome, {session?.user.name}</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <Link href="/dashboard/clients" className="text-blue-600 hover:underline">
              ← Back to Clients
            </Link>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Edit Client</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      {...register('name')}
                      placeholder="Client name"
                    />
                    {errors.name && (
                      <p className="text-red-500 text-sm">{errors.name.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      {...register('email')}
                      placeholder="client@example.com"
                    />
                    {errors.email && (
                      <p className="text-red-500 text-sm">{errors.email.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      {...register('phone')}
                      placeholder="+1 234 567 8900"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="taxId">Tax ID</Label>
                    <Input
                      id="taxId"
                      {...register('taxId')}
                      placeholder="Tax identification number"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      {...register('address')}
                      placeholder="Street address"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      {...register('city')}
                      placeholder="City"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="postalCode">Postal Code</Label>
                    <Input
                      id="postalCode"
                      {...register('postalCode')}
                      placeholder="Postal code"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Select
                      value={watch('country') || ''}
                      onValueChange={(value) => setValue('country', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TN">Tunisia</SelectItem>
                        <SelectItem value="US">United States</SelectItem>
                        <SelectItem value="FR">France</SelectItem>
                        <SelectItem value="DE">Germany</SelectItem>
                        <SelectItem value="GB">United Kingdom</SelectItem>
                        <SelectItem value="CA">Canada</SelectItem>
                        <SelectItem value="IS">Iceland</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end space-x-4">
                  <Button type="button" variant="outline" asChild>
                    <Link href="/dashboard/clients">Cancel</Link>
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Updating...' : 'Update Client'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}