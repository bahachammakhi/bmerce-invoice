'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, use } from 'react';
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
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Edit, ArrowLeft, Eye, Plus } from 'lucide-react';
import { InvoiceStatus } from '@/generated/prisma';

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const resolvedParams = use(params);

  const { data: client, isLoading } = api.clients.getById.useQuery({ id: resolvedParams.id });
  const { data: allInvoices } = api.invoice.getAll.useQuery();

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

  if (!session || !client) {
    return null;
  }

  const clientInvoices = (allInvoices as any[])?.filter((inv: any) => inv.clientId === client.id) || [];

  const totalRevenue = clientInvoices.reduce((sum: number, inv: any) => {
    if (inv.status === InvoiceStatus.PAID) {
      return sum + Number(inv.total);
    }
    return sum;
  }, 0);

  const totalPending = clientInvoices.reduce((sum: number, inv: any) => {
    if (inv.status !== InvoiceStatus.PAID && inv.status !== InvoiceStatus.CANCELLED) {
      return sum + (Number(inv.total) - Number(inv.amountPaid));
    }
    return sum;
  }, 0);

  const getStatusBadge = (status: InvoiceStatus) => {
    const statusConfig = {
      DRAFT: { label: 'Draft', variant: 'secondary' as const },
      SENT: { label: 'Sent', variant: 'default' as const },
      PAID: { label: 'Paid', variant: 'default' as const },
      OVERDUE: { label: 'Overdue', variant: 'destructive' as const },
      CANCELLED: { label: 'Cancelled', variant: 'outline' as const },
    };

    const config = statusConfig[status];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(date));
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
          <div className="mb-6">
            <Link href="/dashboard/clients" className="text-blue-600 hover:underline inline-flex items-center">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Clients
            </Link>
          </div>

          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl font-bold">{client.name}</h1>
              {client.email && <p className="text-gray-600">{client.email}</p>}
              {client.phone && <p className="text-gray-600">{client.phone}</p>}
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" asChild>
                <Link href={`/dashboard/clients/${client.id}/edit`}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Client
                </Link>
              </Button>
              <Button asChild>
                <Link href={`/dashboard/invoices/new?clientId=${client.id}`}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Invoice
                </Link>
              </Button>
            </div>
          </div>

          {/* Client Info Card */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Client Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Address</p>
                  {client.address ? (
                    <div className="mt-1">
                      <p>{client.address}</p>
                      {(client.city || client.postalCode) && (
                        <p>
                          {client.city}
                          {client.city && client.postalCode && ', '}
                          {client.postalCode}
                        </p>
                      )}
                      {client.country && <p>{client.country}</p>}
                    </div>
                  ) : (
                    <p className="text-gray-400 mt-1">Not provided</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-600">Tax ID</p>
                  <p className="mt-1">{client.taxId || 'Not provided'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{clientInvoices.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  ${totalRevenue.toFixed(2)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Pending Amount</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  ${totalPending.toFixed(2)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Invoices Table */}
          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              {clientInvoices.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientInvoices.map((invoice: any) => {
                      const balance = Number(invoice.total) - Number(invoice.amountPaid);
                      const isTND = invoice.currency.code === 'TND';
                      const decimals = isTND ? 3 : 2;

                      return (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">{invoice.number}</TableCell>
                          <TableCell>{formatDate(new Date(invoice.issueDate))}</TableCell>
                          <TableCell>
                            {invoice.dueDate ? formatDate(new Date(invoice.dueDate)) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {invoice.currency.symbol}{Number(invoice.total).toFixed(decimals)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {balance > 0 ? `${invoice.currency.symbol}${balance.toFixed(decimals)}` : '-'}
                          </TableCell>
                          <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                          <TableCell>
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/dashboard/invoices/${invoice.id}`}>
                                <Eye className="w-4 h-4" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p className="mb-4">No invoices yet for this client</p>
                  <Button asChild>
                    <Link href={`/dashboard/invoices/new?clientId=${client.id}`}>
                      Create First Invoice
                    </Link>
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
