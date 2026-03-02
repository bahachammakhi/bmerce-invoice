import { db } from '@/lib/db';
import type { PrismaClient } from '@/generated/prisma';

export interface ExchangeRateResponse {
  base: string;
  date: string;
  rates: Record<string, number>;
}

export class ExchangeRateService {
  private static readonly API_URL = 'https://api.exchangerate-api.com/v4/latest';
  private static readonly CACHE_DURATION = 3600000; // 1 hour in milliseconds
  private static readonly DB_CACHE_DURATION = 86400000; // 24 hours in milliseconds
  private static cache = new Map<string, { data: ExchangeRateResponse; timestamp: number }>();

  /**
   * Get exchange rate from database (most recent within 24 hours)
   */
  static async getRateFromDB(
    fromCurrency: string,
    toCurrency: string,
    prisma: PrismaClient = db
  ): Promise<number | null> {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - this.DB_CACHE_DURATION);

      const rate = await prisma.exchangeRate.findFirst({
        where: {
          fromCurrency,
          toCurrency,
          date: {
            gte: twentyFourHoursAgo,
          },
        },
        orderBy: {
          date: 'desc',
        },
      });

      return rate ? Number(rate.rate) : null;
    } catch (error) {
      console.error('Error fetching rate from DB:', error);
      return null;
    }
  }

  /**
   * Save exchange rates to database for persistence
   */
  static async saveRatesToDB(
    baseCurrency: string,
    rates: Record<string, number>,
    prisma: PrismaClient = db
  ): Promise<void> {
    try {
      const date = new Date();

      // Save all rates to database
      const promises = Object.entries(rates).map(([toCurrency, rate]) =>
        prisma.exchangeRate.upsert({
          where: {
            fromCurrency_toCurrency_date: {
              fromCurrency: baseCurrency,
              toCurrency,
              date,
            },
          },
          create: {
            fromCurrency: baseCurrency,
            toCurrency,
            rate,
            date,
          },
          update: {
            rate,
          },
        })
      );

      await Promise.all(promises);
    } catch (error) {
      console.error('Error saving rates to DB:', error);
      // Don't throw - this is a non-critical operation
    }
  }

  /**
   * Get exchange rates with 3-tier fallback: Memory Cache → Database → API
   */
  static async getExchangeRates(baseCurrency: string = 'USD'): Promise<ExchangeRateResponse> {
    const cacheKey = baseCurrency;
    const cached = this.cache.get(cacheKey);
    const now = Date.now();

    // 1. Check in-memory cache (1 hour)
    if (cached && (now - cached.timestamp) < this.CACHE_DURATION) {
      return cached.data;
    }

    // 2. Try to fetch from database (24 hours)
    try {
      const dbRates = await this.getRatesFromDB(baseCurrency);
      if (dbRates && Object.keys(dbRates.rates).length > 0) {
        const data: ExchangeRateResponse = {
          base: baseCurrency,
          date: dbRates.date,
          rates: dbRates.rates,
        };
        this.cache.set(cacheKey, { data, timestamp: now });
        return data;
      }
    } catch (error) {
      console.warn('Failed to fetch rates from DB:', error);
    }

    // 3. Fetch from API
    try {
      const response = await fetch(`${this.API_URL}/${baseCurrency}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ExchangeRateResponse = await response.json();

      // Cache in memory
      this.cache.set(cacheKey, { data, timestamp: now });

      // Save to database for future use
      await this.saveRatesToDB(baseCurrency, data.rates);

      return data;
    } catch (error) {
      console.error('Failed to fetch exchange rates from API:', error);

      // 4. Use stale memory cache as last resort
      if (cached) {
        console.warn('Using stale in-memory exchange rate data');
        return cached.data;
      }

      throw new Error('Unable to fetch exchange rates from any source');
    }
  }

  /**
   * Get all rates for a base currency from database
   */
  private static async getRatesFromDB(
    baseCurrency: string
  ): Promise<{ date: string; rates: Record<string, number> } | null> {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - this.DB_CACHE_DURATION);

      const rates = await db.exchangeRate.findMany({
        where: {
          fromCurrency: baseCurrency,
          date: {
            gte: twentyFourHoursAgo,
          },
        },
        orderBy: {
          date: 'desc',
        },
      });

      if (rates.length === 0) {
        return null;
      }

      const ratesMap: Record<string, number> = {};
      for (const rate of rates) {
        if (!ratesMap[rate.toCurrency]) {
          ratesMap[rate.toCurrency] = Number(rate.rate);
        }
      }

      return {
        date: rates[0].date.toISOString().split('T')[0],
        rates: ratesMap,
      };
    } catch (error) {
      console.error('Error fetching rates from DB:', error);
      return null;
    }
  }

  /**
   * Convert amount from one currency to another using DB-backed rates
   */
  static async convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    prisma: PrismaClient = db
  ): Promise<number> {
    if (fromCurrency === toCurrency) {
      return amount;
    }

    // Try to get rate from DB first
    const dbRate = await this.getRateFromDB(fromCurrency, toCurrency, prisma);
    if (dbRate) {
      return amount * dbRate;
    }

    // Fallback to API
    const rates = await this.getExchangeRates(fromCurrency);
    const rate = rates.rates[toCurrency];

    if (!rate) {
      throw new Error(`Exchange rate not found for ${toCurrency}`);
    }

    return amount * rate;
  }

  /**
   * Convert amount with explicit DB context (useful for tRPC procedures)
   */
  static async convertWithDB(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    prisma: PrismaClient
  ): Promise<number> {
    return this.convertCurrency(amount, fromCurrency, toCurrency, prisma);
  }

  static async getMultipleCurrencyRates(
    currencies: string[],
    baseCurrency: string = 'USD'
  ): Promise<Record<string, number>> {
    const rates = await this.getExchangeRates(baseCurrency);
    const result: Record<string, number> = {};

    for (const currency of currencies) {
      if (currency === baseCurrency) {
        result[currency] = 1;
      } else {
        result[currency] = rates.rates[currency] || 0;
      }
    }

    return result;
  }

  /**
   * Get a specific exchange rate between two currencies
   */
  static async getRate(
    fromCurrency: string,
    toCurrency: string,
    prisma: PrismaClient = db
  ): Promise<number | null> {
    if (fromCurrency === toCurrency) {
      return 1;
    }

    // Try DB first
    const dbRate = await this.getRateFromDB(fromCurrency, toCurrency, prisma);
    if (dbRate) {
      return dbRate;
    }

    // Fallback to API
    try {
      const rates = await this.getExchangeRates(fromCurrency);
      return rates.rates[toCurrency] || null;
    } catch (error) {
      console.error('Error getting exchange rate:', error);
      return null;
    }
  }
}