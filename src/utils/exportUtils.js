import jsPDF from 'jspdf';
import 'jspdf-autotable';
import Papa from 'papaparse';

/**
 * Export data to CSV
 */
export const exportToCSV = (data, filename) => {
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

/**
 * Export profit & loss statement to PDF — Professional Design
 */
export const exportProfitLossPDF = (data, dateRange) => {
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const m = 14;

    // Colors
    const blue = [41, 128, 185];
    const dark = [40, 40, 40];
    const gray = [120, 120, 120];
    const bgGray = [245, 247, 250];
    const green = [39, 174, 96];
    const red = [231, 76, 60];

    // Format number without any symbol (Indian 2,1,2 grouping)
    const fmt = (v) => {
        const n = parseFloat(v) || 0;
        return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // ── HEADER BAR ──
    doc.setFillColor(...blue);
    doc.rect(0, 0, pw, 36, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text('Profit & Loss Statement', m, 17);

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text('Powered By BILLJI', m, 25);

    doc.setFontSize(5);
    doc.text('A Product Of Sudeepta Kumar Panda', m, 28);

    // ── DATE RANGE BOX (right side of header area) ──
    const dateBoxW = 60;
    const dateBoxX = pw - m - dateBoxW;
    const dateBoxY = 44;

    doc.setFillColor(...bgGray);
    doc.roundedRect(dateBoxX, dateBoxY, dateBoxW, 20, 2, 2, 'F');

    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...gray);
    doc.text('Period', dateBoxX + 5, dateBoxY + 7);

    doc.setTextColor(...dark);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.text(`${dateRange.start} to ${dateRange.end}`, dateBoxX + 5, dateBoxY + 14);

    // ── INCOME SECTION ──
    let y = 75;

    // Income label with green accent
    doc.setFillColor(...green);
    doc.rect(m, y, 3, 10, 'F');
    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...dark);
    doc.text('Income', m + 7, y + 8);
    y += 15;

    const incomeRows = data.income.map(item => [item.category, fmt(item.amount)]);
    incomeRows.push([
        { content: 'Total Income', styles: { fontStyle: 'bold' } },
        { content: fmt(data.totalIncome), styles: { fontStyle: 'bold', textColor: green } }
    ]);

    doc.autoTable({
        startY: y,
        head: [['Category', 'Amount']],
        body: incomeRows,
        theme: 'grid',
        margin: { left: m, right: m },
        headStyles: {
            fillColor: green,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 10,
            cellPadding: 4
        },
        columnStyles: {
            0: { halign: 'left' },
            1: { halign: 'right', cellWidth: 50 }
        },
        bodyStyles: {
            fontSize: 9,
            textColor: dark,
            cellPadding: 4
        },
        alternateRowStyles: {
            fillColor: [245, 255, 248]
        }
    });

    // ── EXPENSES SECTION ──
    y = doc.lastAutoTable.finalY + 15;

    // Expense label with red accent
    doc.setFillColor(...red);
    doc.rect(m, y, 3, 10, 'F');
    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...dark);
    doc.text('Expenses', m + 7, y + 8);
    y += 15;

    const expenseRows = data.expenses.map(item => [item.category, fmt(item.amount)]);
    expenseRows.push([
        { content: 'Total Expenses', styles: { fontStyle: 'bold' } },
        { content: fmt(data.totalExpenses), styles: { fontStyle: 'bold', textColor: red } }
    ]);

    doc.autoTable({
        startY: y,
        head: [['Category', 'Amount']],
        body: expenseRows,
        theme: 'grid',
        margin: { left: m, right: m },
        headStyles: {
            fillColor: red,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 10,
            cellPadding: 4
        },
        columnStyles: {
            0: { halign: 'left' },
            1: { halign: 'right', cellWidth: 50 }
        },
        bodyStyles: {
            fontSize: 9,
            textColor: dark,
            cellPadding: 4
        },
        alternateRowStyles: {
            fillColor: [255, 245, 245]
        }
    });

    // ── NET PROFIT / LOSS BAR ──
    y = doc.lastAutoTable.finalY + 15;
    const netAmount = data.totalIncome - data.totalExpenses;
    const isProfit = netAmount >= 0;
    const netColor = isProfit ? green : red;
    const netLabel = isProfit ? 'NET PROFIT' : 'NET LOSS';

    const barW = pw - (m * 2);
    const barH = 18;

    doc.setFillColor(...netColor);
    doc.roundedRect(m, y, barW, barH, 3, 3, 'F');

    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(netLabel, m + 8, y + 12);
    doc.text(fmt(Math.abs(netAmount)), pw - m - 8, y + 12, { align: 'right' });

    // ── FOOTER ──
    doc.setFontSize(8);
    doc.setFont(undefined, 'italic');
    doc.setTextColor(...gray);
    doc.text('Generated by BILLJI', pw / 2, ph - 18, { align: 'center' });

    doc.setFont(undefined, 'bold');
    doc.text('Maintained By PANDA STUDIOS', pw / 2, ph - 13, { align: 'center' });

    doc.setFont(undefined, 'normal');
    doc.setFontSize(7);
    doc.text('A Product Of Sudeepta Kumar Panda', pw / 2, ph - 9, { align: 'center' });

    doc.save(`profit-loss-statement-${Date.now()}.pdf`);
};

/**
 * Export invoice to PDF — Professional A4 GST Tax Invoice
 */
export const exportInvoicePDF = (invoice, businessSettings = {}) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pw = doc.internal.pageSize.getWidth();   // 210
    const ph = doc.internal.pageSize.getHeight();  // 297
    const m = 12;                                  // margin
    const contentW = pw - m * 2;                   // usable width

    // ── Color Palette ──
    const navy     = [26, 35, 66];
    const accent   = [37, 99, 235];
    const dark     = [33, 33, 33];
    const mid      = [100, 100, 100];
    const light    = [160, 160, 160];
    const bgLight  = [248, 249, 252];
    const borderC  = [210, 215, 225];
    const white    = [255, 255, 255];

    // ── Helpers ── (Indian 2,1,2 grouping)
    const money = (v) => {
        const n = parseFloat(v) || 0;
        return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const fmtDate = (d) => {
        if (!d) return '—';
        const dt = typeof d === 'string' ? new Date(d) : (d.toDate ? d.toDate() : d);
        return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const drawLine = (x1, y1, x2, y2, color = borderC, width = 0.3) => {
        doc.setDrawColor(...color);
        doc.setLineWidth(width);
        doc.line(x1, y1, x2, y2);
    };

    const drawRect = (x, y, w, h, fill = bgLight, stroke = borderC) => {
        doc.setFillColor(...fill);
        doc.setDrawColor(...stroke);
        doc.setLineWidth(0.3);
        doc.rect(x, y, w, h, 'FD');
    };

    // ═══════════════════════════════════════════════════
    //  SECTION 1 — HEADER
    // ═══════════════════════════════════════════════════

    // Top accent line
    doc.setFillColor(...accent);
    doc.rect(0, 0, pw, 3, 'F');

    let y = 10;

    // Company Name (large, bold)
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...navy);
    doc.text(businessSettings.businessName || 'BILLJI', m, y + 6);

    // "TAX INVOICE" title — right aligned
    doc.setFontSize(22);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...accent);
    doc.text('TAX INVOICE', pw - m, y + 6, { align: 'right' });

    y += 12;

    // Company details — left side
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...mid);

    let leftY = y;
    if (businessSettings.address) {
        const addressLines = doc.splitTextToSize(businessSettings.address, 90);
        doc.text(addressLines, m, leftY);
        leftY += addressLines.length * 3.5;
    }
    if (businessSettings.gstNumber) {
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...dark);
        doc.text('GSTIN: ' + businessSettings.gstNumber, m, leftY + 1);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(...mid);
        leftY += 4;
    }
    if (businessSettings.phone) {
        doc.text('Phone: ' + businessSettings.phone, m, leftY + 1);
        leftY += 3.5;
    }
    if (businessSettings.email) {
        doc.text('Email: ' + businessSettings.email, m, leftY + 1);
        leftY += 3.5;
    }

    // Separator line below header
    y = Math.max(leftY, y) + 4;
    drawLine(m, y, pw - m, y, navy, 0.5);

    // ═══════════════════════════════════════════════════
    //  SECTION 2 — INVOICE INFO + BILL TO (side by side)
    // ═══════════════════════════════════════════════════

    y += 4;
    const infoBlockY = y;
    const halfW = (contentW - 6) / 2;

    // ── LEFT: Bill To ──
    drawRect(m, infoBlockY, halfW, 30);

    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...accent);
    doc.text('BILL TO', m + 4, infoBlockY + 5);

    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...dark);
    doc.text(invoice.customerName || '—', m + 4, infoBlockY + 11);

    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...mid);
    let billLineY = infoBlockY + 16;
    if (invoice.customerPhone) {
        doc.text('Phone: ' + invoice.customerPhone, m + 4, billLineY);
        billLineY += 4;
    }
    if (invoice.customerEmail) {
        doc.text('Email: ' + invoice.customerEmail, m + 4, billLineY);
        billLineY += 4;
    }

    // ── RIGHT: Invoice Details ──
    const rightX = m + halfW + 6;
    drawRect(rightX, infoBlockY, halfW, 30);

    // Invoice number
    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...accent);
    doc.text('INVOICE DETAILS', rightX + 4, infoBlockY + 5);

    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...mid);

    const detailLabelX = rightX + 4;
    const detailValueX = rightX + halfW - 4;
    let dY = infoBlockY + 11;

    doc.text('Invoice No:', detailLabelX, dY);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...dark);
    doc.text(invoice.invoiceNumber || 'N/A', detailValueX, dY, { align: 'right' });

    dY += 5;
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...mid);
    doc.text('Date:', detailLabelX, dY);
    doc.setTextColor(...dark);
    doc.text(fmtDate(invoice.date), detailValueX, dY, { align: 'right' });

    dY += 5;
    doc.setTextColor(...mid);
    doc.text('Due Date:', detailLabelX, dY);
    doc.setTextColor(...dark);
    doc.text(fmtDate(invoice.dueDate), detailValueX, dY, { align: 'right' });

    dY += 5;
    doc.setTextColor(...mid);
    doc.text('Status:', detailLabelX, dY);
    const statusText = (invoice.status || 'unpaid').toUpperCase();
    const statusColor = invoice.status === 'paid' ? [22, 163, 74] : invoice.status === 'overdue' ? [220, 38, 38] : [234, 88, 12];
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...statusColor);
    doc.text(statusText, detailValueX, dY, { align: 'right' });

    y = infoBlockY + 34;

    // ═══════════════════════════════════════════════════
    //  SECTION 3 — PRODUCT TABLE
    // ═══════════════════════════════════════════════════

    const rows = invoice.items.map((item, idx) => {
        const qty = parseFloat(item.quantity) || 0;
        const price = parseFloat(item.price) || 0;
        const discount = parseFloat(item.discount) || 0;
        const lineTotal = (qty * price) - discount;
        return [
            String(idx + 1),
            item.description || '—',
            item.hsnCode || '—',
            String(qty),
            money(price),
            (invoice.gstRate || 0) + '%',
            money(lineTotal)
        ];
    });

    doc.autoTable({
        startY: y,
        head: [['#', 'Item Description', 'HSN Code', 'Qty', 'Unit Price', 'GST %', 'Amount']],
        body: rows,
        theme: 'grid',
        margin: { left: m, right: m },
        styles: {
            fontSize: 8,
            cellPadding: 3,
            lineColor: borderC,
            lineWidth: 0.3,
            textColor: dark,
        },
        headStyles: {
            fillColor: navy,
            textColor: white,
            fontStyle: 'bold',
            fontSize: 7.5,
            halign: 'center',
            cellPadding: 3.5,
        },
        columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 52, halign: 'left' },
            2: { cellWidth: 24, halign: 'center' },
            3: { cellWidth: 14, halign: 'center' },
            4: { cellWidth: 28, halign: 'right' },
            5: { cellWidth: 18, halign: 'center' },
            6: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
        },
        alternateRowStyles: {
            fillColor: [245, 247, 252],
        },
        bodyStyles: {
            fontSize: 8,
        },
    });

    y = doc.lastAutoTable.finalY;

    // ═══════════════════════════════════════════════════
    //  SECTION 4 — SUMMARY (right-aligned block)
    // ═══════════════════════════════════════════════════

    y += 4;
    const sumW = 80;
    const sumX = pw - m - sumW;
    const labelColX = sumX + 5;
    const valueColX = pw - m - 5;

    // Subtotal row
    drawRect(sumX, y, sumW, 8, bgLight, borderC);
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...mid);
    doc.text('Subtotal', labelColX, y + 5.5);
    doc.setTextColor(...dark);
    doc.text(money(invoice.subtotal), valueColX, y + 5.5, { align: 'right' });

    y += 8;

    // GST row
    drawRect(sumX, y, sumW, 8, bgLight, borderC);
    doc.setTextColor(...mid);
    doc.text('GST (' + (invoice.gstRate || 0) + '%)', labelColX, y + 5.5);
    doc.setTextColor(...dark);
    doc.text(money(invoice.gstAmount), valueColX, y + 5.5, { align: 'right' });

    y += 8;

    // Grand Total row (highlighted)
    doc.setFillColor(...navy);
    doc.setDrawColor(...navy);
    doc.setLineWidth(0.3);
    doc.rect(sumX, y, sumW, 10, 'FD');

    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...white);
    doc.text('GRAND TOTAL', labelColX, y + 7);
    doc.text(money(invoice.total), valueColX, y + 7, { align: 'right' });

    y += 14;

    // Amount in words
    doc.setFontSize(7);
    doc.setFont(undefined, 'italic');
    doc.setTextColor(...mid);
    const totalInWords = numberToWords(parseFloat(invoice.total) || 0);
    doc.text('Amount in words: ' + totalInWords + ' Only', m, y + 2);

    y += 8;

    // ═══════════════════════════════════════════════════
    //  SECTION 5 — PAYMENT INFO (if notes exist, use notes)
    // ═══════════════════════════════════════════════════

    if (invoice.notes && invoice.notes.trim()) {
        drawLine(m, y, pw - m, y, borderC, 0.3);
        y += 4;

        doc.setFontSize(8);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...navy);
        doc.text('PAYMENT NOTES', m, y + 1);
        y += 5;

        doc.setFont(undefined, 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...mid);
        const noteLines = doc.splitTextToSize(invoice.notes, contentW);
        doc.text(noteLines, m, y);
        y += noteLines.length * 3.5 + 3;
    }

    // ═══════════════════════════════════════════════════
    //  SECTION 6 — TERMS & CONDITIONS
    // ═══════════════════════════════════════════════════

    drawLine(m, y, pw - m, y, borderC, 0.3);
    y += 4;

    doc.setFontSize(7.5);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...navy);
    doc.text('TERMS & CONDITIONS', m, y + 1);
    y += 5;

    doc.setFont(undefined, 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...light);

    const terms = [
        '1. Goods once sold will not be taken back or exchanged.',
        '2. Warranty as per manufacturer policy.',
        '3. Subject to local jurisdiction only.',
        '4. Please keep this invoice for future reference.',
        '5. Payment is due by the date mentioned above.',
    ];
    terms.forEach(t => {
        doc.text(t, m, y + 1);
        y += 3.5;
    });

    y += 2;

    // ═══════════════════════════════════════════════════
    //  SECTION 7 — SIGNATURE AREA
    // ═══════════════════════════════════════════════════

    drawLine(m, y, pw - m, y, borderC, 0.3);
    y += 6;

    // Right side — Authorized Signatory
    const sigBlockX = pw - m - 65;
    const sigBlockW = 65;

    doc.setFontSize(7.5);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...navy);
    doc.text('For ' + (businessSettings.businessName || 'BILLJI'), sigBlockX, y);

    y += 16;

    // Signature line
    drawLine(sigBlockX, y, sigBlockX + sigBlockW, y, dark, 0.4);
    y += 4;

    doc.setFontSize(7);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...mid);
    doc.text('Authorized Signatory', sigBlockX + sigBlockW / 2, y, { align: 'center' });

    // Digital signature text (light blue, no box)
    doc.setFontSize(7);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(147, 197, 253); // light blue
    doc.text('Digitally Signed', sigBlockX + sigBlockW / 2, y - 10, { align: 'center' });

    // ═══════════════════════════════════════════════════
    //  SECTION 8 — FOOTER
    // ═══════════════════════════════════════════════════

    // Bottom accent bar
    doc.setFillColor(...navy);
    doc.rect(0, ph - 18, pw, 18, 'F');

    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('Thank You For Your Business', pw / 2, ph - 12, { align: 'center' });

    doc.setFontSize(6.5);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(180, 190, 210);
    doc.text('Powered By BILLJI  |  Maintained By PANDA STUDIOS', pw / 2, ph - 7, { align: 'center' });

    // Thin accent line at the very bottom
    doc.setFillColor(...accent);
    doc.rect(0, ph - 2, pw, 2, 'F');

    doc.save('invoice-' + invoice.invoiceNumber + '.pdf');
};


/**
 * Convert a number to Indian-style words (supports up to crores)
 */
function numberToWords(num) {
    if (num === 0) return 'Zero';

    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
        'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
        'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const convert = (n) => {
        if (n === 0) return '';
        if (n < 20) return ones[n];
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
        if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convert(n % 100) : '');
        if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
        if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
        return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
    };

    const rupees = Math.floor(num);
    const paise = Math.round((num - rupees) * 100);

    let result = 'Rupees ' + convert(rupees);
    if (paise > 0) {
        result += ' and ' + convert(paise) + ' Paise';
    }
    return result;
}
