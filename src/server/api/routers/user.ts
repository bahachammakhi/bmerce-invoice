import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';
import { InvoiceSystem } from '@/generated/prisma';

const companyInfoSchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  website: z.string().optional(),
  taxId: z.string().optional(),
  // Tunisian specific
  tvaNumber: z.string().optional(),
  mfNumber: z.string().optional(),
});

export const userRouter = createTRPCRouter({
  getSettings: protectedProcedure.query(async ({ ctx }) => {
    console.log('=== USER.GETSETTINGS START ===');
    console.log('User ID:', ctx.session.user.id);
    
    const result = await ctx.db.user.findUnique({
      where: {
        id: ctx.session.user.id,
      },
      select: {
        invoiceSystem: true,
        companyInfo: true,
      },
    });
    
    console.log('getSettings result:', JSON.stringify(result, null, 2));
    console.log('=== USER.GETSETTINGS END ===');
    return result;
  }),

  updateSettings: protectedProcedure
    .input(
      z.object({
        invoiceSystem: z.nativeEnum(InvoiceSystem),
        companyInfo: companyInfoSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      console.log('=== USER.UPDATESETTINGS START ===');
      console.log('User ID:', ctx.session.user.id);
      console.log('Input invoice system:', input.invoiceSystem);
      console.log('Input invoice system type:', typeof input.invoiceSystem);
      console.log('Input company info:', JSON.stringify(input.companyInfo, null, 2));
      
      const result = await ctx.db.user.update({
        where: {
          id: ctx.session.user.id,
        },
        data: {
          invoiceSystem: input.invoiceSystem,
          companyInfo: input.companyInfo,
        },
      });
      
      console.log('updateSettings result:', JSON.stringify(result, null, 2));
      console.log('=== USER.UPDATESETTINGS END ===');
      return result;
    }),
});