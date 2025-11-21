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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import { Edit, Download } from 'lucide-react';
import { InvoiceStatus } from '@/generated/prisma';
import { PDFGenerator } from '@/lib/pdf-generator';

export default function InvoiceViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const resolvedParams = use(params);
  const { data: invoice, isLoading, refetch } = api.invoice.getById.useQuery({ id: resolvedParams.id });
  const updateStatus = api.invoice.updateStatus.useMutation({
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

  if (!invoice) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Invoice not found</div>
      </div>
    );
  }

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
      month: 'long',
      day: 'numeric',
    }).format(new Date(date));
  };

  const formatCurrency = (amount: number) => {
    return `${invoice.currency.symbol}${Number(amount).toFixed(2)}`;
  };

  const handleStatusChange = async (newStatus: InvoiceStatus) => {
    await updateStatus.mutateAsync({ id: invoice.id, status: newStatus });
  };

  const handleDownloadPDF = () => {
    if (!invoice) return;

    const pdfData = {
      id: invoice.id,
      number: invoice.number,
      issueDate: new Date(invoice.issueDate),
      dueDate: invoice.dueDate ? new Date(invoice.dueDate) : undefined,
      status: invoice.status,
      subtotal: Number(invoice.subtotal),
      taxAmount: Number(invoice.taxAmount),
      total: Number(invoice.total),
      notes: invoice.notes || undefined,
      client: {
        name: invoice.client.name,
        email: invoice.client.email || undefined,
        phone: invoice.client.phone || undefined,
        address: invoice.client.address || undefined,
        city: invoice.client.city || undefined,
        postalCode: invoice.client.postalCode || undefined,
        country: invoice.client.country || undefined,
        taxId: invoice.client.taxId || undefined,
      },
      currency: {
        code: invoice.currency.code,
        symbol: invoice.currency.symbol,
      },
      items: invoice.items.map(item => ({
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        taxRate: Number(item.taxRate),
        total: Number(item.total),
      })),
    };

    PDFGenerator.downloadInvoicePDF(pdfData);
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

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <Link href="/dashboard/invoices" className="text-blue-600 hover:underline">
              ← Back to Invoices
            </Link>
          </div>

          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl font-bold">Invoice {invoice.number}</h1>
              <div className="flex items-center space-x-4 mt-2">
                {getStatusBadge(invoice.status)}
                <Select 
                  value={invoice.status} 
                  onValueChange={(value) => handleStatusChange(value as InvoiceStatus)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="SENT">Sent</SelectItem>
                    <SelectItem value="PAID">Paid</SelectItem>
                    <SelectItem value="OVERDUE">Overdue</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" asChild>
                <Link href={`/dashboard/invoices/${resolvedParams.id}/edit`}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Link>
              </Button>
              <Button onClick={handleDownloadPDF}>
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Invoice Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-gray-900">Bill To:</h4>
                      <div className="mt-1 text-sm text-gray-600">
                        <p className="font-medium">{invoice.client.name}</p>
                        {invoice.client.email && <p>{invoice.client.email}</p>}
                        {invoice.client.phone && <p>{invoice.client.phone}</p>}
                        {invoice.client.address && (
                          <div className="mt-2">
                            <p>{invoice.client.address}</p>
                            {(invoice.client.city || invoice.client.postalCode) && (
                              <p>
                                {invoice.client.city}
                                {invoice.client.city && invoice.client.postalCode && ', '}
                                {invoice.client.postalCode}
                              </p>
                            )}
                            {invoice.client.country && <p>{invoice.client.country}</p>}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Invoice Info:</h4>
                      <div className="mt-1 text-sm text-gray-600 space-y-1">
                        <p><span className="font-medium">Issue Date:</span> {formatDate(new Date(invoice.issueDate))}</p>
                        {invoice.dueDate && (
                          <p><span className="font-medium">Due Date:</span> {formatDate(new Date(invoice.dueDate))}</p>
                        )}
                        <p><span className="font-medium">Currency:</span> {invoice.currency.code}</p>
                        {invoice.client.taxId && (
                          <p><span className="font-medium">Client Tax ID:</span> {invoice.client.taxId}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Items</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Tax %</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoice.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.description}</TableCell>
                          <TableCell className="text-right">{Number(item.quantity)}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(Number(item.unitPrice))}
                          </TableCell>
                          <TableCell className="text-right">{Number(item.taxRate)}%</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(Number(item.total))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {invoice.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle>Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600">{invoice.notes}</p>
                  </CardContent>
                </Card>
              )}
            </div>

            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Invoice Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Subtotal:</span>
                      <span className="text-sm">{formatCurrency(Number(invoice.subtotal))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Tax:</span>
                      <span className="text-sm">{formatCurrency(Number(invoice.taxAmount))}</span>
                    </div>
                    {Number(invoice.discountAmount) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Discount:</span>
                        <span className="text-sm">-{formatCurrency(Number(invoice.discountAmount))}</span>
                      </div>
                    )}
                    <div className="border-t pt-3">
                      <div className="flex justify-between">
                        <span className="font-medium">Total:</span>
                        <span className="font-medium text-lg">
                          {formatCurrency(Number(invoice.total))}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}