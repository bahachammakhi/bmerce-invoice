'use client';

import { useState, useEffect } from 'react';
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
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { InvoiceSystem } from '@/generated/prisma';

const companyInfoSchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  website: z.string().optional(),
  taxId: z.string().optional(),
  // Tunisian specific
  tvaNumber: z.string().optional(),
  mfNumber: z.string().optional(),
});

const bankDetailsSchema = z.object({
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  iban: z.string().optional(),
  swift: z.string().optional(),
  rib: z.string().optional(),
});

const settingsSchema = z.object({
  invoiceSystem: z.nativeEnum(InvoiceSystem),
  companyInfo: companyInfoSchema,
  bankDetails: bankDetailsSchema.optional(),
  baseCurrencyId: z.string().optional(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const utils = api.useUtils();
  const { data: userSettings, isLoading } = api.user.getSettings.useQuery();
  const { data: currencies } = api.currency.getAll.useQuery();
  const updateSettingsMutation = api.user.updateSettings.useMutation({
    onSuccess: () => {
      // Invalidate and refetch user settings using tRPC utils
      utils.user.getSettings.invalidate();
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      invoiceSystem: InvoiceSystem.NORMAL,
      baseCurrencyId: undefined,
      companyInfo: {
        name: '',
        address: '',
        city: '',
        postalCode: '',
        country: '',
        phone: '',
        email: '',
        website: '',
        taxId: '',
        tvaNumber: '',
        mfNumber: '',
      },
      bankDetails: {
        bankName: '',
        accountNumber: '',
        iban: '',
        swift: '',
        rib: '',
      },
    },
  });

  const currentInvoiceSystem = watch('invoiceSystem');

  // Set form values when user data loads
  useEffect(() => {
    if (userSettings) {
      console.log('=== SETTING FORM VALUES ===');
      const settingsAny = userSettings as any;
      console.log('Raw userSettings:', JSON.stringify(userSettings, null, 2));

      // Set invoice system
      const invoiceSystem = userSettings.invoiceSystem || InvoiceSystem.NORMAL;
      setValue('invoiceSystem', invoiceSystem);

      // Set base currency
      if (settingsAny.baseCurrencyId) {
        setValue('baseCurrencyId', settingsAny.baseCurrencyId);
      }

      // Set company info
      if (settingsAny.companyInfo) {
        const companyInfo = settingsAny.companyInfo as Record<string, any>;
        setValue('companyInfo.name', companyInfo.name || '');
        setValue('companyInfo.address', companyInfo.address || '');
        setValue('companyInfo.city', companyInfo.city || '');
        setValue('companyInfo.postalCode', companyInfo.postalCode || '');
        setValue('companyInfo.country', companyInfo.country || '');
        setValue('companyInfo.phone', companyInfo.phone || '');
        setValue('companyInfo.email', companyInfo.email || '');
        setValue('companyInfo.website', companyInfo.website || '');
        setValue('companyInfo.taxId', companyInfo.taxId || '');
        setValue('companyInfo.tvaNumber', companyInfo.tvaNumber || '');
        setValue('companyInfo.mfNumber', companyInfo.mfNumber || '');
      }

      // Set bank details
      if (settingsAny.bankDetails) {
        const bankDetails = settingsAny.bankDetails as Record<string, any>;
        setValue('bankDetails.bankName', bankDetails.bankName || '');
        setValue('bankDetails.accountNumber', bankDetails.accountNumber || '');
        setValue('bankDetails.iban', bankDetails.iban || '');
        setValue('bankDetails.swift', bankDetails.swift || '');
        setValue('bankDetails.rib', bankDetails.rib || '');
      }

      console.log('=== FORM VALUES SET COMPLETE ===');
    }
  }, [userSettings?.updatedAt, setValue]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  const onSubmit = async (data: SettingsFormData) => {
    setIsSubmitting(true);
    try {
      console.log('=== FORM SUBMISSION START ===');
      console.log('Form data:', JSON.stringify(data, null, 2));

      console.log('Calling updateSettingsMutation...');
      const result = await updateSettingsMutation.mutateAsync({
        invoiceSystem: data.invoiceSystem,
        companyInfo: data.companyInfo,
        bankDetails: data.bankDetails,
        baseCurrencyId: data.baseCurrencyId,
      });
      console.log('Settings update result:', JSON.stringify(result, null, 2));
      console.log('=== FORM SUBMISSION SUCCESS ===');
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('=== FORM SUBMISSION ERROR ===');
      console.error('Error updating settings:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      alert('Error saving settings. Please try again.');
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

  if (!session) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your invoice system preferences and company information.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Invoice System Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Base Currency Section */}
              <div className="space-y-2">
                <Label htmlFor="baseCurrency">Base Currency</Label>
                <Controller
                  name="baseCurrencyId"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value || ''} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select base currency" />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies?.map((currency) => (
                          <SelectItem key={currency.id} value={currency.id}>
                            {currency.code} - {currency.name} ({currency.symbol})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <p className="text-xs text-gray-500">
                  All analytics and reports will be shown in this currency
                </p>
              </div>

              {/* Invoice System Section */}
              <div className="space-y-2">
                <Label htmlFor="invoiceSystem">Invoice System</Label>
                <Controller
                  name="invoiceSystem"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        console.log('=== SELECT VALUE CHANGE ===');
                        console.log('Old value:', field.value);
                        console.log('New value:', value);
                        console.log('Value type:', typeof value);
                        field.onChange(value);
                        console.log('field.onChange called with:', value);
                        console.log('Current form state after change:', watch());
                        console.log('=== SELECT VALUE CHANGE END ===');
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select invoice system" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NORMAL">Normal System</SelectItem>
                        <SelectItem value="TUNISIAN">Tunisian System (with Timbre & compliance)</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                <p className="text-xs text-gray-500">
                  Choose the invoice system that matches your business requirements
                </p>
                {errors.invoiceSystem && (
                  <p className="text-red-500 text-sm">{errors.invoiceSystem.message}</p>
                )}
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-medium mb-4">Company Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="companyInfo.name">Company Name *</Label>
                    <Input
                      id="companyInfo.name"
                      {...register('companyInfo.name')}
                      placeholder="Your company name"
                    />
                    {errors.companyInfo?.name && (
                      <p className="text-red-500 text-sm">{errors.companyInfo.name.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="companyInfo.email">Email</Label>
                    <Input
                      id="companyInfo.email"
                      type="email"
                      {...register('companyInfo.email')}
                      placeholder="company@example.com"
                    />
                    {errors.companyInfo?.email && (
                      <p className="text-red-500 text-sm">{errors.companyInfo.email.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="companyInfo.phone">Phone</Label>
                    <Input
                      id="companyInfo.phone"
                      {...register('companyInfo.phone')}
                      placeholder="+1-555-0123"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="companyInfo.website">Website</Label>
                    <Input
                      id="companyInfo.website"
                      {...register('companyInfo.website')}
                      placeholder="https://company.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="companyInfo.taxId">Tax ID</Label>
                    <Input
                      id="companyInfo.taxId"
                      {...register('companyInfo.taxId')}
                      placeholder="Tax identification number"
                    />
                  </div>

                  {watch('invoiceSystem') === InvoiceSystem.TUNISIAN && (
                    <>
                      <div className="space-y-2">
                    <Label htmlFor="companyInfo.tvaNumber">TVA Number</Label>
                    <Input
                      id="companyInfo.tvaNumber"
                      {...register('companyInfo.tvaNumber')}
                      placeholder="Tunisian TVA number"
                    />
                      </div>

                      <div className="space-y-2">
                    <Label htmlFor="companyInfo.mfNumber">Matricule Fiscal</Label>
                    <Input
                      id="companyInfo.mfNumber"
                      {...register('companyInfo.mfNumber')}
                      placeholder="Matricule fiscal number"
                    />
                      </div>
                    </>
                  )}
                </div>

                <div className="mt-6 space-y-2">
                  <Label htmlFor="companyInfo.address">Address</Label>
                  <Textarea
                    id="companyInfo.address"
                    {...register('companyInfo.address')}
                    placeholder="Complete company address"
                    rows={3}
                  />
                </div>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="companyInfo.city">City</Label>
                    <Input
                      id="companyInfo.city"
                      {...register('companyInfo.city')}
                      placeholder="City"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="companyInfo.postalCode">Postal Code</Label>
                    <Input
                      id="companyInfo.postalCode"
                      {...register('companyInfo.postalCode')}
                      placeholder="Postal code"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="companyInfo.country">Country</Label>
                    <Input
                      id="companyInfo.country"
                      {...register('companyInfo.country')}
                      placeholder="Country"
                    />
                  </div>
                </div>
              </div>

              {/* Bank Details Section */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium mb-4">Bank Details</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Bank account information will be displayed on invoices for payment instructions
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="bankDetails.bankName">Bank Name</Label>
                    <Input
                      id="bankDetails.bankName"
                      {...register('bankDetails.bankName')}
                      placeholder="Bank name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bankDetails.accountNumber">Account Number</Label>
                    <Input
                      id="bankDetails.accountNumber"
                      {...register('bankDetails.accountNumber')}
                      placeholder="Account number"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bankDetails.iban">IBAN</Label>
                    <Input
                      id="bankDetails.iban"
                      {...register('bankDetails.iban')}
                      placeholder="International Bank Account Number"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bankDetails.swift">SWIFT/BIC</Label>
                    <Input
                      id="bankDetails.swift"
                      {...register('bankDetails.swift')}
                      placeholder="SWIFT/BIC code"
                    />
                  </div>

                  {watch('invoiceSystem') === InvoiceSystem.TUNISIAN && (
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="bankDetails.rib">RIB (Relevé d'Identité Bancaire)</Label>
                      <Input
                        id="bankDetails.rib"
                        {...register('bankDetails.rib')}
                        placeholder="Tunisian bank account identifier"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    console.log('=== DEBUG FORM STATE ===');
                    console.log('Current form values:', watch());
                    console.log('Current invoice system:', currentInvoiceSystem);
                    console.log('Form errors:', errors);
                    console.log('=== DEBUG FORM STATE END ===');
                  }}
                >
                  Debug Form
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href="/dashboard">Cancel</Link>
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}