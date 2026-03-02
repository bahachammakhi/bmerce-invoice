'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Textarea } from '@/components/ui/textarea';

const sendEmailSchema = z.object({
  to: z.string().email('Invalid email address'),
  subject: z.string().min(1, 'Subject is required'),
  message: z.string().optional(),
});

type SendEmailFormData = z.infer<typeof sendEmailSchema>;

interface SendInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string;
  clientEmail?: string;
  clientName: string;
  total: number;
  currencySymbol: string;
  onSuccess?: () => void;
}

export function SendInvoiceDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  clientEmail,
  clientName,
  total,
  currencySymbol,
  onSuccess,
}: SendInvoiceDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const sendEmail = api.invoice.sendEmail.useMutation();

  const defaultSubject = `Invoice ${invoiceNumber}`;
  const defaultMessage = `Dear ${clientName},

Please find attached invoice ${invoiceNumber} for your review.

Total Amount: ${currencySymbol}${total.toFixed(3)}

Please process payment by the due date.

Thank you for your business!`;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SendEmailFormData>({
    resolver: zodResolver(sendEmailSchema),
    defaultValues: {
      to: clientEmail || '',
      subject: defaultSubject,
      message: defaultMessage,
    },
  });

  const onSubmit = async (data: SendEmailFormData) => {
    setIsSubmitting(true);
    try {
      await sendEmail.mutateAsync({
        id: invoiceId,
        to: data.to,
        subject: data.subject,
        message: data.message,
      });

      alert('Invoice sent successfully!');
      onSuccess?.();
      onOpenChange(false);
      reset();
    } catch (error) {
      console.error('Error sending invoice:', error);
      alert(error instanceof Error ? error.message : 'Failed to send invoice');
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
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Send Invoice via Email</DialogTitle>
          <DialogDescription>
            Send invoice {invoiceNumber} to your client. The PDF will be attached automatically.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="to">To Email Address *</Label>
            <Input
              id="to"
              type="email"
              {...register('to')}
              placeholder="client@example.com"
            />
            {errors.to && (
              <p className="text-red-500 text-sm">{errors.to.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              {...register('subject')}
              placeholder="Invoice subject"
            />
            {errors.subject && (
              <p className="text-red-500 text-sm">{errors.subject.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message (Optional)</Label>
            <Textarea
              id="message"
              {...register('message')}
              placeholder="Custom message to include in the email..."
              rows={8}
            />
            <p className="text-xs text-gray-500">
              Leave empty to use the default message
            </p>
          </div>

          <div className="bg-blue-50 p-3 rounded text-sm">
            <p className="font-medium text-blue-900">Note:</p>
            <p className="text-blue-800 mt-1">
              The invoice PDF will be automatically attached to this email.
            </p>
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
              {isSubmitting ? 'Sending...' : 'Send Invoice'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
