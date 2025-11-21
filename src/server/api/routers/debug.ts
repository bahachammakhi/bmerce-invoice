import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';

export const debugRouter = createTRPCRouter({
  getSession: protectedProcedure.query(async ({ ctx }) => {
    return {
      sessionUserId: ctx.session.user.id,
      sessionUserEmail: ctx.session.user.email,
      sessionUserName: ctx.session.user.name,
      sessionUserRole: ctx.session.user.role,
    };
  }),
});