/**
 * Calculate GST amount from base amount
 */
export const calculateGST = (amount, gstRate = 18) => {
    return (amount * gstRate) / 100;
};

/**
 * Calculate total with GST
 */
export const calculateTotalWithGST = (amount, gstRate = 18) => {
    return amount + calculateGST(amount, gstRate);
};

/**
 * Calculate base amount from total (GST inclusive)
 */
export const calculateBaseFromTotal = (total, gstRate = 18) => {
    return total / (1 + gstRate / 100);
};

/**
 * Format tax rate for display
 */
export const formatTaxRate = (rate) => {
    return `${rate}%`;
};

/**
 * Calculate profit margin percentage
 */
export const calculateProfitMargin = (sellingPrice, purchasePrice) => {
    if (purchasePrice === 0) return 0;
    return ((sellingPrice - purchasePrice) / purchasePrice) * 100;
};
