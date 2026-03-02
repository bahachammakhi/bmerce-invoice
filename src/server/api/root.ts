import { createTRPCRouter } from '@/server/api/trpc';
import { clientRouter } from '@/server/api/routers/client';
import { invoiceRouter } from '@/server/api/routers/invoice';
import { currencyRouter } from '@/server/api/routers/currency';
import { analyticsRouter } from '@/server/api/routers/analytics';
import { customFieldsRouter } from '@/server/api/routers/custom-fields';
import { debugRouter } from '@/server/api/routers/debug';
import { userRouter } from '@/server/api/routers/user';
import { paymentRouter } from '@/server/api/routers/payment';

export const appRouter = createTRPCRouter({
  clients: clientRouter,
  invoice: invoiceRouter,
  currency: currencyRouter,
  analytics: analyticsRouter,
  customFields: customFieldsRouter,
  debug: debugRouter,
  user: userRouter,
  payment: paymentRouter,
});

export type AppRouter = typeof appRouter;