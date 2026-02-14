import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToProducts } from '../services/productService';
import { processOrders } from '../services/bulkImportService';
import { FileUpload } from '../components/common/FileUpload';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Upload, Download, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { parseCSVFile, generateSampleCSV, exportErrorsToCSV } from '../utils/csvUtils';
import toast from 'react-hot-toast';

export const BulkImport = () => {
    const { user } = useAuth();
    const [products, setProducts] = useState([]);
    const [file, setFile] = useState(null);
    const [csvData, setcsvData] = useState([]);
    const [preview, setPreview] = useState([]);
    const [processing, setProcessing] = useState(false);
    const [results, setResults] = useState(null);

    useEffect(() => {
        if (!user) return;

        const unsubscribe = subscribeToProducts(user.uid, (data) => {
            setProducts(data);
        });

        return () => unsubscribe();
    }, [user]);

    const handleFileSelect = async (selectedFile) => {
        setFile(selectedFile);
        setResults(null);
        setCsvData([]);
        setPreview([]);

        if (!selectedFile) return;

        try {
            const data = await parseCSVFile(selectedFile);
            setCsvData(data);
            setPreview(data.slice(0, 10)); // Show first 10 rows
            toast.success(`CSV loaded: ${data.length} rows found`);
        } catch (error) {
            console.error('Error parsing CSV:', error);
            toast.error('Failed to parse CSV file');
            setFile(null);
        }
    };

    const handleImport = async () => {
        if (!csvData.length) {
            toast.error('Please upload a CSV file first');
            return;
        }

        if (products.length === 0) {
            toast.error('No products in inventory. Please add products first.');
            return;
        }

        setProcessing(true);
        setResults(null);

        try {
            const importResults = await processOrders(csvData, user.uid, products);
            setResults(importResults);

            if (importResults.errors.length === 0) {
                toast.success(`Successfully imported ${importResults.success.length} orders!`);
            } else if (importResults.success.length > 0) {
                toast.success(
                    `Imported ${importResults.success.length} orders with ${importResults.errors.length} errors`
                );
            } else {
                toast.error('Import failed. Please check errors below.');
            }
        } catch (error) {
            console.error('Error importing orders:', error);
            toast.error('Failed to import orders');
        } finally {
            setProcessing(false);
        }
    };

    const handleDownloadErrors = () => {
        if (results && results.errors.length > 0) {
            exportErrorsToCSV(results.errors);
        }
    };

    const handleReset = () => {
        setFile(null);
        setCsvData([]);
        setPreview([]);
        setResults(null);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Bulk Import</h1>
                    <p className="text-gray-600 mt-1">Upload CSV to import e-commerce orders</p>
                </div>
                <Button onClick={generateSampleCSV} variant="secondary" className="flex items-center gap-2">
                    <Download size={20} />
                    Download Template
                </Button>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">How to use:</h3>
                <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                    <li>Download the CSV template and fill in your order details</li>
                    <li>Make sure Product SKUs match exactly with inventory</li>
                    <li>Status must be either "Delivered" or "Returned"</li>
                    <li>Upload your CSV file below and click Import</li>
                </ol>
            </div>

            {/* Upload Section */}
            {!results && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload CSV File</h2>
                    <FileUpload onFileSelect={handleFileSelect} accept=".csv" maxSize={5} />
                </div>
            )}

            {/* Preview Section */}
            {preview.length > 0 && !results && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-900">
                            Preview ({csvData.length} rows total)
                        </h2>
                        <div className="flex gap-2">
                            <Button onClick={handleReset} variant="secondary">
                                Cancel
                            </Button>
                            <Button
                                onClick={handleImport}
                                disabled={processing}
                                className="flex items-center gap-2"
                            >
                                {processing ? (
                                    <>
                                        <LoadingSpinner size="sm" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <Upload size={18} />
                                        Import {csvData.length} Orders
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-4 py-2 text-left font-medium text-gray-700">Order ID</th>
                                    <th className="px-4 py-2 text-left font-medium text-gray-700">Date</th>
                                    <th className="px-4 py-2 text-left font-medium text-gray-700">SKU</th>
                                    <th className="px-4 py-2 text-left font-medium text-gray-700">Qty</th>
                                    <th className="px-4 py-2 text-left font-medium text-gray-700">Status</th>
                                    <th className="px-4 py-2 text-left font-medium text-gray-700">Net Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {preview.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                        <td className="px-4 py-2">{row.OrderID}</td>
                                        <td className="px-4 py-2">{row.Date}</td>
                                        <td className="px-4 py-2">{row.ProductSKU}</td>
                                        <td className="px-4 py-2">{row.Quantity}</td>
                                        <td className="px-4 py-2">
                                            <span
                                                className={`px-2 py-1 text-xs font-medium rounded-full ${row.Status === 'Delivered'
                                                        ? 'bg-success-100 text-success-800'
                                                        : 'bg-orange-100 text-orange-800'
                                                    }`}
                                            >
                                                {row.Status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2">₹{parseFloat(row.NetAmount).toLocaleString('en-IN')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {csvData.length > 10 && (
                            <p className="text-sm text-gray-500 mt-2 text-center">
                                ...and {csvData.length - 10} more rows
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Results Section */}
            {results && (
                <div className="space-y-4">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-success-100 rounded-lg flex items-center justify-center">
                                    <CheckCircle className="w-6 h-6 text-success-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Successful</p>
                                    <p className="text-2xl font-bold text-gray-900">{results.success.length}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-danger-100 rounded-lg flex items-center justify-center">
                                    <XCircle className="w-6 h-6 text-danger-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Errors</p>
                                    <p className="text-2xl font-bold text-gray-900">{results.errors.length}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                                    <AlertTriangle className="w-6 h-6 text-primary-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Net Amount</p>
                                    <p className="text-2xl font-bold text-gray-900">
                                        ₹{results.totalAmount.toLocaleString('en-IN')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Inventory Changes */}
                    {Object.keys(results.inventoryChanges).length > 0 && (
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <h3 className="font-semibold text-gray-900 mb-4">Inventory Changes</h3>
                            <div className="space-y-2">
                                {Object.entries(results.inventoryChanges).map(([sku, data]) => (
                                    <div key={sku} className="flex items-center justify-between py-2 border-b last:border-0">
                                        <span className="text-sm text-gray-700">{data.name} ({sku})</span>
                                        <span
                                            className={`text-sm font-medium ${data.change < 0 ? 'text-danger-600' : 'text-success-600'
                                                }`}
                                        >
                                            {data.change > 0 ? '+' : ''}{data.change} units
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Errors List */}
                    {results.errors.length > 0 && (
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-semibold text-gray-900">Errors ({results.errors.length})</h3>
                                <Button onClick={handleDownloadErrors} variant="secondary" className="flex items-center gap-2">
                                    <Download size={16} />
                                    Download Error Report
                                </Button>
                            </div>
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {results.errors.map((error, idx) => (
                                    <div key={idx} className="bg-danger-50 border border-danger-200 rounded p-3">
                                        <p className="text-sm font-medium text-danger-900">
                                            Row {error.row}: Order {error.orderId}
                                        </p>
                                        <p className="text-sm text-danger-700 mt-1">{error.message}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-center gap-4">
                        <Button onClick={handleReset} className="flex items-center gap-2">
                            <Upload size={18} />
                            Import Another File
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};
