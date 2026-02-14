import Papa from 'papaparse';

/**
 * Parse CSV file to JSON
 */
export const parseCSVFile = (file) => {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (results.errors.length > 0) {
                    reject(new Error(`CSV parsing error: ${results.errors[0].message}`));
                } else {
                    resolve(results.data);
                }
            },
            error: (error) => {
                reject(error);
            },
        });
    });
};

/**
 * Validate CSV structure has required columns
 */
export const validateCSVStructure = (data, requiredColumns) => {
    if (!data || data.length === 0) {
        return { valid: false, error: 'CSV file is empty' };
    }

    const headers = Object.keys(data[0]);
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));

    if (missingColumns.length > 0) {
        return {
            valid: false,
            error: `Missing required columns: ${missingColumns.join(', ')}`,
        };
    }

    return { valid: true };
};

/**
 * Generate sample CSV template
 */
export const generateSampleCSV = () => {
    const sampleData = [
        {
            OrderID: 'FLP001',
            Date: '2026-02-14',
            ProductSKU: 'SKU-001',
            Quantity: '1',
            Status: 'Delivered',
            GrossAmount: '50000',
            Fees: '5000',
            NetAmount: '45000',
        },
        {
            OrderID: 'FLP002',
            Date: '2026-02-14',
            ProductSKU: 'SKU-002',
            Quantity: '2',
            Status: 'Delivered',
            GrossAmount: '2000',
            Fees: '200',
            NetAmount: '1800',
        },
        {
            OrderID: 'FLP003',
            Date: '2026-02-14',
            ProductSKU: 'SKU-001',
            Quantity: '1',
            Status: 'Returned',
            GrossAmount: '50000',
            Fees: '0',
            NetAmount: '0',
        },
    ];

    const csv = Papa.unparse(sampleData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bulk_import_template.csv';
    link.click();
    window.URL.revokeObjectURL(url);
};

/**
 * Export errors to CSV file
 */
export const exportErrorsToCSV = (errors) => {
    const errorData = errors.map(error => ({
        Row: error.row,
        OrderID: error.orderId || 'N/A',
        Error: error.message,
    }));

    const csv = Papa.unparse(errorData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `import_errors_${Date.now()}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
};

/**
 * Validate file before upload
 */
export const validateFile = (file) => {
    // Check file type
    if (!file.name.endsWith('.csv')) {
        return { valid: false, error: 'Please upload a CSV file' };
    }

    // Check file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
        return { valid: false, error: 'File size must be less than 5MB' };
    }

    return { valid: true };
};
