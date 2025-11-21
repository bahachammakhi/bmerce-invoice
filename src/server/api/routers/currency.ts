import { z } from 'zod';
import { createTRPCRouter, publicProcedure, protectedProcedure } from '@/server/api/trpc';
import { ExchangeRateService } from '@/lib/exchange-rates';

export const currencyRouter = createTRPCRouter({
  getAll: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.currency.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        code: 'asc',
      },
    });
  }),

  getExchangeRates: protectedProcedure
    .input(z.object({ baseCurrency: z.string().optional() }))
    .query(async ({ input }) => {
      try {
        return await ExchangeRateService.getExchangeRates(input.baseCurrency);
      } catch (error) {
        throw new Error('Failed to fetch exchange rates');
      }
    }),

  convertCurrency: protectedProcedure
    .input(
      z.object({
        amount: z.number(),
        fromCurrency: z.string(),
        toCurrency: z.string(),
      })
    )
    .query(async ({ input }) => {
      try {
        return await ExchangeRateService.convertCurrency(
          input.amount,
          input.fromCurrency,
          input.toCurrency
        );
      } catch (error) {
        throw new Error('Failed to convert currency');
      }
    }),

  updateExchangeRates: protectedProcedure
    .input(z.object({ baseCurrency: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const rates = await ExchangeRateService.getExchangeRates(input.baseCurrency);
        
        const currencies = await ctx.db.currency.findMany({
          where: { isActive: true },
        });

        for (const currency of currencies) {
          if (currency.code === input.baseCurrency) continue;
          
          const rate = rates.rates[currency.code];
          if (rate) {
            await ctx.db.exchangeRate.upsert({
              where: {
                fromCurrency_toCurrency_date: {
                  fromCurrency: input.baseCurrency,
                  toCurrency: currency.code,
                  date: new Date(rates.date),
                },
              },
              update: {
                rate,
              },
              create: {
                fromCurrency: input.baseCurrency,
                toCurrency: currency.code,
                rate,
                date: new Date(rates.date),
              },
            });
          }
        }

        return { success: true, date: rates.date };
      } catch (error) {
        throw new Error('Failed to update exchange rates');
      }
    }),
});