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
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Trash2, Plus } from 'lucide-react';
import { InvoiceStatus } from '@/generated/prisma';

const invoiceItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().positive('Quantity must be positive'),
  unitPrice: z.number().min(0, 'Unit price must be non-negative'),
  taxRate: z.number().min(0).max(100),
});

const editInvoiceSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  currencyId: z.string().min(1, 'Currency is required'),
  number: z.string().optional(),
  status: z.nativeEnum(InvoiceStatus),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required'),
});

type EditInvoiceFormData = z.infer<typeof editInvoiceSchema>;

export default function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const resolvedParams = use(params);
  const { data: invoice, isLoading: invoiceLoading } = api.invoice.getById.useQuery({ id: resolvedParams.id });
  const { data: clients } = api.client.getAll.useQuery();
  const { data: currencies } = api.currency.getAll.useQuery();
  
  const updateInvoiceMutation = api.invoice.update.useMutation();

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EditInvoiceFormData>({
    resolver: zodResolver(editInvoiceSchema),
    defaultValues: {
      items: [{ description: '', quantity: 1, unitPrice: 0, taxRate: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const watchedItems = watch('items');

  // Set form values when invoice data loads
  useEffect(() => {
    if (invoice) {
      setValue('clientId', invoice.clientId);
      setValue('currencyId', invoice.currencyId);
      setValue('number', invoice.number);
      setValue('status', invoice.status);
      setValue('dueDate', invoice.dueDate ? new Date(invoice.dueDate).toISOString().split('T')[0] : '');
      setValue('notes', invoice.notes || '');
      
      // Set items
      if (invoice.items.length > 0) {
        setValue('items', invoice.items.map(item => ({
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          taxRate: Number(item.taxRate),
        })));
      }
    }
  }, [invoice]);

  const calculateSubtotal = () => {
    return watchedItems.reduce((sum, item) => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      return sum + (quantity * unitPrice);
    }, 0);
  };

  const calculateTax = () => {
    return watchedItems.reduce((sum, item) => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      const taxRate = Number(item.taxRate) || 0;
      const lineTotal = quantity * unitPrice;
      return sum + (lineTotal * taxRate / 100);
    }, 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax();
  };

  const onSubmit = async (data: EditInvoiceFormData) => {
    setIsSubmitting(true);
    try {
      const items = data.items.map(item => ({
        ...item,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        taxRate: Number(item.taxRate),
      }));

      await updateInvoiceMutation.mutateAsync({
        id: resolvedParams.id,
        clientId: data.clientId,
        currencyId: data.currencyId,
        number: data.number,
        status: data.status,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        notes: data.notes,
        items,
      });
      router.push(`/dashboard/invoices/${resolvedParams.id}`);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === 'loading' || invoiceLoading) {
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

  if (!invoice) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Invoice not found</div>
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

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <Link href="/dashboard/invoices" className="text-blue-600 hover:underline">
              ← Back to Invoices
            </Link>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Edit Invoice {invoice.number}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="number">Invoice Number</Label>
                  <Input
                    id="number"
                    {...register('number')}
                    placeholder="Invoice number"
                  />
                  <p className="text-xs text-gray-500">
                    Modify the invoice number if needed
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="clientId">Client *</Label>
                    <Select value={watch('clientId')} onValueChange={(value) => setValue('clientId', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select client" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients ? clients.map((client: any) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        )) : null}
                      </SelectContent>
                    </Select>
                    {errors.clientId && (
                      <p className="text-red-500 text-sm">{errors.clientId.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="currencyId">Currency *</Label>
                    <Select value={watch('currencyId')} onValueChange={(value) => setValue('currencyId', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies?.map((currency) => (
                          <SelectItem key={currency.id} value={currency.id}>
                            {currency.code} - {currency.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.currencyId && (
                      <p className="text-red-500 text-sm">{errors.currencyId.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select value={watch('status')} onValueChange={(value) => setValue('status', value as InvoiceStatus)}>
                      <SelectTrigger>
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
                    {errors.status && (
                      <p className="text-red-500 text-sm">{errors.status.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Due Date</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      {...register('dueDate')}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Invoice Items</h3>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => append({ description: '', quantity: 1, unitPrice: 0, taxRate: 0 })}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Item
                    </Button>
                  </div>

                  {fields.map((field, index) => (
                    <Card key={field.id}>
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                          <div className="md:col-span-2 space-y-2">
                            <Label htmlFor={`items.${index}.description`}>Description</Label>
                            <Input
                              {...register(`items.${index}.description`)}
                              placeholder="Item description"
                            />
                            {errors.items?.[index]?.description && (
                              <p className="text-red-500 text-xs">
                                {errors.items[index]?.description?.message}
                              </p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`items.${index}.quantity`}>Quantity</Label>
                            <Input
                              type="number"
                              step="0.01"
                              {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                              placeholder="1"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`items.${index}.unitPrice`}>Unit Price</Label>
                            <Input
                              type="number"
                              step="0.01"
                              {...register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                              placeholder="0.00"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`items.${index}.taxRate`}>Tax %</Label>
                            <Input
                              type="number"
                              step="0.01"
                              {...register(`items.${index}.taxRate`, { valueAsNumber: true })}
                              placeholder="0"
                            />
                          </div>

                          <div className="flex justify-end">
                            {fields.length > 1 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => remove(index)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {errors.items && (
                    <p className="text-red-500 text-sm">{errors.items.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Input
                    id="notes"
                    {...register('notes')}
                    placeholder="Additional notes..."
                  />
                </div>

                <div className="border-t pt-4">
                  <div className="text-right space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>${calculateSubtotal().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax:</span>
                      <span>${calculateTax().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total:</span>
                      <span>${calculateTotal().toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-4">
                  <Button type="button" variant="outline" asChild>
                    <Link href={`/dashboard/invoices/${resolvedParams.id}`}>Cancel</Link>
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Updating...' : 'Update Invoice'}
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