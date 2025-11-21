import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';
import { InvoiceStatus } from '@/generated/prisma';

export const analyticsRouter = createTRPCRouter({
  getDashboardStats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const [
      totalInvoices,
      totalClients,
      pendingInvoices,
      paidInvoices,
      overdueInvoices,
      totalRevenue,
      pendingRevenue,
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
      ctx.db.invoice.aggregate({
        where: { userId, status: InvoiceStatus.PAID },
        _sum: { total: true },
      }),
      ctx.db.invoice.aggregate({
        where: { 
          userId, 
          status: { in: [InvoiceStatus.SENT, InvoiceStatus.OVERDUE] }
        },
        _sum: { total: true },
      }),
    ]);

    return {
      totalInvoices,
      totalClients,
      pendingInvoices,
      paidInvoices,
      overdueInvoices,
      totalRevenue: Number(totalRevenue._sum.total || 0),
      pendingRevenue: Number(pendingRevenue._sum.total || 0),
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

      invoices.forEach(invoice => {
        const month = invoice.issueDate.getMonth();
        monthlyRevenue[month].revenue += Number(invoice.total);
        monthlyRevenue[month].invoiceCount += 1;
      });

      return monthlyRevenue;
    }),

  getTopClients: protectedProcedure
    .input(z.object({ limit: z.number().default(5) }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const clients = await ctx.db.client.findMany({
        where: { userId },
        include: {
          invoices: {
            where: { status: InvoiceStatus.PAID },
            select: { total: true },
          },
        },
      });

      const clientStats = clients
        .map(client => ({
          id: client.id,
          name: client.name,
          email: client.email,
          totalRevenue: client.invoices.reduce(
            (sum, invoice) => sum + Number(invoice.total),
            0
          ),
          invoiceCount: client.invoices.length,
        }))
        .filter(client => client.totalRevenue > 0)
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, input.limit);

      return clientStats;
    }),

  getInvoiceStatusDistribution: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const statusCounts = await ctx.db.invoice.groupBy({
      by: ['status'],
      where: { userId },
      _count: { status: true },
      _sum: { total: true },
    });

    return statusCounts.map(item => ({
      status: item.status,
      count: item._count.status,
      totalAmount: Number(item._sum.total || 0),
    }));
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