import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';
import { InvoiceStatus } from '@/generated/prisma';
import { PDFGenerator } from '@/lib/pdf-generator';
import { TunisianPDFGenerator } from '@/lib/tunisian-pdf-generator';
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
          user: {
            select: {
              name: true,
              email: true,
              companyInfo: true,
              bankDetails: true,
              invoiceSystem: true,
            },
          },
        },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        clientId: z.string(),
        currencyId: z.string(),
        number: z.string().optional(),
        issueDate: z.coerce.date().optional(),
        dueDate: z.coerce.date().optional(),
        notes: z.string().optional(),
        items: z.array(invoiceItemSchema),
        customFields: z.record(z.any()).optional(),
        
        // New fields
        timbreAmount: z.number().optional(),
        withholdingTax: z.number().optional(),
        isTaxExempt: z.boolean().optional(),
        exemptionReason: z.string().optional(),
        tvaNumber: z.string().optional(),
        mfNumber: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { items, number, ...invoiceData } = input;
      
      const subtotal = items.reduce((sum, item) => {
        return sum + (item.quantity * item.unitPrice);
      }, 0);

      let taxAmount = 0;
      if (!input.isTaxExempt) {
        taxAmount = items.reduce((sum, item) => {
          const itemTotal = item.quantity * item.unitPrice;
          return sum + (itemTotal * item.taxRate / 100);
        }, 0);
      }

      const timbreAmount = !input.isTaxExempt && input.timbreAmount ? input.timbreAmount : 0;
      const withholdingTax = input.withholdingTax || 0;

      const total = subtotal + taxAmount + timbreAmount - withholdingTax;

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
          timbreAmount,
          withholdingTax,
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
        issueDate: z.coerce.date().optional(),
        dueDate: z.coerce.date().optional(),
        notes: z.string().optional(),
        items: z.array(invoiceItemSchema).optional(),
        customFields: z.record(z.any()).optional(),
        
        // New fields
        timbreAmount: z.number().optional(),
        withholdingTax: z.number().optional(),
        isTaxExempt: z.boolean().optional(),
        exemptionReason: z.string().optional(),
        tvaNumber: z.string().optional(),
        mfNumber: z.string().optional(),
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

      // If items are updated OR tax fields are updated, we need to recalculate
      if (items || input.isTaxExempt !== undefined || input.timbreAmount !== undefined || input.withholdingTax !== undefined) {
        // We need current items if not provided
        let currentItems = items;
        if (!currentItems) {
          const invoice = await ctx.db.invoice.findUnique({
            where: { id },
            include: { items: true },
          });
          if (!invoice) throw new Error('Invoice not found');
          currentItems = invoice.items.map(i => ({
            description: i.description,
            quantity: Number(i.quantity),
            unitPrice: Number(i.unitPrice),
            taxRate: Number(i.taxRate),
          }));
        }

        const subtotal = currentItems.reduce((sum, item) => {
          return sum + (item.quantity * item.unitPrice);
        }, 0);

        // Check if exempt (use new value or fallback to existing if not provided, but here we assume if not provided it doesn't change? 
        // Actually for simplicity, if items change we should probably re-fetch exemption status if not provided.
        // But to be safe let's assume if input.isTaxExempt is undefined, we need to fetch it.
        let isTaxExempt = input.isTaxExempt;
        if (isTaxExempt === undefined) {
           const invoice = await ctx.db.invoice.findUnique({ where: { id }, select: { isTaxExempt: true } });
           isTaxExempt = invoice?.isTaxExempt ?? false;
        }

        let taxAmount = 0;
        if (!isTaxExempt) {
          taxAmount = currentItems.reduce((sum, item) => {
            const itemTotal = item.quantity * item.unitPrice;
            return sum + (itemTotal * item.taxRate / 100);
          }, 0);
        }

        // Timbre
        let timbreAmount = input.timbreAmount;
        if (timbreAmount === undefined) {
           const invoice = await ctx.db.invoice.findUnique({ where: { id }, select: { timbreAmount: true } });
           timbreAmount = Number(invoice?.timbreAmount ?? 0);
        }
        if (isTaxExempt) timbreAmount = 0;

        // Withholding
        let withholdingTax = input.withholdingTax;
        if (withholdingTax === undefined) {
           const invoice = await ctx.db.invoice.findUnique({ where: { id }, select: { withholdingTax: true } });
           withholdingTax = Number(invoice?.withholdingTax ?? 0);
        }

        const total = subtotal + taxAmount + (timbreAmount || 0) - (withholdingTax || 0);

        updateData = {
          ...updateData,
          subtotal,
          taxAmount,
          total,
          timbreAmount, // Ensure this is updated if changed due to exemption
        };

        if (items) {
          await ctx.db.invoiceItem.deleteMany({
            where: { invoiceId: id },
          });
        }
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
      // Fetch user data for invoice system preference and company info
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.session.user.id },
        select: {
          invoiceSystem: true,
          companyInfo: true,
          bankDetails: true,
        },
      });

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

      const isTunisian = user?.invoiceSystem === 'TUNISIAN';
      const companyInfo = (user?.companyInfo as Record<string, unknown>) || {};
      const bankDetails = (user?.bankDetails as Record<string, unknown>) || {};

      // Build base invoice data
      const baseInvoiceData = {
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
        company: {
          name: (companyInfo.name as string) || '',
          address: (companyInfo.address as string) || undefined,
          city: (companyInfo.city as string) || undefined,
          postalCode: (companyInfo.postalCode as string) || undefined,
          country: (companyInfo.country as string) || undefined,
          phone: (companyInfo.phone as string) || undefined,
          email: (companyInfo.email as string) || undefined,
          website: (companyInfo.website as string) || undefined,
          taxId: (companyInfo.taxId as string) || undefined,
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
        bankDetails: {
          bankName: (bankDetails.bankName as string) || undefined,
          accountNumber: (bankDetails.accountNumber as string) || undefined,
          iban: (bankDetails.iban as string) || undefined,
          swift: (bankDetails.swift as string) || undefined,
          rib: (bankDetails.rib as string) || undefined,
        },
      };

      let pdfBuffer: Buffer;

      if (isTunisian) {
        // Build Tunisian invoice data with additional fields
        const tunisianInvoiceData = {
          ...baseInvoiceData,
          timbreAmount: Number(invoice.timbreAmount) || undefined,
          withholdingTax: Number(invoice.withholdingTax) || undefined,
          isTaxExempt: invoice.isTaxExempt || false,
          exemptionReason: invoice.exemptionReason || undefined,
          tvaNumber: invoice.tvaNumber || (companyInfo.tvaNumber as string) || undefined,
          mfNumber: invoice.mfNumber || (companyInfo.mfNumber as string) || undefined,
          company: {
            name: (companyInfo.name as string) || '',
            address: (companyInfo.address as string) || undefined,
            city: (companyInfo.city as string) || undefined,
            postalCode: (companyInfo.postalCode as string) || undefined,
            country: (companyInfo.country as string) || undefined,
            phone: (companyInfo.phone as string) || undefined,
            email: (companyInfo.email as string) || undefined,
            website: (companyInfo.website as string) || undefined,
            taxId: (companyInfo.taxId as string) || undefined,
            tvaNumber: (companyInfo.tvaNumber as string) || undefined,
            mfNumber: (companyInfo.mfNumber as string) || undefined,
          },
          bankDetails: {
            bankName: (bankDetails.bankName as string) || undefined,
            accountNumber: (bankDetails.accountNumber as string) || undefined,
            iban: (bankDetails.iban as string) || undefined,
            swift: (bankDetails.swift as string) || undefined,
            rib: (bankDetails.rib as string) || undefined,
          },
        };

        const pdf = TunisianPDFGenerator.generateInvoicePDF(tunisianInvoiceData);
        pdfBuffer = Buffer.from(pdf.output('arraybuffer'));
      } else {
        // Use standard PDF generator
        const pdf = PDFGenerator.generateInvoicePDF(baseInvoiceData);
        pdfBuffer = Buffer.from(pdf.output('arraybuffer'));
      }

      const success = await EmailService.sendInvoice(baseInvoiceData, pdfBuffer, {
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

  duplicate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const original = await ctx.db.invoice.findUnique({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
        include: {
          items: true,
        },
      });

      if (!original) {
        throw new Error('Invoice not found');
      }

      // Generate new invoice number
      const newNumber = await generateNextInvoiceNumber(ctx.db, ctx.session.user.id);

      // Create duplicate
      return ctx.db.invoice.create({
        data: {
          number: newNumber,
          clientId: original.clientId,
          currencyId: original.currencyId,
          userId: ctx.session.user.id,
          status: InvoiceStatus.DRAFT,
          dueDate: original.dueDate,
          notes: original.notes,
          customFields: original.customFields || undefined,
          subtotal: original.subtotal,
          taxAmount: original.taxAmount,
          total: original.total,
          timbreAmount: original.timbreAmount,
          withholdingTax: original.withholdingTax,
          isTaxExempt: original.isTaxExempt,
          exemptionReason: original.exemptionReason,
          items: {
            create: original.items.map(item => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
              taxRate: item.taxRate,
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

  sendReminder: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        reminderType: z.enum(['payment', 'overdue']),
        customMessage: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Fetch user data for invoice system preference and company info
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.session.user.id },
        select: {
          invoiceSystem: true,
          companyInfo: true,
          bankDetails: true,
        },
      });

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

      const isTunisian = user?.invoiceSystem === 'TUNISIAN';
      const companyInfo = (user?.companyInfo as Record<string, unknown>) || {};
      const bankDetails = (user?.bankDetails as Record<string, unknown>) || {};

      // Build base invoice data
      const baseInvoiceData = {
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
        company: {
          name: (companyInfo.name as string) || '',
          address: (companyInfo.address as string) || undefined,
          city: (companyInfo.city as string) || undefined,
          postalCode: (companyInfo.postalCode as string) || undefined,
          country: (companyInfo.country as string) || undefined,
          phone: (companyInfo.phone as string) || undefined,
          email: (companyInfo.email as string) || undefined,
          website: (companyInfo.website as string) || undefined,
          taxId: (companyInfo.taxId as string) || undefined,
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
        bankDetails: {
          bankName: (bankDetails.bankName as string) || undefined,
          accountNumber: (bankDetails.accountNumber as string) || undefined,
          iban: (bankDetails.iban as string) || undefined,
          swift: (bankDetails.swift as string) || undefined,
          rib: (bankDetails.rib as string) || undefined,
        },
      };

      // Build Tunisian invoice data if needed (for potential future PDF attachment)
      if (isTunisian) {
        const tunisianInvoiceData = {
          ...baseInvoiceData,
          timbreAmount: Number(invoice.timbreAmount) || undefined,
          withholdingTax: Number(invoice.withholdingTax) || undefined,
          isTaxExempt: invoice.isTaxExempt || false,
          exemptionReason: invoice.exemptionReason || undefined,
          tvaNumber: invoice.tvaNumber || (companyInfo.tvaNumber as string) || undefined,
          mfNumber: invoice.mfNumber || (companyInfo.mfNumber as string) || undefined,
          company: {
            name: (companyInfo.name as string) || '',
            address: (companyInfo.address as string) || undefined,
            city: (companyInfo.city as string) || undefined,
            postalCode: (companyInfo.postalCode as string) || undefined,
            country: (companyInfo.country as string) || undefined,
            phone: (companyInfo.phone as string) || undefined,
            email: (companyInfo.email as string) || undefined,
            website: (companyInfo.website as string) || undefined,
            taxId: (companyInfo.taxId as string) || undefined,
            tvaNumber: (companyInfo.tvaNumber as string) || undefined,
            mfNumber: (companyInfo.mfNumber as string) || undefined,
          },
          bankDetails: {
            bankName: (bankDetails.bankName as string) || undefined,
            accountNumber: (bankDetails.accountNumber as string) || undefined,
            iban: (bankDetails.iban as string) || undefined,
            swift: (bankDetails.swift as string) || undefined,
            rib: (bankDetails.rib as string) || undefined,
          },
        };

        // Use Tunisian data for reminder (includes additional fields for context)
        const success = await EmailService.sendInvoiceReminder(
          tunisianInvoiceData,
          invoice.client.email,
          {
            reminderType: input.reminderType,
            customMessage: input.customMessage,
          }
        );

        return { success };
      }

      const success = await EmailService.sendInvoiceReminder(
        baseInvoiceData,
        invoice.client.email,
        {
          reminderType: input.reminderType,
          customMessage: input.customMessage,
        }
      );

      return { success };
    }),
});