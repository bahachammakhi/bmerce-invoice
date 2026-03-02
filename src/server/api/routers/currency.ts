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

  getHistoricalRates: protectedProcedure
    .input(
      z.object({
        fromCurrency: z.string(),
        toCurrency: z.string(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        limit: z.number().min(1).max(100).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = {
        fromCurrency: input.fromCurrency,
        toCurrency: input.toCurrency,
      };

      if (input.startDate || input.endDate) {
        where.fetchedAt = {};
        if (input.startDate) where.fetchedAt.gte = input.startDate;
        if (input.endDate) where.fetchedAt.lte = input.endDate;
      }

      return ctx.db.exchangeRateHistory.findMany({
        where,
        orderBy: { fetchedAt: 'desc' },
        take: input.limit || 30,
      });
    }),

  convertInvoice: protectedProcedure
    .input(
      z.object({
        invoiceId: z.string(),
        targetCurrencyId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get invoice with current currency
      const invoice = await ctx.db.invoice.findUnique({
        where: {
          id: input.invoiceId,
          userId: ctx.session.user.id,
        },
        include: {
          currency: true,
          items: true,
          payments: true,
        },
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Check if invoice has payments
      if (invoice.payments.length > 0) {
        throw new Error('Cannot convert invoice with existing payments');
      }

      // Get target currency
      const targetCurrency = await ctx.db.currency.findUnique({
        where: { id: input.targetCurrencyId },
      });

      if (!targetCurrency) {
        throw new Error('Target currency not found');
      }

      // Get exchange rate
      const rate = await ExchangeRateService.getRate(
        invoice.currency.code,
        targetCurrency.code,
        ctx.db
      );

      if (!rate) {
        throw new Error('Exchange rate not available');
      }

      // Convert amounts
      const convertedSubtotal = Number(invoice.subtotal) * rate;
      const convertedTaxAmount = Number(invoice.taxAmount) * rate;
      const convertedTotal = Number(invoice.total) * rate;
      const convertedTimbre = invoice.timbreAmount ? Number(invoice.timbreAmount) * rate : 0;
      const convertedWithholding = Number(invoice.withholdingTax) * rate;

      // Record conversion
      await ctx.db.currencyConversion.create({
        data: {
          invoiceId: invoice.id,
          originalCurrency: invoice.currency.code,
          originalAmount: invoice.total,
          targetCurrency: targetCurrency.code,
          targetAmount: convertedTotal,
          exchangeRate: rate,
        },
      });

      // Update invoice
      const updatedInvoice = await ctx.db.invoice.update({
        where: { id: input.invoiceId },
        data: {
          originalCurrencyId: invoice.currencyId,
          currencyId: input.targetCurrencyId,
          conversionRate: rate,
          subtotal: convertedSubtotal,
          taxAmount: convertedTaxAmount,
          total: convertedTotal,
          timbreAmount: convertedTimbre > 0 ? convertedTimbre : null,
          withholdingTax: convertedWithholding,
          items: {
            deleteMany: {},
            create: invoice.items.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: Number(item.unitPrice) * rate,
              total: Number(item.total) * rate,
              taxRate: item.taxRate,
            })),
          },
        },
        include: {
          currency: true,
          items: true,
        },
      });

      return {
        success: true,
        invoice: updatedInvoice,
        exchangeRate: rate,
        originalCurrency: invoice.currency.code,
        targetCurrency: targetCurrency.code,
      };
    }),
});