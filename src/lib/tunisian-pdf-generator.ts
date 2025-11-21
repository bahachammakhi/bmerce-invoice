import jsPDF from 'jspdf';
import 'jspdf-autotable';

export interface TunisianInvoiceData {
  id: string;
  number: string;
  issueDate: Date;
  dueDate?: Date;
  status: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  notes?: string;
  // Tunisian-specific fields
  timbreAmount?: number;
  tvaNumber?: string;
  mfNumber?: string;
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
  company: {
    name: string;
    address?: string;
    city?: string;
    postalCode?: string;
    country?: string;
    phone?: string;
    email?: string;
    website?: string;
    taxId?: string;
    tvaNumber?: string;
    mfNumber?: string;
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

export class TunisianPDFGenerator {
  static generateInvoicePDF(invoiceData: TunisianInvoiceData): jsPDF {
    const doc = new jsPDF();
    
    // Set up fonts and colors
    doc.setFont('helvetica');
    
    // Header section
    this.addHeader(doc, invoiceData);
    
    // Company and client info
    this.addCompanyInfo(doc, invoiceData.company);
    this.addClientInfo(doc, invoiceData.client);
    
    // Invoice details
    this.addInvoiceDetails(doc, invoiceData);
    
    // Items table
    this.addItemsTable(doc, invoiceData);
    
    // Totals section with Tunisian-specific fields
    this.addTotalsSection(doc, invoiceData);
    
    // Footer with Tunisian compliance info
    this.addFooter(doc, invoiceData);
    
    return doc;
  }

  private static addHeader(doc: jsPDF, invoiceData: TunisianInvoiceData) {
    // Title
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('FACTURE / INVOICE', 105, 30, { align: 'center' });
    
    // Invoice number
    doc.setFontSize(16);
    doc.text(`N° ${invoiceData.number}`, 105, 45, { align: 'center' });
    
    // Add a line separator
    doc.setLineWidth(0.5);
    doc.line(20, 55, 190, 55);
  }

  private static addCompanyInfo(doc: jsPDF, company: TunisianInvoiceData['company']) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('ÉMETTEUR / FROM:', 20, 70);
    
    doc.setFont('helvetica', 'normal');
    let y = 80;
    
    if (company.name) {
      doc.setFont('helvetica', 'bold');
      doc.text(company.name, 20, y);
      y += 8;
      doc.setFont('helvetica', 'normal');
    }
    
    if (company.address) {
      doc.text(company.address, 20, y);
      y += 6;
    }
    
    if (company.city || company.postalCode) {
      const cityInfo = [company.postalCode, company.city].filter(Boolean).join(' ');
      doc.text(cityInfo, 20, y);
      y += 6;
    }
    
    if (company.phone) {
      doc.text(`Tél: ${company.phone}`, 20, y);
      y += 6;
    }
    
    if (company.email) {
      doc.text(`Email: ${company.email}`, 20, y);
      y += 6;
    }
    
    // Tunisian-specific company info
    if (company.mfNumber) {
      doc.text(`M.F: ${company.mfNumber}`, 20, y);
      y += 6;
    }
    
    if (company.tvaNumber) {
      doc.text(`TVA: ${company.tvaNumber}`, 20, y);
      y += 6;
    }
  }

  private static addClientInfo(doc: jsPDF, client: TunisianInvoiceData['client']) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('DESTINATAIRE / TO:', 110, 70);
    
    doc.setFont('helvetica', 'normal');
    let y = 80;
    
    if (client.name) {
      doc.setFont('helvetica', 'bold');
      doc.text(client.name, 110, y);
      y += 8;
      doc.setFont('helvetica', 'normal');
    }
    
    if (client.address) {
      doc.text(client.address, 110, y);
      y += 6;
    }
    
    if (client.city || client.postalCode) {
      const cityInfo = [client.postalCode, client.city].filter(Boolean).join(' ');
      doc.text(cityInfo, 110, y);
      y += 6;
    }
    
    if (client.phone) {
      doc.text(`Tél: ${client.phone}`, 110, y);
      y += 6;
    }
    
    if (client.email) {
      doc.text(`Email: ${client.email}`, 110, y);
      y += 6;
    }
  }

  private static addInvoiceDetails(doc: jsPDF, invoiceData: TunisianInvoiceData) {
    const startY = 140;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    // Date details
    const issueDate = new Date(invoiceData.issueDate).toLocaleDateString('fr-FR');
    doc.text(`Date d'émission: ${issueDate}`, 20, startY);
    
    if (invoiceData.dueDate) {
      const dueDate = new Date(invoiceData.dueDate).toLocaleDateString('fr-FR');
      doc.text(`Date d'échéance: ${dueDate}`, 20, startY + 10);
    }
    
    // Currency
    doc.text(`Devise: ${invoiceData.currency.code}`, 110, startY);
  }

  private static addItemsTable(doc: jsPDF, invoiceData: TunisianInvoiceData) {
    const startY = 170;
    
    // Table headers
    const headers = [
      'Description',
      'Qté',
      'Prix Unit.',
      'TVA %',
      'Total HT'
    ];
    
    // Table data
    const data = invoiceData.items.map(item => [
      item.description,
      item.quantity.toString(),
      `${invoiceData.currency.symbol}${item.unitPrice.toFixed(2)}`,
      `${item.taxRate}%`,
      `${invoiceData.currency.symbol}${item.total.toFixed(2)}`
    ]);
    
    (doc as any).autoTable({
      head: [headers],
      body: data,
      startY: startY,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [200, 200, 200] },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 30, halign: 'right' },
        3: { cellWidth: 20, halign: 'center' },
        4: { cellWidth: 30, halign: 'right' }
      }
    });
  }

  private static addTotalsSection(doc: jsPDF, invoiceData: TunisianInvoiceData) {
    const finalY = (doc as any).lastAutoTable.finalY + 20;
    const rightX = 140;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    // Subtotal
    doc.text('Sous-total HT:', rightX, finalY);
    doc.text(`${invoiceData.currency.symbol}${invoiceData.subtotal.toFixed(2)}`, 180, finalY, { align: 'right' });
    
    // Tax
    doc.text('TVA:', rightX, finalY + 10);
    doc.text(`${invoiceData.currency.symbol}${invoiceData.taxAmount.toFixed(2)}`, 180, finalY + 10, { align: 'right' });
    
    // Timbre fiscal (Tunisian-specific)
    if (invoiceData.timbreAmount && invoiceData.timbreAmount > 0) {
      doc.text('Timbre fiscal:', rightX, finalY + 20);
      doc.text(`${invoiceData.currency.symbol}${invoiceData.timbreAmount.toFixed(2)}`, 180, finalY + 20, { align: 'right' });
    }
    
    // Total line
    doc.setLineWidth(0.5);
    doc.line(rightX, finalY + 25, 185, finalY + 25);
    
    // Total
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    const totalY = invoiceData.timbreAmount ? finalY + 35 : finalY + 30;
    doc.text('TOTAL TTC:', rightX, totalY);
    doc.text(`${invoiceData.currency.symbol}${invoiceData.total.toFixed(2)}`, 180, totalY, { align: 'right' });
  }

  private static addFooter(doc: jsPDF, invoiceData: TunisianInvoiceData) {
    const pageHeight = doc.internal.pageSize.height;
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    
    // Notes
    if (invoiceData.notes) {
      doc.text('Notes:', 20, pageHeight - 40);
      doc.text(invoiceData.notes, 20, pageHeight - 32);
    }
    
    // Tunisian compliance footer
    doc.text('Facture conforme à la réglementation tunisienne', 105, pageHeight - 20, { align: 'center' });
    
    // Page number
    doc.text(`Page 1`, 180, pageHeight - 10, { align: 'right' });
  }

  static downloadInvoicePDF(invoiceData: TunisianInvoiceData) {
    const pdf = this.generateInvoicePDF(invoiceData);
    pdf.save(`facture-${invoiceData.number}.pdf`);
  }
}