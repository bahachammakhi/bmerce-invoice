import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';
import { InvoiceStatus } from '@/generated/prisma';
import { PDFGenerator } from '@/lib/pdf-generator';
import { EmailService } from '@/lib/email';
import { generateNextInvoiceNumber, validateInvoiceNumber, formatInvoiceNumber } from '@/lib/invoice-number';

const invoiceItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  taxRate: z.number().min(0).max(100).default(0),
});

export const invoiceRouter = createTRPCRouter({
  getNextNumber: protectedProcedure.query(async ({ ctx }) => {
    return await generateNextInvoiceNumber(ctx.db, ctx.session.user.id);
  }),

  getAll: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.invoice.findMany({
      where: {
        userId: ctx.session.user.id,
      },
      include: {
        client: true,
        currency: true,
        items: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.invoice.findUnique({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
        include: {
          client: true,
          currency: true,
          items: true,
        },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        clientId: z.string(),
        currencyId: z.string(),
        number: z.string().optional(),
        dueDate: z.date().optional(),
        notes: z.string().optional(),
        items: z.array(invoiceItemSchema),
        customFields: z.record(z.any()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { items, number, ...invoiceData } = input;
      
      const subtotal = items.reduce((sum, item) => {
        return sum + (item.quantity * item.unitPrice);
      }, 0);

      const taxAmount = items.reduce((sum, item) => {
        const itemTotal = item.quantity * item.unitPrice;
        return sum + (itemTotal * item.taxRate / 100);
      }, 0);

      const total = subtotal + taxAmount;

      // Generate or validate invoice number
      let invoiceNumber: string;
      if (number && number.trim()) {
        // Manual number provided
        invoiceNumber = formatInvoiceNumber(number.trim());
        const isValid = await validateInvoiceNumber(ctx.db, invoiceNumber, ctx.session.user.id);
        if (!isValid) {
          throw new Error(`Invoice number ${invoiceNumber} already exists`);
        }
      } else {
        // Auto-generate number
        invoiceNumber = await generateNextInvoiceNumber(ctx.db, ctx.session.user.id);
      }

      return ctx.db.invoice.create({
        data: {
          ...invoiceData,
          number: invoiceNumber,
          subtotal,
          taxAmount,
          total,
          userId: ctx.session.user.id,
          items: {
            create: items.map(item => ({
              ...item,
              total: item.quantity * item.unitPrice,
            })),
          },
        },
        include: {
          client: true,
          currency: true,
          items: true,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        clientId: z.string().optional(),
        currencyId: z.string().optional(),
        number: z.string().optional(),
        status: z.nativeEnum(InvoiceStatus).optional(),
        dueDate: z.date().optional(),
        notes: z.string().optional(),
        items: z.array(invoiceItemSchema).optional(),
        customFields: z.record(z.any()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, items, ...invoiceData } = input;

      let updateData: any = { ...invoiceData };

      // Handle invoice number update
      if (input.number !== undefined) {
        if (input.number && input.number.trim()) {
          const formattedNumber = formatInvoiceNumber(input.number.trim());
          const isValid = await validateInvoiceNumber(ctx.db, formattedNumber, ctx.session.user.id, id);
          if (!isValid) {
            throw new Error(`Invoice number ${formattedNumber} already exists`);
          }
          updateData.number = formattedNumber;
        }
      }

      if (items) {
        const subtotal = items.reduce((sum, item) => {
          return sum + (item.quantity * item.unitPrice);
        }, 0);

        const taxAmount = items.reduce((sum, item) => {
          const itemTotal = item.quantity * item.unitPrice;
          return sum + (itemTotal * item.taxRate / 100);
        }, 0);

        const total = subtotal + taxAmount;

        updateData = {
          ...updateData,
          subtotal,
          taxAmount,
          total,
        };

        await ctx.db.invoiceItem.deleteMany({
          where: { invoiceId: id },
        });
      }

      return ctx.db.invoice.update({
        where: {
          id,
          userId: ctx.session.user.id,
        },
        data: {
          ...updateData,
          ...(items && {
            items: {
              create: items.map(item => ({
                ...item,
                total: item.quantity * item.unitPrice,
              })),
            },
          }),
        },
        include: {
          client: true,
          currency: true,
          items: true,
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.invoice.delete({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
      });
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.nativeEnum(InvoiceStatus),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.invoice.update({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
        data: {
          status: input.status,
        },
      });
    }),

  sendEmail: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        to: z.string().email(),
        subject: z.string().optional(),
        message: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.findUnique({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
        include: {
          client: true,
          currency: true,
          items: true,
        },
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      const invoiceData = {
        id: invoice.id,
        number: invoice.number,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate || undefined,
        status: invoice.status,
        subtotal: Number(invoice.subtotal),
        taxAmount: Number(invoice.taxAmount),
        total: Number(invoice.total),
        notes: invoice.notes || undefined,
        client: {
          name: invoice.client.name,
          email: invoice.client.email || undefined,
          phone: invoice.client.phone || undefined,
          address: invoice.client.address || undefined,
          city: invoice.client.city || undefined,
          postalCode: invoice.client.postalCode || undefined,
          country: invoice.client.country || undefined,
          taxId: invoice.client.taxId || undefined,
        },
        currency: {
          code: invoice.currency.code,
          symbol: invoice.currency.symbol,
        },
        items: invoice.items.map(item => ({
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          taxRate: Number(item.taxRate),
          total: Number(item.total),
        })),
      };

      const pdf = PDFGenerator.generateInvoicePDF(invoiceData);
      const pdfBuffer = Buffer.from(pdf.output('arraybuffer'));

      const success = await EmailService.sendInvoice(invoiceData, pdfBuffer, {
        to: input.to,
        subject: input.subject,
        message: input.message,
      });

      if (success && invoice.status === InvoiceStatus.DRAFT) {
        await ctx.db.invoice.update({
          where: { id: input.id },
          data: { status: InvoiceStatus.SENT },
        });
      }

      return { success };
    }),

  sendReminder: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        reminderType: z.enum(['payment', 'overdue']),
        customMessage: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.findUnique({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
        include: {
          client: true,
          currency: true,
          items: true,
        },
      });

      if (!invoice || !invoice.client.email) {
        throw new Error('Invoice not found or client has no email');
      }

      const invoiceData = {
        id: invoice.id,
        number: invoice.number,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate || undefined,
        status: invoice.status,
        subtotal: Number(invoice.subtotal),
        taxAmount: Number(invoice.taxAmount),
        total: Number(invoice.total),
        notes: invoice.notes || undefined,
        client: {
          name: invoice.client.name,
          email: invoice.client.email || undefined,
          phone: invoice.client.phone || undefined,
          address: invoice.client.address || undefined,
          city: invoice.client.city || undefined,
          postalCode: invoice.client.postalCode || undefined,
          country: invoice.client.country || undefined,
          taxId: invoice.client.taxId || undefined,
        },
        currency: {
          code: invoice.currency.code,
          symbol: invoice.currency.symbol,
        },
        items: invoice.items.map(item => ({
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          taxRate: Number(item.taxRate),
          total: Number(item.total),
        })),
      };

      const success = await EmailService.sendInvoiceReminder(
        invoiceData,
        invoice.client.email,
        {
          reminderType: input.reminderType,
          customMessage: input.customMessage,
        }
      );

      return { success };
    }),
});