'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PaymentMethod } from '@/generated/prisma';
import { api } from '@/lib/trpc';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const paymentSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  paymentDate: z.string(),
  method: z.nativeEnum(PaymentMethod),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceTotal: number;
  amountPaid: number;
  currencySymbol: string;
  onSuccess: () => void;
}

export function PaymentDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceTotal,
  amountPaid,
  currencySymbol,
  onSuccess,
}: PaymentDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createPayment = api.payment.create.useMutation();

  const remainingBalance = invoiceTotal - amountPaid;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: remainingBalance,
      paymentDate: new Date().toISOString().split('T')[0],
      method: PaymentMethod.BANK_TRANSFER,
    },
  });

  const paymentAmount = watch('amount') || 0;
  const newBalance = remainingBalance - paymentAmount;

  const onSubmit = async (data: PaymentFormData) => {
    setIsSubmitting(true);
    try {
      await createPayment.mutateAsync({
        invoiceId,
        amount: data.amount,
        paymentDate: new Date(data.paymentDate),
        method: data.method,
        reference: data.reference,
        notes: data.notes,
      });
      reset();
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating payment:', error);
      alert(error instanceof Error ? error.message : 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Record a payment for this invoice. Remaining balance:{' '}
            {currencySymbol}
            {remainingBalance.toFixed(3)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount *</Label>
            <Input
              id="amount"
              type="number"
              step="0.001"
              {...register('amount', { valueAsNumber: true })}
              max={remainingBalance}
            />
            {errors.amount && (
              <p className="text-red-500 text-sm">{errors.amount.message}</p>
            )}
            {paymentAmount > 0 && (
              <p className="text-sm text-gray-500">
                Remaining after payment: {currencySymbol}
                {newBalance.toFixed(3)}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentDate">Payment Date *</Label>
            <Input
              id="paymentDate"
              type="date"
              {...register('paymentDate')}
            />
            {errors.paymentDate && (
              <p className="text-red-500 text-sm">{errors.paymentDate.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="method">Payment Method *</Label>
            <Select
              value={watch('method')}
              onValueChange={(value) => setValue('method', value as PaymentMethod)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PaymentMethod.BANK_TRANSFER}>
                  Bank Transfer
                </SelectItem>
                <SelectItem value={PaymentMethod.CHECK}>Check</SelectItem>
                <SelectItem value={PaymentMethod.CASH}>Cash</SelectItem>
                <SelectItem value={PaymentMethod.CREDIT_CARD}>
                  Credit Card
                </SelectItem>
                <SelectItem value={PaymentMethod.OTHER}>Other</SelectItem>
              </SelectContent>
            </Select>
            {errors.method && (
              <p className="text-red-500 text-sm">{errors.method.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference">Reference / Transaction ID</Label>
            <Input
              id="reference"
              {...register('reference')}
              placeholder="Optional"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...register('notes')}
              placeholder="Optional payment notes"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Recording...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
