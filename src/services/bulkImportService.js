import { addTransaction } from './transactionService';
import { updateProduct } from './productService';
import { Timestamp } from 'firebase/firestore';

/**
 * Validate a single order row
 */
export const validateRow = (row, rowIndex) => {
    const errors = [];

    // Required fields
    if (!row.OrderID || !row.OrderID.trim()) {
        errors.push(`Row ${rowIndex + 1}: Missing Order ID`);
    }
    if (!row.Date || !row.Date.trim()) {
        errors.push(`Row ${rowIndex + 1}: Missing Date`);
    }
    if (!row.ProductSKU || !row.ProductSKU.trim()) {
        errors.push(`Row ${rowIndex + 1}: Missing Product SKU`);
    }
    if (!row.Quantity || isNaN(parseInt(row.Quantity))) {
        errors.push(`Row ${rowIndex + 1}: Invalid Quantity`);
    }
    if (!row.Status || !['Delivered', 'Returned'].includes(row.Status)) {
        errors.push(`Row ${rowIndex + 1}: Status must be "Delivered" or "Returned"`);
    }
    if (row.NetAmount === undefined || isNaN(parseFloat(row.NetAmount))) {
        errors.push(`Row ${rowIndex + 1}: Invalid Net Amount`);
    }

    // Validate date format
    if (row.Date) {
        const date = new Date(row.Date);
        if (isNaN(date.getTime())) {
            errors.push(`Row ${rowIndex + 1}: Invalid date format (use YYYY-MM-DD)`);
        }
    }

    return errors;
};

/**
 * Match product by SKU
 */
export const matchProduct = (sku, products) => {
    return products.find(p => p.sku === sku);
};

/**
 * Process orders from CSV data
 */
export const processOrders = async (csvData, userId, products) => {
    const results = {
        success: [],
        errors: [],
        totalAmount: 0,
        inventoryChanges: {},
    };

    const processedOrderIds = new Set();

    for (let i = 0; i < csvData.length; i++) {
        const row = csvData[i];

        try {
            // Validate row
            const validationErrors = validateRow(row, i);
            if (validationErrors.length > 0) {
                results.errors.push({
                    row: i + 2, // +2 because CSV header is row 1, and array is 0-indexed
                    orderId: row.OrderID || 'N/A',
                    message: validationErrors.join('; '),
                });
                continue;
            }

            // Check for duplicate order IDs in the same import
            if (processedOrderIds.has(row.OrderID)) {
                results.errors.push({
                    row: i + 2,
                    orderId: row.OrderID,
                    message: 'Duplicate Order ID in this import',
                });
                continue;
            }
            processedOrderIds.add(row.OrderID);

            // Match product
            const product = matchProduct(row.ProductSKU, products);
            if (!product) {
                results.errors.push({
                    row: i + 2,
                    orderId: row.OrderID,
                    message: `Product SKU "${row.ProductSKU}" not found in inventory`,
                });
                continue;
            }

            const quantity = parseInt(row.Quantity);
            const netAmount = parseFloat(row.NetAmount);
            const date = new Date(row.Date);

            // Process based on status
            if (row.Status === 'Delivered') {
                // Check if enough stock (for validation, though we're selling already)
                if (product.quantity < quantity) {
                    results.errors.push({
                        row: i + 2,
                        orderId: row.OrderID,
                        message: `Insufficient stock. Available: ${product.quantity}, Required: ${quantity}`,
                    });
                    continue;
                }

                // Create income transaction
                await addTransaction(userId, {
                    type: 'income',
                    category: 'E-commerce Sales',
                    amount: netAmount,
                    description: `${row.OrderID} - ${product.name} (Qty: ${quantity})`,
                    date: Timestamp.fromDate(date),
                    orderId: row.OrderID,
                    platform: row.Platform || 'E-commerce',
                });

                // Update inventory (reduce stock)
                await updateProduct(product.id, {
                    quantity: product.quantity - quantity,
                });

                // Track inventory changes
                if (!results.inventoryChanges[product.sku]) {
                    results.inventoryChanges[product.sku] = {
                        name: product.name,
                        change: 0,
                    };
                }
                results.inventoryChanges[product.sku].change -= quantity;

                results.success.push({
                    orderId: row.OrderID,
                    type: 'Sale',
                    amount: netAmount,
                });

                results.totalAmount += netAmount;

            } else if (row.Status === 'Returned') {
                // Create sales return transaction (negative income)
                if (netAmount > 0) {
                    await addTransaction(userId, {
                        type: 'expense',
                        category: 'Sales Returns',
                        amount: netAmount,
                        description: `RETURN: ${row.OrderID} - ${product.name} (Qty: ${quantity})`,
                        date: Timestamp.fromDate(date),
                        orderId: row.OrderID,
                        platform: row.Platform || 'E-commerce',
                    });
                }

                // Update inventory (add stock back)
                await updateProduct(product.id, {
                    quantity: product.quantity + quantity,
                });

                // Track inventory changes
                if (!results.inventoryChanges[product.sku]) {
                    results.inventoryChanges[product.sku] = {
                        name: product.name,
                        change: 0,
                    };
                }
                results.inventoryChanges[product.sku].change += quantity;

                results.success.push({
                    orderId: row.OrderID,
                    type: 'Return',
                    amount: netAmount,
                });

                results.totalAmount -= netAmount;
            }

        } catch (error) {
            console.error('Error processing row:', i + 2, error);
            results.errors.push({
                row: i + 2,
                orderId: row.OrderID || 'N/A',
                message: error.message || 'Unknown error occurred',
            });
        }
    }

    return results;
};
