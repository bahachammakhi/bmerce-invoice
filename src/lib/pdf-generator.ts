import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface InvoiceData {
  id: string;
  number: string;
  issueDate: Date;
  dueDate?: Date;
  status: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  notes?: string;
  client: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    postalCode?: string;
    country?: string;
    taxId?: string;
  };
  currency: {
    code: string;
    symbol: string;
  };
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    total: number;
  }>;
}

export class PDFGenerator {
  static generateInvoicePDF(invoiceData: InvoiceData): jsPDF {
    const doc = new jsPDF();
    
    const pageWidth = doc.internal.pageSize.width;
    const margin = 20;
    let currentY = margin;

    doc.setFontSize(24);
    doc.text('INVOICE', margin, currentY);
    doc.setFontSize(12);
    doc.text(`Invoice #: ${invoiceData.number}`, pageWidth - margin - 60, currentY);
    currentY += 10;
    doc.text(`Status: ${invoiceData.status}`, pageWidth - margin - 60, currentY);
    currentY += 20;

    doc.setFontSize(14);
    doc.text('Bill To:', margin, currentY);
    currentY += 8;
    
    doc.setFontSize(11);
    doc.text(invoiceData.client.name, margin, currentY);
    currentY += 5;
    
    if (invoiceData.client.email) {
      doc.text(invoiceData.client.email, margin, currentY);
      currentY += 5;
    }
    
    if (invoiceData.client.phone) {
      doc.text(invoiceData.client.phone, margin, currentY);
      currentY += 5;
    }
    
    if (invoiceData.client.address) {
      doc.text(invoiceData.client.address, margin, currentY);
      currentY += 5;
      
      if (invoiceData.client.city || invoiceData.client.postalCode) {
        const cityLine = [
          invoiceData.client.city,
          invoiceData.client.postalCode
        ].filter(Boolean).join(', ');
        doc.text(cityLine, margin, currentY);
        currentY += 5;
      }
      
      if (invoiceData.client.country) {
        doc.text(invoiceData.client.country, margin, currentY);
        currentY += 5;
      }
    }
    
    if (invoiceData.client.taxId) {
      doc.text(`Tax ID: ${invoiceData.client.taxId}`, margin, currentY);
      currentY += 5;
    }

    const invoiceInfo = [
      ['Issue Date:', this.formatDate(invoiceData.issueDate)],
      ...(invoiceData.dueDate ? [['Due Date:', this.formatDate(invoiceData.dueDate)]] : []),
      ['Currency:', invoiceData.currency.code],
    ];

    let infoY = margin + 25;
    invoiceInfo.forEach(([label, value]) => {
      doc.text(label, pageWidth - margin - 80, infoY);
      doc.text(value, pageWidth - margin - 40, infoY);
      infoY += 6;
    });

    currentY = Math.max(currentY, infoY) + 20;

    const tableData = invoiceData.items.map(item => [
      item.description,
      item.quantity.toString(),
      this.formatCurrency(item.unitPrice, invoiceData.currency.symbol),
      `${item.taxRate}%`,
      this.formatCurrency(item.total, invoiceData.currency.symbol),
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Description', 'Qty', 'Unit Price', 'Tax', 'Total']],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 10,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [66, 139, 202],
        textColor: 255,
        fontStyle: 'bold',
      },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'center' },
        4: { halign: 'right' },
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 20;

    const summaryData = [
      ['Subtotal:', this.formatCurrency(invoiceData.subtotal, invoiceData.currency.symbol)],
      ['Tax:', this.formatCurrency(invoiceData.taxAmount, invoiceData.currency.symbol)],
      ['Total:', this.formatCurrency(invoiceData.total, invoiceData.currency.symbol)],
    ];

    summaryData.forEach(([label, value], index) => {
      const y = finalY + (index * 8);
      doc.setFontSize(index === summaryData.length - 1 ? 12 : 10);
      const fontWeight = index === summaryData.length - 1 ? 'bold' : 'normal';
      
      doc.text(label, pageWidth - margin - 80, y);
      doc.text(value, pageWidth - margin - 20, y, { align: 'right' });
    });

    if (invoiceData.notes) {
      doc.setFontSize(10);
      doc.text('Notes:', margin, finalY + 40);
      const notes = doc.splitTextToSize(invoiceData.notes, pageWidth - (2 * margin));
      doc.text(notes, margin, finalY + 50);
    }

    const footerY = doc.internal.pageSize.height - 20;
    doc.setFontSize(8);
    doc.setTextColor(128);
    doc.text('Thank you for your business!', pageWidth / 2, footerY, { align: 'center' });

    return doc;
  }

  static downloadInvoicePDF(invoiceData: InvoiceData): void {
    const doc = this.generateInvoicePDF(invoiceData);
    doc.save(`invoice-${invoiceData.number}.pdf`);
  }

  static previewInvoicePDF(invoiceData: InvoiceData): string {
    const doc = this.generateInvoicePDF(invoiceData);
    return doc.output('datauristring');
  }

  private static formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(date));
  }

  private static formatCurrency(amount: number, symbol: string): string {
    return `${symbol}${amount.toFixed(2)}`;
  }
}