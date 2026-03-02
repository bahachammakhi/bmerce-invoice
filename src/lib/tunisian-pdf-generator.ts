import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { numberToWords } from './number-to-words';

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
  // New fields
  withholdingTax?: number;
  isTaxExempt?: boolean;
  exemptionReason?: string;
  
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
  bankDetails?: {
    bankName?: string;
    accountNumber?: string;
    iban?: string;
    swift?: string;
    rib?: string;
  };
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
    
    const isTND = invoiceData.currency.code === 'TND';
    const decimals = isTND ? 3 : 2;

    // Table data
    const data = invoiceData.items.map(item => [
      item.description,
      item.quantity.toString(),
      `${invoiceData.currency.symbol}${item.unitPrice.toFixed(decimals)}`,
      invoiceData.isTaxExempt ? '0%' : `${item.taxRate}%`,
      `${invoiceData.currency.symbol}${item.total.toFixed(decimals)}`
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
    
    const isTND = invoiceData.currency.code === 'TND';
    const decimals = isTND ? 3 : 2;

    let currentY = finalY;

    // Subtotal
    doc.text('Sous-total HT:', rightX, currentY);
    doc.text(`${invoiceData.currency.symbol}${invoiceData.subtotal.toFixed(decimals)}`, 180, currentY, { align: 'right' });
    currentY += 10;
    
    // Tax
    if (invoiceData.isTaxExempt) {
      doc.text('TVA (Exonéré):', rightX, currentY);
      doc.text(`${invoiceData.currency.symbol}0.000`, 180, currentY, { align: 'right' });
      currentY += 10;
      
      if (invoiceData.exemptionReason) {
        doc.setFontSize(8);
        doc.text(`Motif: ${invoiceData.exemptionReason}`, rightX, currentY);
        doc.setFontSize(10);
        currentY += 10;
      }
    } else {
      doc.text('TVA:', rightX, currentY);
      doc.text(`${invoiceData.currency.symbol}${invoiceData.taxAmount.toFixed(decimals)}`, 180, currentY, { align: 'right' });
      currentY += 10;
    }
    
    // Timbre fiscal (Tunisian-specific)
    if (invoiceData.timbreAmount && invoiceData.timbreAmount > 0) {
      doc.text('Timbre fiscal:', rightX, currentY);
      doc.text(`${invoiceData.currency.symbol}${invoiceData.timbreAmount.toFixed(decimals)}`, 180, currentY, { align: 'right' });
      currentY += 10;
    }

    // Withholding Tax
    if (invoiceData.withholdingTax && invoiceData.withholdingTax > 0) {
      doc.text('Retenue à la source:', rightX, currentY);
      doc.text(`- ${invoiceData.currency.symbol}${invoiceData.withholdingTax.toFixed(decimals)}`, 180, currentY, { align: 'right' });
      currentY += 10;
    }
    
    // Total line
    doc.setLineWidth(0.5);
    doc.line(rightX, currentY - 5, 185, currentY - 5);
    
    // Total
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('TOTAL TTC:', rightX, currentY);
    doc.text(`${invoiceData.currency.symbol}${invoiceData.total.toFixed(decimals)}`, 180, currentY, { align: 'right' });

    // Total in words
    currentY += 15;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const totalInWords = numberToWords(invoiceData.total, invoiceData.currency.code, 'fr');
    doc.text(`Arrêté la présente facture à la somme de :`, 20, currentY);
    doc.setFont('helvetica', 'bold');
    doc.text(totalInWords.toUpperCase(), 20, currentY + 6);
  }

  private static addFooter(doc: jsPDF, invoiceData: TunisianInvoiceData) {
    const pageHeight = doc.internal.pageSize.height;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');

    let footerY = pageHeight - 60;

    // Notes
    if (invoiceData.notes) {
      doc.text('Notes:', 20, footerY);
      doc.text(invoiceData.notes, 20, footerY + 8);
      footerY += 20;
    }

    // Bank Details Section
    if (invoiceData.bankDetails) {
      const bankDetails = invoiceData.bankDetails;
      const hasBankInfo = bankDetails.bankName || bankDetails.accountNumber ||
                         bankDetails.iban || bankDetails.swift || bankDetails.rib;

      if (hasBankInfo) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Coordonnées Bancaires / Bank Details:', 20, footerY);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);

        let bankY = footerY + 6;
        if (bankDetails.bankName) {
          doc.text(`Banque / Bank: ${bankDetails.bankName}`, 20, bankY);
          bankY += 5;
        }
        if (bankDetails.rib) {
          doc.text(`RIB: ${bankDetails.rib}`, 20, bankY);
          bankY += 5;
        }
        if (bankDetails.iban) {
          doc.text(`IBAN: ${bankDetails.iban}`, 20, bankY);
          bankY += 5;
        }
        if (bankDetails.swift) {
          doc.text(`SWIFT/BIC: ${bankDetails.swift}`, 20, bankY);
          bankY += 5;
        }
        if (bankDetails.accountNumber) {
          doc.text(`Compte / Account: ${bankDetails.accountNumber}`, 20, bankY);
        }
      }
    }

    // Tunisian compliance footer
    doc.setFontSize(8);
    doc.text('Facture conforme à la réglementation tunisienne', 105, pageHeight - 20, { align: 'center' });

    // Page number
    doc.text(`Page 1`, 180, pageHeight - 10, { align: 'right' });
  }

  static downloadInvoicePDF(invoiceData: TunisianInvoiceData) {
    const pdf = this.generateInvoicePDF(invoiceData);
    pdf.save(`facture-${invoiceData.number}.pdf`);
  }

  static previewInvoicePDF(invoiceData: TunisianInvoiceData): string {
    const doc = this.generateInvoicePDF(invoiceData);
    return doc.output('datauristring');
  }
}