export const calculateFinancials = (data) => {
    const { transactions = [], sales = [], returns = [] } = data;

    // ---------------------------------------------------------
    // 1. Transaction Classification (All-Time)
    // ---------------------------------------------------------
    let totalPurchases = 0;
    let operatingExpenses = 0;
    let capitalIntroduced = 0;
    let drawings = 0;
    let otherIncome = 0;
    
    // Ignore CUSTOMER_PAYMENT, SUPPLIER_PAYMENT, BANK_TRANSFER for P&L
    
    transactions.forEach(t => {
        if (t.type === 'expense') {
            if (t.category === 'Purchase') {
                totalPurchases += t.amount;
            } else if (!t.category.includes('Return Charges') && t.category !== 'Sales Refund' && t.category !== 'Drawings') {
                operatingExpenses += t.amount;
            } else if (t.category === 'Drawings') {
                drawings += t.amount;
            }
        } else if (t.type === 'income') {
            if (t.category === 'Capital') {
                capitalIntroduced += t.amount;
            } else if (t.category !== 'Product Sales' && t.category !== 'Purchase Refund') {
                otherIncome += t.amount;
            }
        }
    });

    // ---------------------------------------------------------
    // 2. Sales & COGS (All-Time)
    // ---------------------------------------------------------
    let grossSales = 0;
    let totalCOGS = 0;

    sales.forEach(s => {
        grossSales += (Number(s.totalRevenue) || 0);
        totalCOGS += (Number(s.totalCost) || 0);
    });

    // ---------------------------------------------------------
    // 3. Returns (All-Time)
    // ---------------------------------------------------------
    let salesReturnsRefunds = 0;
    let salesReturnCharges = 0;
    let salesReturnsCOGS = 0;

    let purchaseReturnsRefunds = 0;
    let purchaseReturnCharges = 0;

    returns.forEach(r => {
        if (r.returnType === 'sales') {
            salesReturnsRefunds += (Number(r.refundAmount) || 0);
            salesReturnCharges += (Number(r.returnCharges) || 0);
            
            // Historical COGS reversal for returned items
            // We look up the original sale to get the historical cost.
            if (r.saleId || r.orderId) {
                const originalSale = sales.find(s => s.id === r.saleId || s.orderId === r.orderId);
                if (originalSale && originalSale.items) {
                    const soldItem = originalSale.items.find(i => i.productId === r.productId);
                    if (soldItem) {
                        salesReturnsCOGS += (Number(soldItem.purchasePrice) || 0) * (Number(r.quantity) || 0);
                    }
                }
            }
        } else if (r.returnType === 'purchase') {
            purchaseReturnsRefunds += (Number(r.refundAmount) || 0);
            purchaseReturnCharges += (Number(r.returnCharges) || 0);
        }
    });

    // ---------------------------------------------------------
    // 4. Net Metrics (Cash-Basis)
    // ---------------------------------------------------------
    const netSales = grossSales - salesReturnsRefunds;
    const netPurchases = totalPurchases - purchaseReturnsRefunds;
    const netCOGS = totalCOGS - salesReturnsCOGS;
    
    const totalOpEx = operatingExpenses + salesReturnCharges + purchaseReturnCharges;
    
    // ---------------------------------------------------------
    // 5. Inventory & Assets
    // ---------------------------------------------------------
    // Historical Inventory Value = Purchases - COGS - Purchase Returns
    const historicalInventoryValue = Math.max(0, totalPurchases - netCOGS - purchaseReturnsRefunds);

    // Accrual-basis Net Profit (Accountant Style)
    const netProfit = netSales + otherIncome - (netCOGS + totalOpEx);

    // Cash Balance = Cash In - Cash Out
    let cashBalance = 0;
    transactions.forEach(t => {
        if (t.type === 'income') cashBalance += t.amount;
        if (t.type === 'expense') cashBalance -= t.amount;
    });
    // Adjust for refunds/charges that aren't in transactions
    cashBalance -= salesReturnsRefunds;
    cashBalance -= salesReturnCharges;
    cashBalance += purchaseReturnsRefunds;
    cashBalance -= purchaseReturnCharges;

    const totalAssets = historicalInventoryValue + cashBalance;

    // ---------------------------------------------------------
    // 6. Liabilities & Equity
    // ---------------------------------------------------------
    // Charges are treated as paid expenses, not liabilities.
    const currentLiabilities = 0;
    
    // In accrual accounting, Equity = Capital + Net Profit - Drawings
    const equity = capitalIntroduced + netProfit - drawings;

    // ---------------------------------------------------------
    // 7. Validation
    // ---------------------------------------------------------
    const balanceDifference = totalAssets - (currentLiabilities + equity);
    const isBalanced = Math.abs(balanceDifference) < 0.01;

    return {
        grossSales,
        salesReturnsRefunds,
        netSales,
        totalPurchases,
        purchaseReturnsRefunds,
        purchaseReturnCharges,
        salesReturnsCOGS,
        netCOGS,
        netPurchases,
        operatingExpenses: totalOpEx,
        otherIncome,
        netProfit,
        historicalInventoryValue,
        cashBalance,
        totalAssets,
        currentLiabilities,
        capitalIntroduced,
        drawings,
        equity,
        isBalanced,
        balanceDifference,
    };
};
