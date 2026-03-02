'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { Trash2, Edit, Plus, Eye, Copy, Filter } from 'lucide-react';
import { InvoiceStatus } from '@/generated/prisma';

export default function InvoicesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const invoicesQuery = api.invoice.getAll.useQuery();
  const allInvoices = invoicesQuery.data;
  const isLoading = invoicesQuery.isLoading;
  const refetch = invoicesQuery.refetch;
  const deleteInvoiceMutation = api.invoice.delete.useMutation();
  const { data: clients } = api.clients.getAll.useQuery();

  // Filter invoices
  const invoices = allInvoices?.filter((invoice: any) => {
    // Status filter
    if (statusFilter !== 'ALL' && invoice.status !== statusFilter) {
      return false;
    }

    // Search filter (invoice number or client name)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesNumber = invoice.number.toLowerCase().includes(query);
      const matchesClient = invoice.client.name.toLowerCase().includes(query);
      return matchesNumber || matchesClient;
    }

    return true;
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
    if (confirm('Are you sure you want to delete this invoice?')) {
      await deleteInvoiceMutation.mutateAsync({ id });
      refetch();
    }
  };

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

  const formatCurrency = (amount: number, currencySymbol: string) => {
    return `${currencySymbol}${amount.toFixed(2)}`;
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
            <h1 className="text-2xl font-bold">Invoices</h1>
            <Button asChild>
              <Link href="/dashboard/invoices/new">
                <Plus className="w-4 h-4 mr-2" />
                Create Invoice
              </Link>
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>All Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              {invoices && invoices.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!isLoading && invoices ? invoices.map((invoice: any) => {
                      const total = Number(invoice.total);
                      const paid = Number(invoice.amountPaid);
                      const balance = total - paid;
                      const isTND = invoice.currency.code === 'TND';
                      const decimals = isTND ? 3 : 2;

                      return (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">{invoice.number}</TableCell>
                        <TableCell>{invoice.client.name}</TableCell>
                        <TableCell>{formatDate(new Date(invoice.issueDate))}</TableCell>
                        <TableCell>
                          {invoice.dueDate ? formatDate(new Date(invoice.dueDate)) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {invoice.currency.symbol}{total.toFixed(decimals)}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {paid > 0 ? `${invoice.currency.symbol}${paid.toFixed(decimals)}` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {balance > 0 ? `${invoice.currency.symbol}${balance.toFixed(decimals)}` : '-'}
                        </TableCell>
                        <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                            >
                              <Link href={`/dashboard/invoices/${invoice.id}`}>
                                <Eye className="w-4 h-4" />
                              </Link>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                            >
                              <Link href={`/dashboard/invoices/${invoice.id}/edit`}>
                                <Edit className="w-4 h-4" />
                              </Link>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(invoice.id)}
                              disabled={deleteInvoiceMutation.isPending}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      );
                    }) : null}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p className="mb-4">No invoices found</p>
                  <Button asChild>
                    <Link href="/dashboard/invoices/new">Create your first invoice</Link>
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