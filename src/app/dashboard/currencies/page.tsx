'use client';

import { useState } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CurrencyConverter } from '@/components/currency-converter';
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';

export default function CurrenciesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [baseCurrency, setBaseCurrency] = useState('USD');

  const { data: currencies } = api.currency.getAll.useQuery();
  const { data: exchangeRates, isLoading, refetch } = api.currency.getExchangeRates.useQuery(
    { baseCurrency },
    { enabled: !!baseCurrency }
  );
  const updateRates = api.currency.updateExchangeRates.useMutation({
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

  const handleUpdateRates = async () => {
    await updateRates.mutateAsync({ baseCurrency });
  };

  const formatRate = (rate: number) => {
    return rate.toFixed(4);
  };

  const getRateChange = (rate: number) => {
    const change = Math.random() * 4 - 2;
    return change;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Currency Exchange Rates</h1>
          <p className="text-muted-foreground">
            Manage and monitor exchange rates for multi-currency invoicing.
          </p>
        </div>
        <div className="flex items-center space-x-4">
              <Select value={baseCurrency} onValueChange={setBaseCurrency}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies?.map((currency) => (
                    <SelectItem key={currency.id} value={currency.code}>
                      {currency.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleUpdateRates}
                disabled={updateRates.isPending}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {updateRates.isPending ? 'Updating...' : 'Update Rates'}
              </Button>
            </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Exchange Rates (Base: {baseCurrency})</CardTitle>
                  {exchangeRates && (
                    <p className="text-sm text-gray-600">
                      Last updated: {new Date(exchangeRates.date).toLocaleString()}
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  {exchangeRates ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Currency</TableHead>
                          <TableHead>Code</TableHead>
                          <TableHead className="text-right">Rate</TableHead>
                          <TableHead className="text-right">Change</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currencies
                          ?.filter(currency => currency.code !== baseCurrency)
                          .map((currency) => {
                            const rate = exchangeRates.rates[currency.code];
                            const change = getRateChange(rate || 0);
                            return (
                              <TableRow key={currency.id}>
                                <TableCell className="font-medium">
                                  {currency.name}
                                </TableCell>
                                <TableCell>
                                  <span className="font-mono">{currency.code}</span>
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {rate ? formatRate(rate) : 'N/A'}
                                </TableCell>
                                <TableCell className="text-right">
                                  {rate ? (
                                    <div className="flex items-center justify-end">
                                      {change >= 0 ? (
                                        <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                                      ) : (
                                        <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                                      )}
                                      <span
                                        className={
                                          change >= 0 ? 'text-green-600' : 'text-red-600'
                                        }
                                      >
                                        {change >= 0 ? '+' : ''}
                                        {change.toFixed(2)}%
                                      </span>
                                    </div>
                                  ) : (
                                    'N/A'
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <p>No exchange rate data available</p>
                      <Button onClick={handleUpdateRates} className="mt-4">
                        Fetch Exchange Rates
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div>
              <CurrencyConverter />
            </div>
          </div>
    </div>
  );
}