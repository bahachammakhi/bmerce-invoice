import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ExchangeRateService } from '@/lib/exchange-rates';

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all active currencies
    const currencies = await db.currency.findMany({
      where: { isActive: true },
      select: { code: true },
    });

    const currencyCodes = currencies.map((c) => c.code);
    const results: Record<string, any> = {};

    // Fetch rates for each currency as base
    for (const baseCode of currencyCodes) {
      try {
        const rates = await ExchangeRateService.getExchangeRates(baseCode);

        // Save to history table
        for (const targetCode of currencyCodes) {
          if (baseCode !== targetCode && rates.rates[targetCode]) {
            await db.exchangeRateHistory.create({
              data: {
                fromCurrency: baseCode,
                toCurrency: targetCode,
                rate: rates.rates[targetCode],
                source: 'SCHEDULED',
                fetchedAt: new Date(),
              },
            });
          }
        }

        results[baseCode] = {
          success: true,
          ratesCount: Object.keys(rates.rates).length,
        };
      } catch (error) {
        console.error(`Error updating rates for ${baseCode}:`, error);
        results[baseCode] = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
