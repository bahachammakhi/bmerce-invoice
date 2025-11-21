import nodemailer from 'nodemailer';
import { InvoiceData } from './pdf-generator';

export class EmailService {
  private static transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  static async sendInvoice(
    invoiceData: InvoiceData,
    pdfBuffer: Buffer,
    options: {
      to: string;
      from?: string;
      subject?: string;
      message?: string;
    }
  ): Promise<boolean> {
    try {
      const { to, from, subject, message } = options;
      
      const defaultSubject = `Invoice ${invoiceData.number} from ${process.env.COMPANY_NAME || 'Invoice Manager'}`;
      const defaultMessage = `
Dear ${invoiceData.client.name},

Please find attached invoice ${invoiceData.number} for your review.

Invoice Details:
- Invoice Number: ${invoiceData.number}
- Issue Date: ${new Date(invoiceData.issueDate).toLocaleDateString()}
- Due Date: ${invoiceData.dueDate ? new Date(invoiceData.dueDate).toLocaleDateString() : 'N/A'}
- Total Amount: ${invoiceData.currency.symbol}${invoiceData.total.toFixed(2)}

Please process payment by the due date to avoid any late fees.

Thank you for your business!

Best regards,
${process.env.COMPANY_NAME || 'Invoice Manager'}
      `.trim();

      const mailOptions = {
        from: from || process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject: subject || defaultSubject,
        text: message || defaultMessage,
        attachments: [
          {
            filename: `invoice-${invoiceData.number}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', info.messageId);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  static async sendInvoiceReminder(
    invoiceData: InvoiceData,
    clientEmail: string,
    options: {
      reminderType: 'payment' | 'overdue';
      customMessage?: string;
    }
  ): Promise<boolean> {
    try {
      const { reminderType, customMessage } = options;
      
      const isOverdue = reminderType === 'overdue';
      const subject = isOverdue 
        ? `Overdue Payment Reminder - Invoice ${invoiceData.number}`
        : `Payment Reminder - Invoice ${invoiceData.number}`;

      const message = customMessage || `
Dear ${invoiceData.client.name},

This is a ${isOverdue ? 'final' : 'friendly'} reminder that invoice ${invoiceData.number} is ${isOverdue ? 'overdue' : 'due for payment'}.

Invoice Details:
- Invoice Number: ${invoiceData.number}
- Issue Date: ${new Date(invoiceData.issueDate).toLocaleDateString()}
- Due Date: ${invoiceData.dueDate ? new Date(invoiceData.dueDate).toLocaleDateString() : 'N/A'}
- Amount Due: ${invoiceData.currency.symbol}${invoiceData.total.toFixed(2)}

${isOverdue 
  ? 'Please remit payment immediately to avoid further action.'
  : 'Please process payment at your earliest convenience.'
}

If you have any questions or concerns, please don't hesitate to contact us.

Best regards,
${process.env.COMPANY_NAME || 'Invoice Manager'}
      `.trim();

      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: clientEmail,
        subject,
        text: message,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Reminder email sent successfully:', info.messageId);
      return true;
    } catch (error) {
      console.error('Error sending reminder email:', error);
      return false;
    }
  }

  static async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('SMTP connection test failed:', error);
      return false;
    }
  }
}