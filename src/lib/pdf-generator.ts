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
  company?: {
    name: string;
    address?: string;
    city?: string;
    postalCode?: string;
    country?: string;
    phone?: string;
    email?: string;
    website?: string;
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
  bankDetails?: {
    bankName?: string;
    accountNumber?: string;
    iban?: string;
    swift?: string;
    rib?: string;
  };
}

const ACCENT = { r: 33, g: 81, b: 175 } as const;

const COUNTRY_NAMES: Record<string, string> = {
  TN: 'Tunisia', US: 'United States', FR: 'France', DE: 'Germany',
  GB: 'United Kingdom', CA: 'Canada', IS: 'Iceland', IT: 'Italy',
  ES: 'Spain', NL: 'Netherlands', BE: 'Belgium', CH: 'Switzerland',
  AT: 'Austria', PT: 'Portugal', SE: 'Sweden', NO: 'Norway',
  DK: 'Denmark', FI: 'Finland', IE: 'Ireland', LU: 'Luxembourg',
  JP: 'Japan', CN: 'China', KR: 'South Korea', AU: 'Australia',
  NZ: 'New Zealand', BR: 'Brazil', MX: 'Mexico', AR: 'Argentina',
  SA: 'Saudi Arabia', AE: 'United Arab Emirates', QA: 'Qatar',
  MA: 'Morocco', DZ: 'Algeria', LY: 'Libya', EG: 'Egypt',
  TR: 'Turkey', IN: 'India', SG: 'Singapore', MY: 'Malaysia',
  PL: 'Poland', CZ: 'Czech Republic', RO: 'Romania', GR: 'Greece',
};

function countryName(code?: string): string | undefined {
  if (!code) return undefined;
  return COUNTRY_NAMES[code.toUpperCase()] || code;
}

export class PDFGenerator {
  static generateInvoicePDF(invoiceData: InvoiceData): jsPDF {
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.width;
    const ph = doc.internal.pageSize.height;
    const m = 20;
    let y = m;

    // ── Company header (top-left) ──────────────────────────────
    if (invoiceData.company?.name) {
      const c = invoiceData.company;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b);
      doc.text(c.name, m, y);
      doc.setTextColor(0, 0, 0);
      y += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      if (c.address) { doc.text(c.address, m, y); y += 5; }
      if (c.city || c.postalCode) {
        doc.text([c.city, c.postalCode].filter(Boolean).join(' '), m, y);
        y += 5;
      }
      if (c.country) { doc.text(countryName(c.country) || c.country, m, y); y += 5; }
      if (c.taxId) {
        y += 2;
        doc.setFont('helvetica', 'bold');
        doc.text(`TAXID: ${c.taxId}`, m, y);
        doc.setFont('helvetica', 'normal');
        y += 5;
      }
      y += 15;
    }

    // ── Client block (right half) ──────────────────────────────
    const clientX = pw / 2 + 10;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(invoiceData.client.name, clientX, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    if (invoiceData.client.address) {
      doc.text(invoiceData.client.address, clientX, y); y += 5;
    }
    if (invoiceData.client.city || invoiceData.client.postalCode) {
      doc.text(
        [invoiceData.client.city, invoiceData.client.postalCode].filter(Boolean).join(' '),
        clientX, y,
      );
      y += 5;
    }
    if (invoiceData.client.country) {
      doc.text(countryName(invoiceData.client.country) || invoiceData.client.country, clientX, y);
      y += 5;
    }
    if (invoiceData.client.taxId) {
      y += 2;
      doc.text(`Tax ID: ${invoiceData.client.taxId}`, clientX, y);
      y += 5;
    }

    y += 12;

    // ── Invoice title ──────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b);
    doc.text(`Invoice ${invoiceData.number}`, m, y);
    doc.setTextColor(0, 0, 0);
    y += 10;

    // ── Dates ──────────────────────────────────────────────────
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Invoice Date', m, y);
    if (invoiceData.dueDate) doc.text('Due Date', m + 80, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(this.fmtDate(invoiceData.issueDate), m, y);
    if (invoiceData.dueDate) doc.text(this.fmtDate(invoiceData.dueDate), m + 80, y);
    y += 12;

    // ── Items table ────────────────────────────────────────────
    const sym = invoiceData.currency.symbol;
    const rows = invoiceData.items.map(item => [
      item.description,
      item.quantity.toFixed(2),
      item.unitPrice.toFixed(2),
      invoiceData.isTaxExempt ? '0%' : `${item.taxRate}%`,
      `${item.total.toFixed(2)} ${sym}`,
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Description', 'Quantity', 'Unit Price', 'Taxes', 'Amount']],
      body: rows,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 4, lineColor: [220, 220, 220] },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [80, 80, 80],
        fontStyle: 'bold',
        lineWidth: { bottom: 0.5 },
        lineColor: [ACCENT.r, ACCENT.g, ACCENT.b],
      },
      bodyStyles: { lineWidth: { bottom: 0.2 }, lineColor: [220, 220, 220] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0: { cellWidth: 75 },
        1: { halign: 'right', cellWidth: 22 },
        2: { halign: 'right', cellWidth: 25 },
        3: { halign: 'right', cellWidth: 20 },
        4: { halign: 'right', cellWidth: 28 },
      },
    });

    const tableEndY = (doc as any).lastAutoTable.finalY;

    // ── Two-column area below table ────────────────────────────
    // Left column: payment info (m to midpoint)
    // Right column: summary (midpoint to pw - m)
    const midX = pw / 2;
    const colStartY = tableEndY + 12;

    // ── RIGHT: Summary table ───────────────────────────────────
    const summaryLabelX = midX + 5;
    const summaryValueX = pw - m;
    let sY = colStartY;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);

    // Untaxed Amount
    doc.text('Untaxed Amount', summaryLabelX, sY);
    doc.text(`${invoiceData.subtotal.toFixed(2)} ${sym}`, summaryValueX, sY, { align: 'right' });
    sY += 8;

    // VAT
    if (invoiceData.isTaxExempt) {
      doc.text('VAT 0%', summaryLabelX, sY);
      doc.text(`0.00 ${sym}`, summaryValueX, sY, { align: 'right' });
    } else {
      const avgRate = invoiceData.subtotal > 0
        ? Math.round((invoiceData.taxAmount / invoiceData.subtotal) * 100)
        : 0;
      doc.text(`VAT ${avgRate}%`, summaryLabelX, sY);
      doc.text(`${invoiceData.taxAmount.toFixed(2)} ${sym}`, summaryValueX, sY, { align: 'right' });
    }
    sY += 8;

    // Withholding tax
    if (invoiceData.withholdingTax && invoiceData.withholdingTax > 0) {
      doc.text('Withholding Tax', summaryLabelX, sY);
      doc.text(`-${invoiceData.withholdingTax.toFixed(2)} ${sym}`, summaryValueX, sY, { align: 'right' });
      sY += 8;
    }

    // Exemption note
    if (invoiceData.isTaxExempt && invoiceData.exemptionReason) {
      doc.setFontSize(8);
      doc.text(`Exemption: ${invoiceData.exemptionReason}`, summaryLabelX, sY);
      doc.setFontSize(10);
      sY += 8;
    }

    // Total (blue, bold)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b);
    doc.text('Total', summaryLabelX, sY);
    doc.text(`${invoiceData.total.toFixed(2)} ${sym}`, summaryValueX, sY, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    const summaryEndY = sY;

    // ── LEFT: Payment info ─────────────────────────────────────
    let pY = colStartY;
    const maxLeftWidth = midX - m - 5; // constrain text to left half

    if (invoiceData.bankDetails) {
      const bd = invoiceData.bankDetails;
      const hasInfo = bd.bankName || bd.accountNumber || bd.iban || bd.swift || bd.rib;

      if (hasInfo) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);

        // Payment Communication
        const pcLabel = 'Payment Communication: ';
        doc.text(pcLabel, m, pY);
        doc.setFont('helvetica', 'bold');
        const pcLabelW = doc.getTextWidth(pcLabel);
        const numLines = doc.splitTextToSize(invoiceData.number, maxLeftWidth - pcLabelW);
        doc.text(numLines, m + pcLabelW, pY);
        pY += 6;

        // Account line
        if (bd.accountNumber || bd.bankName) {
          doc.setFont('helvetica', 'normal');
          const acctLabel = 'on this account: ';
          doc.text(acctLabel, m, pY);
          doc.setFont('helvetica', 'bold');
          const acctLabelW = doc.getTextWidth(acctLabel);
          const acctParts = [bd.accountNumber, bd.bankName].filter(Boolean).join(' - ');
          const acctLines = doc.splitTextToSize(acctParts, maxLeftWidth - acctLabelW);
          doc.text(acctLines, m + acctLabelW, pY);
          pY += 6 * Math.max(acctLines.length, 1);
          pY += 4;
        }

        // Payment Method
        doc.setFont('helvetica', 'normal');
        doc.text('Payment Method:', m, pY);
        pY += 6;

        if (bd.rib) {
          doc.text(`RIB: ${bd.rib}`, m, pY); pY += 5;
        }
        if (bd.iban) {
          let ibanLine = `IBAN: ${bd.iban}`;
          if (bd.swift) ibanLine += ` CODE BIC: ${bd.swift}`;
          // Wrap if too long
          const lines = doc.splitTextToSize(ibanLine, maxLeftWidth);
          doc.text(lines, m, pY);
          pY += 5 * lines.length;
        } else if (bd.swift) {
          doc.text(`SWIFT/BIC: ${bd.swift}`, m, pY); pY += 5;
        }
      }
    }

    // ── Notes ──────────────────────────────────────────────────
    const contentEndY = Math.max(summaryEndY, pY) + 12;
    if (invoiceData.notes) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(invoiceData.notes, pw - 2 * m);
      doc.text(lines, m, contentEndY);
    }

    // ── Footer ─────────────────────────────────────────────────
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(m, ph - 30, pw - m, ph - 30);

    const footerParts: string[] = [];
    if (invoiceData.company?.phone) footerParts.push(invoiceData.company.phone);
    if (invoiceData.company?.email) footerParts.push(invoiceData.company.email);
    if (footerParts.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.text(footerParts.join(' '), pw / 2, ph - 22, { align: 'center' });
    }

    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text('Page 1 / 1', pw / 2, ph - 14, { align: 'center' });
    doc.setTextColor(0, 0, 0);

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

  private static fmtDate(date: Date): string {
    const d = new Date(date);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }
}
