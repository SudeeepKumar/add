/**
 * Format currency for display
 */
export const formatCurrency = (amount, currency = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};

/**
 * Parse currency string to number
 */
export const parseCurrency = (currencyString) => {
    if (typeof currencyString === 'number') return currencyString;
    return parseFloat(currencyString.replace(/[^0-9.-]+/g, ''));
};

/**
 * Format number with commas
 */
export const formatNumber = (number) => {
    return new Intl.NumberFormat('en-IN').format(number);
};
