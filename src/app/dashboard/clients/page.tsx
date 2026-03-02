'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { api } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import Link from 'next/link';
import { Trash2, Edit, Plus, Eye } from 'lucide-react';

export default function ClientsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { data: clients, isLoading, refetch } = api.clients.getAll.useQuery();
  const deleteClient = api.clients.delete.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this client?')) {
      await deleteClient.mutateAsync({ id });
    }
  };

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
              <span className="text-sm text-gray-700">Welcome, {session.user.name}</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Clients</h1>
            <Button asChild>
              <Link href="/dashboard/clients/new">
                <Plus className="w-4 h-4 mr-2" />
                Add Client
              </Link>
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>All Clients</CardTitle>
            </CardHeader>
            <CardContent>
              {clients && clients.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients?.map((client: any) => (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">{client.name}</TableCell>
                        <TableCell>{client.email || '-'}</TableCell>
                        <TableCell>{client.phone || '-'}</TableCell>
                        <TableCell>{client.country || '-'}</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                            >
                              <Link href={`/dashboard/clients/${client.id}`}>
                                <Eye className="w-4 h-4" />
                              </Link>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                            >
                              <Link href={`/dashboard/clients/${client.id}/edit`}>
                                <Edit className="w-4 h-4" />
                              </Link>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(client.id)}
                              disabled={false}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p className="mb-4">No clients found</p>
                  <Button asChild>
                    <Link href="/dashboard/clients/new">Add your first client</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}