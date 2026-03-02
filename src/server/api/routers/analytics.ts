import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';
import { InvoiceStatus } from '@/generated/prisma';
import { ExchangeRateService } from '@/lib/exchange-rates';

export const analyticsRouter = createTRPCRouter({
  getDashboardStats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    // Get user's base currency for normalization
    const user = await ctx.db.user.findUnique({
      where: { id: userId },
      include: { baseCurrency: true },
    });

    const baseCurrency = user?.baseCurrency?.code || 'USD';

    const [
      totalInvoices,
      totalClients,
      pendingInvoices,
      paidInvoices,
      overdueInvoices,
      paidInvoicesData,
      pendingInvoicesData,
    ] = await Promise.all([
      ctx.db.invoice.count({
        where: { userId },
      }),
      ctx.db.client.count({
        where: { userId },
      }),
      ctx.db.invoice.count({
        where: { userId, status: InvoiceStatus.SENT },
      }),
      ctx.db.invoice.count({
        where: { userId, status: InvoiceStatus.PAID },
      }),
      ctx.db.invoice.count({
        where: { userId, status: InvoiceStatus.OVERDUE },
      }),
      // Fetch all paid invoices with currency info for conversion
      ctx.db.invoice.findMany({
        where: { userId, status: InvoiceStatus.PAID },
        select: { total: true, currency: { select: { code: true } } },
      }),
      // Fetch all pending invoices with currency info for conversion
      ctx.db.invoice.findMany({
        where: {
          userId,
          status: { in: [InvoiceStatus.SENT, InvoiceStatus.OVERDUE] }
        },
        select: { total: true, currency: { select: { code: true } } },
      }),
    ]);

    // Convert all revenues to base currency
    let totalRevenue = 0;
    for (const invoice of paidInvoicesData) {
      const amount = Number(invoice.total);
      const converted = await ExchangeRateService.convertWithDB(
        amount,
        invoice.currency.code,
        baseCurrency,
        ctx.db
      );
      totalRevenue += converted;
    }

    let pendingRevenue = 0;
    for (const invoice of pendingInvoicesData) {
      const amount = Number(invoice.total);
      const converted = await ExchangeRateService.convertWithDB(
        amount,
        invoice.currency.code,
        baseCurrency,
        ctx.db
      );
      pendingRevenue += converted;
    }

    return {
      totalInvoices,
      totalClients,
      pendingInvoices,
      paidInvoices,
      overdueInvoices,
      totalRevenue,
      pendingRevenue,
      baseCurrency, // Include base currency in response
    };
  }),

  getRevenueByMonth: protectedProcedure
    .input(z.object({
      year: z.number().optional(),
      currencyCode: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const year = input.year || new Date().getFullYear();
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year + 1, 0, 1);

      // Get user's base currency
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        include: { baseCurrency: true },
      });

      const baseCurrency = user?.baseCurrency?.code || 'USD';

      const invoices = await ctx.db.invoice.findMany({
        where: {
          userId,
          status: InvoiceStatus.PAID,
          issueDate: {
            gte: startDate,
            lt: endDate,
          },
          ...(input.currencyCode && {
            currency: { code: input.currencyCode },
          }),
        },
        select: {
          total: true,
          issueDate: true,
          currency: { select: { code: true, symbol: true } },
        },
      });

      const monthlyRevenue = Array.from({ length: 12 }, (_, index) => ({
        month: index + 1,
        revenue: 0,
        invoiceCount: 0,
      }));

      // Convert each invoice to base currency before summing
      for (const invoice of invoices) {
        const month = invoice.issueDate.getMonth();
        const amount = Number(invoice.total);
        const converted = await ExchangeRateService.convertWithDB(
          amount,
          invoice.currency.code,
          baseCurrency,
          ctx.db
        );
        monthlyRevenue[month].revenue += converted;
        monthlyRevenue[month].invoiceCount += 1;
      }

      return { monthlyRevenue, baseCurrency };
    }),

  getTopClients: protectedProcedure
    .input(z.object({ limit: z.number().default(5) }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Get user's base currency
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        include: { baseCurrency: true },
      });

      const baseCurrency = user?.baseCurrency?.code || 'USD';

      const clients = await ctx.db.client.findMany({
        where: { userId },
        include: {
          invoices: {
            where: { status: InvoiceStatus.PAID },
            select: { total: true, currency: { select: { code: true } } },
          },
        },
      });

      // Convert revenues to base currency for each client
      const clientStats = await Promise.all(
        clients.map(async (client) => {
          let totalRevenue = 0;
          for (const invoice of client.invoices) {
            const amount = Number(invoice.total);
            const converted = await ExchangeRateService.convertWithDB(
              amount,
              invoice.currency.code,
              baseCurrency,
              ctx.db
            );
            totalRevenue += converted;
          }

          return {
            id: client.id,
            name: client.name,
            email: client.email,
            totalRevenue,
            invoiceCount: client.invoices.length,
          };
        })
      );

      const topClients = clientStats
        .filter(client => client.totalRevenue > 0)
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, input.limit);

      return { clients: topClients, baseCurrency };
    }),

  getInvoiceStatusDistribution: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    // Get user's base currency
    const user = await ctx.db.user.findUnique({
      where: { id: userId },
      include: { baseCurrency: true },
    });

    const baseCurrency = user?.baseCurrency?.code || 'USD';

    // Get all invoices grouped by status with currency info
    const invoicesByStatus = await ctx.db.invoice.findMany({
      where: { userId },
      select: {
        status: true,
        total: true,
        currency: { select: { code: true } },
      },
    });

    // Group and convert amounts by status
    const statusMap = new Map<string, { count: number; totalAmount: number }>();

    for (const invoice of invoicesByStatus) {
      const status = invoice.status;
      const amount = Number(invoice.total);
      const converted = await ExchangeRateService.convertWithDB(
        amount,
        invoice.currency.code,
        baseCurrency,
        ctx.db
      );

      if (!statusMap.has(status)) {
        statusMap.set(status, { count: 0, totalAmount: 0 });
      }

      const stat = statusMap.get(status)!;
      stat.count += 1;
      stat.totalAmount += converted;
    }

    const distribution = Array.from(statusMap.entries()).map(([status, data]) => ({
      status,
      count: data.count,
      totalAmount: data.totalAmount,
    }));

    return { distribution, baseCurrency };
  }),

  getCurrencyBreakdown: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const currencyStats = await ctx.db.invoice.groupBy({
      by: ['currencyId'],
      where: { userId },
      _count: { currencyId: true },
      _sum: { total: true },
    });

    const currencies = await ctx.db.currency.findMany({
      where: {
        id: { in: currencyStats.map(stat => stat.currencyId) },
      },
    });

    return currencyStats.map(stat => {
      const currency = currencies.find(c => c.id === stat.currencyId);
      return {
        currency: {
          code: currency?.code || 'Unknown',
          symbol: currency?.symbol || '',
        },
        invoiceCount: stat._count.currencyId,
        totalAmount: Number(stat._sum.total || 0),
      };
    });
  }),

  getRecentActivity: protectedProcedure
    .input(z.object({ limit: z.number().default(10) }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const recentInvoices = await ctx.db.invoice.findMany({
        where: { userId },
        include: {
          client: { select: { name: true } },
          currency: { select: { symbol: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: input.limit,
      });

      return recentInvoices.map(invoice => ({
        id: invoice.id,
        number: invoice.number,
        clientName: invoice.client.name,
        total: Number(invoice.total),
        currencySymbol: invoice.currency.symbol,
        status: invoice.status,
        updatedAt: invoice.updatedAt,
      }));
    }),
});