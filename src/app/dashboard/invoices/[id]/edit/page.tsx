'use client';

import { useState, use } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
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
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required'),
  isTaxExempt: z.boolean().optional(),
  exemptionReason: z.string().optional(),
  withholdingTax: z.number().min(0).optional(),
  timbreAmount: z.number().min(0).optional(),
});

type EditInvoiceFormData = z.infer<typeof editInvoiceSchema>;

// ── Page wrapper: loads data, then renders form ────────────────
export default function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const resolvedParams = use(params);

  const { data: invoice, isLoading: invoiceLoading } = api.invoice.getById.useQuery({ id: resolvedParams.id });
  const { data: clients, isLoading: clientsLoading } = api.clients.getAll.useQuery();
  const { data: currencies, isLoading: currenciesLoading } = api.currency.getAll.useQuery();

  if (status === 'loading' || invoiceLoading || clientsLoading || currenciesLoading) {
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

  if (!invoice || !clients || !currencies) {
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

          {/* key forces full remount if navigating between invoices */}
          <EditInvoiceForm
            key={invoice.id}
            invoice={invoice}
            clients={clients}
            currencies={currencies}
            invoiceId={resolvedParams.id}
          />
        </div>
      </main>
    </div>
  );
}

// ── Form component: mounts only when all data is ready ─────────
function EditInvoiceForm({
  invoice,
  clients,
  currencies,
  invoiceId,
}: {
  invoice: any;
  clients: any[];
  currencies: any[];
  invoiceId: string;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const updateInvoiceMutation = api.invoice.update.useMutation();

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<EditInvoiceFormData>({
    resolver: zodResolver(editInvoiceSchema),
    defaultValues: {
      clientId: invoice.clientId,
      currencyId: invoice.currencyId,
      number: invoice.number,
      status: invoice.status,
      issueDate: new Date(invoice.issueDate).toISOString().split('T')[0],
      dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString().split('T')[0] : '',
      notes: invoice.notes || '',
      isTaxExempt: invoice.isTaxExempt,
      exemptionReason: invoice.exemptionReason || '',
      withholdingTax: Number(invoice.withholdingTax),
      timbreAmount: Number(invoice.timbreAmount),
      items: invoice.items.length > 0
        ? invoice.items.map((item: any) => ({
            description: item.description,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            taxRate: Number(item.taxRate),
          }))
        : [{ description: '', quantity: 1, unitPrice: 0, taxRate: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const watchedItems = watch('items');
  const isTaxExempt = watch('isTaxExempt');
  const withholdingTax = watch('withholdingTax') || 0;
  const timbreAmount = watch('timbreAmount') || 0;
  const currencyId = watch('currencyId');

  const selectedCurrency = currencies.find((c: any) => c.id === currencyId);
  const isTND = selectedCurrency?.code === 'TND';
  const decimalPlaces = isTND ? 3 : 2;

  const calculateSubtotal = () => {
    return watchedItems.reduce((sum, item) => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      return sum + (quantity * unitPrice);
    }, 0);
  };

  const calculateTax = () => {
    if (isTaxExempt) return 0;
    return watchedItems.reduce((sum, item) => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      const taxRate = Number(item.taxRate) || 0;
      const lineTotal = quantity * unitPrice;
      return sum + (lineTotal * taxRate / 100);
    }, 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const tax = calculateTax();
    const timbre = isTaxExempt ? 0 : (Number(timbreAmount) || 0);
    const withholding = Number(withholdingTax) || 0;
    return subtotal + tax + timbre - withholding;
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
        id: invoiceId,
        clientId: data.clientId,
        currencyId: data.currencyId,
        number: data.number,
        status: data.status,
        issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        notes: data.notes,
        items,
        isTaxExempt: data.isTaxExempt,
        exemptionReason: data.exemptionReason,
        withholdingTax: Number(data.withholdingTax),
        timbreAmount: Number(data.timbreAmount),
      });
      router.push(`/dashboard/invoices/${invoiceId}`);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
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
              <Controller
                control={control}
                name="clientId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client: any) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.clientId && (
                <p className="text-red-500 text-sm">{errors.clientId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="currencyId">Currency *</Label>
              <Controller
                control={control}
                name="currencyId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((currency: any) => (
                        <SelectItem key={currency.id} value={currency.id}>
                          {currency.code} - {currency.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.currencyId && (
                <p className="text-red-500 text-sm">{errors.currencyId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
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
                )}
              />
              {errors.status && (
                <p className="text-red-500 text-sm">{errors.status.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="issueDate">Invoice Date</Label>
              <Input
                id="issueDate"
                type="date"
                {...register('issueDate')}
              />
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

          {/* Tax Compliance Section */}
          <div className="border p-4 rounded-md space-y-4 bg-gray-50">
            <h3 className="font-medium">Tax & Compliance</h3>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isTaxExempt"
                {...register('isTaxExempt')}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <Label htmlFor="isTaxExempt">Tax Exempt (Exonéré de TVA)</Label>
            </div>

            {isTaxExempt && (
              <div className="space-y-2">
                <Label htmlFor="exemptionReason">Exemption Reason</Label>
                <Input
                  id="exemptionReason"
                  {...register('exemptionReason')}
                  placeholder="e.g., Export, Article X..."
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="timbreAmount">Timbre Fiscal</Label>
                <Input
                  type="number"
                  step="0.001"
                  {...register('timbreAmount', { valueAsNumber: true })}
                  disabled={isTaxExempt}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="withholdingTax">Withholding Tax (Retenue à la source)</Label>
                <Input
                  type="number"
                  step="0.001"
                  {...register('withholdingTax', { valueAsNumber: true })}
                />
              </div>
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
                        step={isTND ? "0.001" : "0.01"}
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
                        disabled={isTaxExempt}
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
            <Textarea
              id="notes"
              {...register('notes')}
              placeholder="Additional notes..."
            />
          </div>

          <div className="border-t pt-4">
            <div className="text-right space-y-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{selectedCurrency?.symbol}{calculateSubtotal().toFixed(decimalPlaces)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax:</span>
                <span>{selectedCurrency?.symbol}{calculateTax().toFixed(decimalPlaces)}</span>
              </div>
              {!isTaxExempt && Number(timbreAmount) > 0 && (
                <div className="flex justify-between">
                  <span>Timbre Fiscal:</span>
                  <span>{selectedCurrency?.symbol}{Number(timbreAmount).toFixed(decimalPlaces)}</span>
                </div>
              )}
              {Number(withholdingTax) > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Withholding Tax:</span>
                  <span>-{selectedCurrency?.symbol}{Number(withholdingTax).toFixed(decimalPlaces)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg">
                <span>Total:</span>
                <span>{selectedCurrency?.symbol}{calculateTotal().toFixed(decimalPlaces)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" asChild>
              <Link href={`/dashboard/invoices/${invoiceId}`}>Cancel</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Updating...' : 'Update Invoice'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
