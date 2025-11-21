export interface ExchangeRateResponse {
  base: string;
  date: string;
  rates: Record<string, number>;
}

export class ExchangeRateService {
  private static readonly API_URL = 'https://api.exchangerate-api.com/v4/latest';
  private static readonly CACHE_DURATION = 3600000; // 1 hour in milliseconds
  private static cache = new Map<string, { data: ExchangeRateResponse; timestamp: number }>();

  static async getExchangeRates(baseCurrency: string = 'USD'): Promise<ExchangeRateResponse> {
    const cacheKey = baseCurrency;
    const cached = this.cache.get(cacheKey);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      const response = await fetch(`${this.API_URL}/${baseCurrency}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: ExchangeRateResponse = await response.json();
      
      this.cache.set(cacheKey, { data, timestamp: now });
      
      return data;
    } catch (error) {
      console.error('Failed to fetch exchange rates:', error);
      
      if (cached) {
        console.warn('Using stale exchange rate data');
        return cached.data;
      }
      
      throw new Error('Unable to fetch exchange rates');
    }
  }

  static async convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<number> {
    if (fromCurrency === toCurrency) {
      return amount;
    }

    const rates = await this.getExchangeRates(fromCurrency);
    const rate = rates.rates[toCurrency];
    
    if (!rate) {
      throw new Error(`Exchange rate not found for ${toCurrency}`);
    }
    
    return amount * rate;
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
}