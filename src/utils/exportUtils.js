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

    // Format number without any symbol
    const fmt = (v) => {
        const n = parseFloat(v) || 0;
        const parts = n.toFixed(2).split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return parts.join('.');
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
 * Export invoice to PDF — Professional Modern Design
 */
export const exportInvoicePDF = (invoice, businessSettings = {}) => {
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();   // page width
    const ph = doc.internal.pageSize.getHeight();  // page height
    const m = 14;                                  // margin

    // ── Colors ──
    const blue = [41, 128, 185];
    const dark = [40, 40, 40];
    const gray = [120, 120, 120];
    const bgGray = [245, 247, 250];

    // ── Helpers ──
    const money = (v) => {
        const n = parseFloat(v) || 0;
        const parts = n.toFixed(2).split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return parts.join('.');
    };

    const fmtDate = (d) => {
        if (!d) return '';
        const dt = typeof d === 'string' ? new Date(d) : d;
        return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    // ══════════════════════════════════════════════
    //  HEADER — Blue bar with company name + INVOICE
    // ══════════════════════════════════════════════
    doc.setFillColor(...blue);
    doc.rect(0, 0, pw, 36, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont(undefined, 'bold');
    doc.text(businessSettings.businessName || '', m, 17);

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text('Powered By BILLJI', m, 25);

    doc.setFontSize(5);
    doc.setFont(undefined, 'normal');
    doc.text('A Product Of Sudeepta Kumar Panda', m, 28);

    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    doc.text('INVOICE', pw - m, 20, { align: 'right' });

    // ══════════════════════════════════════════════
    //  FROM BOX — Left side (Business details)
    // ══════════════════════════════════════════════
    const fromX = m;
    const fromY = 44;
    const fromW = 90;
    const pad = 6;
    let ty = fromY + pad + 4;  // text y cursor

    // We'll draw the box AFTER we know how tall the content is
    // So first, calculate content, then draw

    // -- Collect "From" content lines --
    const fromLines = [];
    fromLines.push({ text: 'From:', bold: true, size: 9 });
    fromLines.push({ text: businessSettings.businessName || 'BILLJI', bold: true, size: 11 });
    if (businessSettings.address) fromLines.push({ text: businessSettings.address, bold: false, size: 9 });
    // Phone number intentionally excluded from customer-facing invoice PDF
    if (businessSettings.email) fromLines.push({ text: 'Email: ' + businessSettings.email, bold: false, size: 9 });
    if (businessSettings.gstNumber) fromLines.push({ text: 'GST: ' + businessSettings.gstNumber, bold: false, size: 9 });

    // Calculate height
    let fromH = pad * 2; // top + bottom padding
    fromLines.forEach(l => { fromH += (l.size === 11 ? 7 : 5); });

    // Draw box
    doc.setFillColor(...bgGray);
    doc.roundedRect(fromX, fromY, fromW, fromH, 2, 2, 'F');

    // Render text
    doc.setTextColor(...dark);
    fromLines.forEach(l => {
        doc.setFontSize(l.size);
        doc.setFont(undefined, l.bold ? 'bold' : 'normal');
        doc.text(l.text, fromX + pad, ty);
        ty += (l.size === 11 ? 7 : 5);
    });

    // ══════════════════════════════════════════════
    //  INVOICE DETAILS BOX — Right side
    // ══════════════════════════════════════════════
    const invBoxW = 55;
    const invBoxX = pw - m - invBoxW;
    const invBoxY = fromY;

    doc.setFillColor(...bgGray);
    doc.roundedRect(invBoxX, invBoxY, invBoxW, 38, 2, 2, 'F');

    // Invoice # label
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...gray);
    doc.text('Invoice #', invBoxX + 5, invBoxY + 7);

    // Invoice # value (below label)
    doc.setTextColor(...dark);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    doc.text(invoice.invoiceNumber || 'N/A', invBoxX + 5, invBoxY + 13);

    // Date label
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...gray);
    doc.text('Date', invBoxX + 5, invBoxY + 23);

    // Date value (below label)
    doc.setTextColor(...dark);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.text(fmtDate(invoice.date), invBoxX + 5, invBoxY + 30);

    // ══════════════════════════════════════════════
    //  BILL TO BOX — Full width below From box
    // ══════════════════════════════════════════════
    const billY = fromY + fromH + 10;
    const billX = m;
    const billW = pw - (m * 2);
    const billPad = 6;
    let bty = billY + billPad + 4; // bill text y cursor

    // Collect Bill To lines
    const billLines = [];
    billLines.push({ text: 'Bill To:', bold: true, size: 10 });
    if (invoice.customerName) billLines.push({ text: invoice.customerName, bold: true, size: 11 });
    if (invoice.customerPhone) billLines.push({ text: 'Phone: ' + invoice.customerPhone, bold: false, size: 9 });
    if (invoice.customerEmail) billLines.push({ text: invoice.customerEmail, bold: false, size: 9 });

    // Calculate height
    let billH = billPad * 2;
    billLines.forEach(l => { billH += (l.size >= 10 ? 7 : 5); });

    // Draw box
    doc.setFillColor(...bgGray);
    doc.roundedRect(billX, billY, billW, billH, 2, 2, 'F');

    // Render text
    doc.setTextColor(...dark);
    billLines.forEach(l => {
        doc.setFontSize(l.size);
        doc.setFont(undefined, l.bold ? 'bold' : 'normal');
        doc.text(l.text, billX + billPad, bty);
        bty += (l.size >= 10 ? 7 : 5);
    });

    // ══════════════════════════════════════════════
    //  ITEMS TABLE
    // ══════════════════════════════════════════════
    const tableY = billY + billH + 10;

    const rows = invoice.items.map(item => {
        const total = (item.quantity * item.price) - (item.discount || 0);
        return [
            item.description || '',
            String(item.quantity),
            money(item.price),
            item.discount ? money(item.discount) : '-',
            money(total)
        ];
    });

    doc.autoTable({
        startY: tableY,
        head: [['Description', 'Qty', 'Unit Price', 'Discount', 'Amount']],
        body: rows,
        theme: 'grid',
        margin: { left: m, right: m },
        headStyles: {
            fillColor: blue,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 10,
            halign: 'center',
            cellPadding: 4
        },
        columnStyles: {
            0: { cellWidth: 65, halign: 'left' },
            1: { cellWidth: 20, halign: 'center' },
            2: { cellWidth: 32, halign: 'right' },
            3: { cellWidth: 28, halign: 'right' },
            4: { cellWidth: 35, halign: 'right' }
        },
        bodyStyles: {
            fontSize: 9,
            textColor: dark,
            cellPadding: 4
        },
        alternateRowStyles: {
            fillColor: [250, 250, 250]
        }
    });

    // ══════════════════════════════════════════════
    //  TOTALS — Gray box + Blue total bar
    // ══════════════════════════════════════════════
    const tStartY = doc.lastAutoTable.finalY + 8;
    const tWidth = 85;
    const tX = pw - m - tWidth;
    const labelX = tX + 6;
    const valX = pw - m - 6;

    // Gray background for Subtotal + GST
    doc.setFillColor(...bgGray);
    doc.rect(tX, tStartY, tWidth, 22, 'F');

    let cy = tStartY + 8;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...dark);

    doc.text('Subtotal:', labelX, cy);
    doc.text(money(invoice.subtotal), valX, cy, { align: 'right' });

    cy += 8;
    doc.text('GST (' + (invoice.gstRate || 0) + '%):', labelX, cy);
    doc.text(money(invoice.gstAmount), valX, cy, { align: 'right' });

    // Blue TOTAL bar
    const barY = tStartY + 22;
    const barH = 13;
    doc.setFillColor(...blue);
    doc.rect(tX, barY, tWidth, barH, 'F');

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('TOTAL:', labelX, barY + 9);
    doc.text(money(invoice.total), valX, barY + 9, { align: 'right' });

    // ══════════════════════════════════════════════
    //  NOTES (if any)
    // ══════════════════════════════════════════════
    if (invoice.notes && invoice.notes.trim()) {
        const notesY = barY + barH + 15;
        doc.setTextColor(...dark);
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.text('Notes:', m, notesY);
        doc.setFont(undefined, 'italic');
        const nl = doc.splitTextToSize(invoice.notes, pw - (m * 2));
        doc.text(nl, m, notesY + 5);
    }

    // ══════════════════════════════════════════════
    //  FOOTER
    // ══════════════════════════════════════════════
    doc.setFontSize(9);
    doc.setFont(undefined, 'italic');
    doc.setTextColor(...gray);
    doc.text('Thank you for your business!', pw / 2, ph - 22, { align: 'center' });

    doc.setFont(undefined, 'bold');
    doc.setFontSize(8);
    doc.text('Maintained By PANDA STUDIOS', pw / 2, ph - 16, { align: 'center' });

    doc.setFont(undefined, 'normal');
    doc.setFontSize(7);
    doc.text('A Product Of Sudeepta Kumar Panda', pw / 2, ph - 12, { align: 'center' });

    doc.save('invoice-' + invoice.invoiceNumber + '.pdf');
};
