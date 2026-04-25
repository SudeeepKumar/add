export const EXPENSE_CATEGORIES = [
    'Purchase',
    'Supplier Costs',
    'Shipping & Logistics',
    'Marketing & Advertising',
    'Utilities',
    'Salaries & Wages',
    'Rent',
    'Office Supplies',
    'Software & Subscriptions',
    'Insurance',
    'Taxes',
    'Maintenance & Repairs',
    'Professional Services',
    'Miscellaneous',
];

export const INCOME_CATEGORIES = [
    'Product Sales',
    'Sales',
    'Service Revenue',
    'Consulting fees',
    'Interest Income',
    'Other Income',
];

export const TRANSACTION_TYPES = {
    INCOME: 'income',
    EXPENSE: 'expense',
};

export const DEFAULT_TAX_RATE = 18; // 18% GST

/**
 * Standard Indian GST Rate Slabs
 */
export const GST_RATES = [
    { value: '0', label: '0% — Exempt / Nil Rated' },
    { value: '0.25', label: '0.25% — Rough Diamonds' },
    { value: '3', label: '3% — Gold, Silver, Platinum' },
    { value: '5', label: '5% — Essential Goods' },
    { value: '12', label: '12% — Standard (Lower)' },
    { value: '18', label: '18% — Standard (Default)' },
    { value: '28', label: '28% — Luxury / Demerit Goods' },
];

/**
 * Payment method options
 */
export const PAYMENT_METHODS = [
    'Cash',
    'UPI',
    'Bank Transfer / NEFT / RTGS',
    'Credit Card',
    'Debit Card',
    'Cheque',
    'Credit (Supplier)',
    'Other',
];
