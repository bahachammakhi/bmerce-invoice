'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowUpDown, RefreshCw } from 'lucide-react';

export function CurrencyConverter() {
  const [amount, setAmount] = useState(1);
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('EUR');
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);

  const { data: currencies } = api.currency.getAll.useQuery();
  const { data: exchangeRates, refetch: refetchRates } = api.currency.getExchangeRates.useQuery(
    { baseCurrency: fromCurrency },
    { enabled: !!fromCurrency }
  );

  useEffect(() => {
    if (exchangeRates && toCurrency && amount) {
      const rate = exchangeRates.rates[toCurrency];
      if (rate) {
        setConvertedAmount(amount * rate);
      }
    }
  }, [exchangeRates, toCurrency, amount]);

  const handleSwapCurrencies = () => {
    const temp = fromCurrency;
    setFromCurrency(toCurrency);
    setToCurrency(temp);
  };

  const handleRefreshRates = () => {
    refetchRates();
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Currency Converter
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshRates}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            placeholder="Enter amount"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 items-end">
          <div className="space-y-2">
            <Label>From</Label>
            <Select value={fromCurrency} onValueChange={setFromCurrency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies?.map((currency) => (
                  <SelectItem key={currency.id} value={currency.code}>
                    {currency.code} - {currency.symbol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSwapCurrencies}
            className="h-10"
          >
            <ArrowUpDown className="w-4 h-4" />
          </Button>

          <div className="space-y-2">
            <Label>To</Label>
            <Select value={toCurrency} onValueChange={setToCurrency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies?.map((currency) => (
                  <SelectItem key={currency.id} value={currency.code}>
                    {currency.code} - {currency.symbol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {convertedAmount !== null && (
          <div className="pt-4 border-t">
            <div className="text-center">
              <p className="text-sm text-gray-600">Converted Amount</p>
              <p className="text-2xl font-bold">
                {currencies?.find(c => c.code === toCurrency)?.symbol}{convertedAmount.toFixed(2)}
              </p>
              {exchangeRates && (
                <p className="text-xs text-gray-500 mt-2">
                  1 {fromCurrency} = {exchangeRates.rates[toCurrency]?.toFixed(4)} {toCurrency}
                  <br />
                  Last updated: {new Date(exchangeRates.date).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}