import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';
import { CustomFieldType, EntityType } from '@/generated/prisma';

export const customFieldsRouter = createTRPCRouter({
  getByEntity: protectedProcedure
    .input(
      z.object({
        entityType: z.nativeEnum(EntityType),
        country: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.customField.findMany({
        where: {
          entityType: input.entityType,
          country: input.country || null,
        },
        orderBy: {
          name: 'asc',
        },
      });
    }),

  getAll: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.customField.findMany({
      orderBy: [
        { entityType: 'asc' },
        { country: 'asc' },
        { name: 'asc' },
      ],
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, 'Name is required'),
        label: z.string().min(1, 'Label is required'),
        type: z.nativeEnum(CustomFieldType),
        required: z.boolean().default(false),
        options: z.record(z.any()).optional(),
        defaultValue: z.string().optional(),
        entityType: z.nativeEnum(EntityType),
        country: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.customField.create({
        data: input,
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1, 'Name is required'),
        label: z.string().min(1, 'Label is required'),
        type: z.nativeEnum(CustomFieldType),
        required: z.boolean(),
        options: z.record(z.any()).optional(),
        defaultValue: z.string().optional(),
        entityType: z.nativeEnum(EntityType),
        country: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.customField.update({
        where: { id },
        data,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.customField.delete({
        where: { id: input.id },
      });
    }),

  getFieldTypes: protectedProcedure.query(() => {
    return Object.values(CustomFieldType);
  }),

  getEntityTypes: protectedProcedure.query(() => {
    return Object.values(EntityType);
  }),
});