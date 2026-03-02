import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';
import { PaymentMethod, InvoiceStatus } from '@/generated/prisma';

export const paymentRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        invoiceId: z.string(),
        amount: z.number().positive('Amount must be positive'),
        paymentDate: z.date().optional(),
        method: z.nativeEnum(PaymentMethod),
        reference: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get invoice to validate payment amount
      const invoice = await ctx.db.invoice.findUnique({
        where: {
          id: input.invoiceId,
          userId: ctx.session.user.id,
        },
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Calculate remaining balance
      const currentPaid = Number(invoice.amountPaid);
      const total = Number(invoice.total);
      const remainingBalance = total - currentPaid;

      // Validate payment amount doesn't exceed remaining balance
      if (input.amount > remainingBalance) {
        throw new Error(
          `Payment amount (${input.amount}) exceeds remaining balance (${remainingBalance})`
        );
      }

      // Create payment
      const payment = await ctx.db.payment.create({
        data: {
          amount: input.amount,
          paymentDate: input.paymentDate || new Date(),
          method: input.method,
          reference: input.reference,
          notes: input.notes,
          invoiceId: input.invoiceId,
        },
      });

      // Update invoice amountPaid
      const newAmountPaid = currentPaid + input.amount;
      const isFullyPaid = newAmountPaid >= total;

      await ctx.db.invoice.update({
        where: { id: input.invoiceId },
        data: {
          amountPaid: newAmountPaid,
          paidAt: isFullyPaid ? new Date() : null,
          status: isFullyPaid ? InvoiceStatus.PAID : invoice.status,
        },
      });

      return payment;
    }),

  getByInvoice: protectedProcedure
    .input(z.object({ invoiceId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify user owns this invoice
      const invoice = await ctx.db.invoice.findUnique({
        where: {
          id: input.invoiceId,
          userId: ctx.session.user.id,
        },
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      return ctx.db.payment.findMany({
        where: {
          invoiceId: input.invoiceId,
        },
        orderBy: {
          paymentDate: 'desc',
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        amount: z.number().positive().optional(),
        paymentDate: z.date().optional(),
        method: z.nativeEnum(PaymentMethod).optional(),
        reference: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;

      // Get payment and verify ownership through invoice
      const payment = await ctx.db.payment.findUnique({
        where: { id },
        include: {
          invoice: true,
        },
      });

      if (!payment || payment.invoice.userId !== ctx.session.user.id) {
        throw new Error('Payment not found');
      }

      // If amount is changing, validate the new total
      if (input.amount !== undefined && input.amount !== Number(payment.amount)) {
        const invoice = payment.invoice;
        const otherPayments = await ctx.db.payment.findMany({
          where: {
            invoiceId: invoice.id,
            id: { not: id },
          },
        });

        const otherPaymentsTotal = otherPayments.reduce(
          (sum, p) => sum + Number(p.amount),
          0
        );
        const newTotal = otherPaymentsTotal + input.amount;

        if (newTotal > Number(invoice.total)) {
          throw new Error(
            `Updated payment would exceed invoice total (${invoice.total})`
          );
        }

        // Update invoice amountPaid
        const isFullyPaid = newTotal >= Number(invoice.total);
        await ctx.db.invoice.update({
          where: { id: invoice.id },
          data: {
            amountPaid: newTotal,
            paidAt: isFullyPaid ? new Date() : null,
            status: isFullyPaid ? InvoiceStatus.PAID : invoice.status,
          },
        });
      }

      return ctx.db.payment.update({
        where: { id },
        data: updateData,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Get payment and verify ownership
      const payment = await ctx.db.payment.findUnique({
        where: { id: input.id },
        include: {
          invoice: true,
        },
      });

      if (!payment || payment.invoice.userId !== ctx.session.user.id) {
        throw new Error('Payment not found');
      }

      // Delete payment
      await ctx.db.payment.delete({
        where: { id: input.id },
      });

      // Recalculate invoice amountPaid
      const remainingPayments = await ctx.db.payment.findMany({
        where: {
          invoiceId: payment.invoiceId,
        },
      });

      const newAmountPaid = remainingPayments.reduce(
        (sum, p) => sum + Number(p.amount),
        0
      );

      const invoice = payment.invoice;
      const isFullyPaid = newAmountPaid >= Number(invoice.total);
      const isPastDue =
        invoice.dueDate &&
        new Date(invoice.dueDate) < new Date() &&
        !isFullyPaid;

      // Update invoice status based on payment state
      let newStatus = invoice.status;
      if (isFullyPaid) {
        newStatus = InvoiceStatus.PAID;
      } else if (isPastDue) {
        newStatus = InvoiceStatus.OVERDUE;
      } else if (newAmountPaid > 0) {
        newStatus = InvoiceStatus.SENT;
      }

      await ctx.db.invoice.update({
        where: { id: payment.invoiceId },
        data: {
          amountPaid: newAmountPaid,
          paidAt: isFullyPaid ? new Date() : null,
          status: newStatus,
        },
      });

      return { success: true };
    }),
});
