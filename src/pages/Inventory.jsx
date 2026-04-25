import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    subscribeToProducts,
    addProduct,
    updateProduct,
    deleteProduct,
} from '../services/productService';
import { subscribeToSuppliers } from '../services/supplierService';
import { Modal } from '../components/common/Modal';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Plus, Pencil, Trash2, Package, Search, AlertTriangle, FileText, Upload, X, Calendar } from 'lucide-react';
import { formatCurrency } from '../utils/currencyUtils';
import { GST_RATES, PAYMENT_METHODS } from '../utils/constants';
import { format } from 'date-fns';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';
import toast from 'react-hot-toast';

export const Inventory = () => {
    const { user } = useAuth();
    const [products, setProducts] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [restockingProduct, setRestockingProduct] = useState(null);
    const [restockForm, setRestockForm] = useState({ quantity: '', price: '', date: format(new Date(), 'yyyy-MM-dd'), paymentMethod: 'Cash', invoiceFile: null });

    // Date range filter
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        sku: '',
        hsnCode: '',
        quantity: '',
        purchasePrice: '',
        gstRate: '18',
        supplierId: '',
        supplierName: '',
        supplierGst: '',
        lowStockThreshold: '10',
        purchaseDate: format(new Date(), 'yyyy-MM-dd'),
        paymentMethod: 'Cash',
        invoiceFile: null,
    });

    // Upload state
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (!user) return;

        const unsubProducts = subscribeToProducts(user.uid, (data) => {
            setProducts(data);
            setLoading(false);
        });

        const unsubSuppliers = subscribeToSuppliers(user.uid, (data) => {
            setSuppliers(data);
        });

        return () => {
            unsubProducts();
            unsubSuppliers();
        };
    }, [user]);

    const resetForm = () => {
        setFormData({
            name: '',
            sku: '',
            hsnCode: '',
            quantity: '',
            purchasePrice: '',
            gstRate: '18',
            supplierId: '',
            supplierName: '',
            supplierGst: '',
            lowStockThreshold: '10',
            purchaseDate: format(new Date(), 'yyyy-MM-dd'),
            paymentMethod: 'Cash',
            invoiceFile: null,
        });
        setEditingProduct(null);
    };

    const generateSKU = () => {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 7);
        return `SKU-${timestamp}-${random}`.toUpperCase();
    };

    const handleSupplierChange = (supplierId) => {
        const supplier = suppliers.find(s => s.id === supplierId);
        if (supplier) {
            setFormData({
                ...formData,
                supplierId: supplier.id,
                supplierName: supplier.name,
                supplierGst: supplier.gstNumber || '',
            });
        } else {
            setFormData({
                ...formData,
                supplierId: '',
                supplierName: '',
                supplierGst: '',
            });
        }
    };

    const handleOpenModal = (product = null) => {
        if (product) {
            setEditingProduct(product);
            setFormData({
                name: product.name,
                sku: product.sku,
                hsnCode: product.hsnCode || '',
                quantity: product.quantity.toString(),
                purchasePrice: product.purchasePrice.toString(),
                gstRate: product.gstRate?.toString() || '18',
                supplierId: product.supplierId || '',
                supplierName: product.supplierName || '',
                supplierGst: product.supplierGst || '',
                lowStockThreshold: product.lowStockThreshold?.toString() || '10',
                purchaseDate: product.purchaseDate
                    ? format(product.purchaseDate?.toDate?.() || new Date(product.purchaseDate), 'yyyy-MM-dd')
                    : format(new Date(), 'yyyy-MM-dd'),
                paymentMethod: product.paymentMethod || 'Cash',
                invoiceFile: null,
            });
        } else {
            resetForm();
            setFormData((prev) => ({ ...prev, sku: generateSKU() }));
        }
        setModalOpen(true);
    };

    const handleCloseModal = () => {
        setModalOpen(false);
        resetForm();
    };

    /**
     * Upload invoice file to Firebase Storage
     * Returns the download URL or null
     */
    const uploadInvoiceFile = async (file) => {
        if (!file) return null;
        try {
            setUploading(true);
            const timestamp = Date.now();
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const storageRef = ref(storage, `purchases/${user.uid}/${timestamp}_${safeName}`);
            const snapshot = await uploadBytes(storageRef, file);
            const url = await getDownloadURL(snapshot.ref);
            return url;
        } catch (error) {
            console.error('Error uploading invoice:', error);
            toast.error('Failed to upload invoice file. Purchase saved without invoice.');
            return null;
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name || !formData.sku || !formData.quantity || !formData.purchasePrice) {
            toast.error('Please fill in all required fields');
            return;
        }

        try {
            // Check for potential duplicates
            const isDuplicateName = products.some(
                p => p.name.toLowerCase() === formData.name.trim().toLowerCase() &&
                    (!editingProduct || p.id !== editingProduct.id)
            );

            const isDuplicateSKU = products.some(
                p => p.sku.toLowerCase() === formData.sku.trim().toLowerCase() &&
                    (!editingProduct || p.id !== editingProduct.id)
            );

            if (isDuplicateName) {
                toast.error('A product with this name already exists. Please edit the existing product to add stock.');
                return;
            }

            if (isDuplicateSKU) {
                toast.error('A product with this SKU already exists.');
                return;
            }

            // Upload invoice if provided
            let invoiceUrl = editingProduct?.invoiceUrl || null;
            if (formData.invoiceFile) {
                invoiceUrl = await uploadInvoiceFile(formData.invoiceFile);
            }

            const purchaseDate = new Date(formData.purchaseDate);
            const qty = parseInt(formData.quantity);
            const price = parseFloat(formData.purchasePrice);
            const totalPurchaseCost = qty * price;

            const productData = {
                name: formData.name,
                sku: formData.sku,
                hsnCode: formData.hsnCode,
                quantity: qty,
                purchasePrice: price,
                gstRate: parseFloat(formData.gstRate),
                supplierId: formData.supplierId,
                supplierName: formData.supplierName,
                supplierGst: formData.supplierGst,
                lowStockThreshold: parseInt(formData.lowStockThreshold),
                purchaseDate: purchaseDate,
                paymentMethod: formData.paymentMethod,
                totalPurchaseCost: totalPurchaseCost,
            };

            if (invoiceUrl) {
                productData.invoiceUrl = invoiceUrl;
            }

            let productId;
            if (editingProduct) {
                await updateProduct(editingProduct.id, productData);
                productId = editingProduct.id;
                toast.success('Product updated successfully');

                // DATA SYNC: Update linked transactions when price/quantity changes
                const oldQty = editingProduct.quantity || 0;
                const oldPrice = editingProduct.purchasePrice || 0;
                const newQuantity = productData.quantity;
                const newPrice = productData.purchasePrice;

                if (oldQty !== newQuantity || oldPrice !== newPrice) {
                    try {
                        const { getTransactionsByReference, updateTransaction, addTransaction } = await import('../services/transactionService');
                        const linkedTransactions = await getTransactionsByReference(productId);
                        const purchaseTransactions = linkedTransactions.filter(t => t.type === 'expense' && t.category === 'Purchase');

                        if (purchaseTransactions.length > 0) {
                            // Update the most recent purchase transaction with the new total
                            const latestTransaction = purchaseTransactions.sort((a, b) => b.date - a.date)[0];
                            const newTotal = newQuantity * newPrice;
                            await updateTransaction(latestTransaction.id, {
                                amount: newTotal,
                                description: `Stock Update: ${productData.name} (${newQuantity} × ${formatCurrency(newPrice)})`,
                                date: purchaseDate,
                            });
                            toast.success('Linked transactions synced!', { duration: 2000 });
                        } else if (newQuantity > 0) {
                            // No linked transaction exists yet, create one
                            const cost = newQuantity * newPrice;
                            await addTransaction(user.uid, {
                                type: 'expense',
                                category: 'Purchase',
                                amount: cost,
                                description: `Stock Update: ${productData.name} (${newQuantity} × ${formatCurrency(newPrice)})`,
                                date: purchaseDate,
                                paymentMethod: formData.paymentMethod,
                                referenceId: productId,
                                status: 'completed'
                            });
                        }
                    } catch (syncError) {
                        console.error('Transaction sync error:', syncError);
                        toast.error('Product updated, but transaction sync failed. Check Transactions page.');
                    }
                }

            } else {
                // Build initial purchase history entry
                productData.purchaseHistory = [{
                    quantity: qty,
                    unitPrice: price,
                    total: totalPurchaseCost,
                    date: purchaseDate,
                    paymentMethod: formData.paymentMethod,
                    invoiceUrl: invoiceUrl || null,
                }];

                productId = await addProduct(user.uid, productData);
                toast.success('Product added successfully');

                // Initial Stock Purchase Transaction
                if (qty > 0) {
                    const { addTransaction } = await import('../services/transactionService');
                    await addTransaction(user.uid, {
                        type: 'expense',
                        category: 'Purchase',
                        amount: totalPurchaseCost,
                        description: `Initial Stock: ${productData.name} (${qty} × ${formatCurrency(price)})`,
                        date: purchaseDate,
                        paymentMethod: formData.paymentMethod,
                        referenceId: productId,
                        status: 'completed'
                    });
                }
            }

            handleCloseModal();
        } catch (error) {
            console.error('Error saving product:', error);
            toast.error('Failed to save product');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this product?')) {
            return;
        }

        try {
            await deleteProduct(id);
            toast.success('Product deleted successfully');
        } catch (error) {
            console.error('Error deleting product:', error);
            toast.error('Failed to delete product');
        }
    };

    const handleRestockOpen = (product) => {
        setRestockingProduct(product);
        setRestockForm({
            quantity: '',
            price: product.purchasePrice.toString(),
            date: format(new Date(), 'yyyy-MM-dd'),
            paymentMethod: 'Cash',
            invoiceFile: null,
        });
    };

    const handleRestockClose = () => {
        setRestockingProduct(null);
        setRestockForm({ quantity: '', price: '', date: format(new Date(), 'yyyy-MM-dd'), paymentMethod: 'Cash', invoiceFile: null });
    };

    const handleRestockSubmit = async (e) => {
        e.preventDefault();
        const qty = parseInt(restockForm.quantity);
        const price = parseFloat(restockForm.price);

        if (!qty || qty <= 0) {
            toast.error('Please enter valid quantity');
            return;
        }

        if (!price || price < 0) {
            toast.error('Please enter valid price');
            return;
        }

        try {
            // Weighted Average Cost (WAC) calculation
            const oldQty = restockingProduct.quantity || 0;
            const oldPrice = restockingProduct.purchasePrice || 0;
            const newTotalQty = oldQty + qty;
            const weightedAvgPrice = newTotalQty > 0
                ? ((oldQty * oldPrice) + (qty * price)) / newTotalQty
                : price;

            // Upload invoice if provided
            let invoiceUrl = null;
            if (restockForm.invoiceFile) {
                invoiceUrl = await uploadInvoiceFile(restockForm.invoiceFile);
            }

            const restockDate = new Date(restockForm.date);

            // Build updated purchase history
            const existingHistory = restockingProduct.purchaseHistory || [];
            const newHistoryEntry = {
                quantity: qty,
                unitPrice: price,
                total: qty * price,
                date: restockDate,
                paymentMethod: restockForm.paymentMethod,
                invoiceUrl: invoiceUrl || null,
            };

            await updateProduct(restockingProduct.id, {
                quantity: newTotalQty,
                purchasePrice: Math.round(weightedAvgPrice * 100) / 100, // Round to 2 decimals
                totalPurchaseCost: newTotalQty * weightedAvgPrice,
                purchaseHistory: [...existingHistory, newHistoryEntry],
            });

            const { addTransaction } = await import('../services/transactionService');
            await addTransaction(user.uid, {
                type: 'expense',
                category: 'Purchase',
                amount: qty * price,
                description: `Restock: ${restockingProduct.name} (+${qty} @ ${formatCurrency(price)})`,
                date: restockDate,
                paymentMethod: restockForm.paymentMethod,
                referenceId: restockingProduct.id,
                status: 'completed'
            });

            toast.success(
                oldPrice !== price
                    ? `Stock added! Avg cost updated: ${formatCurrency(oldPrice)} → ${formatCurrency(weightedAvgPrice)}`
                    : 'Stock added successfully'
            );
            handleRestockClose();
        } catch (error) {
            console.error('Restock error:', error);
            toast.error('Failed to add stock');
        }
    };

    // Filter products
    const filteredProducts = products
        .sort((a, b) => a.name.localeCompare(b.name))
        .filter((p) => {
            const matchesSearch =
                !searchQuery ||
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.sku.toLowerCase().includes(searchQuery.toLowerCase());

            let matchesStatus = true;
            if (filterStatus === 'in-stock') {
                matchesStatus = p.quantity > (p.lowStockThreshold || 10);
            } else if (filterStatus === 'low-stock') {
                matchesStatus = p.quantity > 0 && p.quantity <= (p.lowStockThreshold || 10);
            } else if (filterStatus === 'out-of-stock') {
                matchesStatus = p.quantity === 0;
            }

            // Date range filter
            let matchesDate = true;
            if (dateFrom || dateTo) {
                const productDate = p.purchaseDate?.toDate?.()
                    || (p.purchaseDate ? new Date(p.purchaseDate) : null)
                    || p.createdAt?.toDate?.()
                    || (p.createdAt ? new Date(p.createdAt) : null);

                if (productDate) {
                    if (dateFrom) {
                        matchesDate = productDate >= new Date(dateFrom);
                    }
                    if (dateTo && matchesDate) {
                        const toDateEnd = new Date(dateTo);
                        toDateEnd.setHours(23, 59, 59, 999);
                        matchesDate = productDate <= toDateEnd;
                    }
                } else {
                    matchesDate = !dateFrom && !dateTo; // No date, only show if no filter
                }
            }

            return matchesSearch && matchesStatus && matchesDate;
        });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    const supplierOptions = [
        { value: '', label: 'Select Supplier (Optional)' },
        ...suppliers.map(s => ({ value: s.id, label: s.name }))
    ];

    const gstOptions = GST_RATES;

    const paymentMethodOptions = [
        { value: '', label: 'Select Payment Method' },
        ...PAYMENT_METHODS.map(m => ({ value: m, label: m }))
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Inventory</h1>
                    <p className="text-gray-600 mt-1">Manage your products and stock levels</p>
                </div>
                <Button onClick={() => handleOpenModal()} className="flex items-center gap-2">
                    <Plus size={20} />
                    Add Product
                </Button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Stock Status Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Stock Status</label>
                        <div className="flex flex-wrap gap-2">
                            {['all', 'in-stock', 'low-stock', 'out-of-stock'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status)}
                                    className={`px-3 py-1.5 rounded-lg font-medium transition-all text-xs ${filterStatus === status
                                        ? 'bg-primary-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    {status.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Search */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <Search size={16} className="inline mr-1" />
                            Search
                        </label>
                        <Input
                            type="text"
                            placeholder="Search by name or SKU..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Date From Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <Calendar size={16} className="inline mr-1" />
                            From Date
                        </label>
                        <Input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                        />
                    </div>

                    {/* Date To Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <Calendar size={16} className="inline mr-1" />
                            To Date
                        </label>
                        <Input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                        />
                    </div>
                </div>

                {/* Clear Date Filters */}
                {(dateFrom || dateTo) && (
                    <div className="mt-3">
                        <button
                            onClick={() => { setDateFrom(''); setDateTo(''); }}
                            className="text-sm text-primary-600 hover:text-primary-800 underline"
                        >
                            Clear date filters
                        </button>
                    </div>
                )}
            </div>

            {/* Products List */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                {filteredProducts.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Product
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        SKU / HSN
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Stock
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Supplier
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Purchase Price
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Total Cost
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        GST
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Purchase Date
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Invoice
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {filteredProducts.map((product) => {
                                    const isLowStock = product.quantity <= (product.lowStockThreshold || 10) && product.quantity > 0;
                                    const isOutOfStock = product.quantity === 0;
                                    const totalCost = (product.quantity || 0) * (product.purchasePrice || 0);
                                    const purchaseDate = product.purchaseDate?.toDate?.()
                                        || (product.purchaseDate ? new Date(product.purchaseDate) : null)
                                        || product.createdAt?.toDate?.()
                                        || null;

                                    return (
                                        <tr key={product.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center mr-3">
                                                        <Package className="w-5 h-5 text-primary-600" />
                                                    </div>
                                                    <div className="text-sm font-medium text-gray-900">{product.name}</div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                <div>{product.sku}</div>
                                                {product.hsnCode && <div className="text-xs text-gray-500">HSN: {product.hsnCode}</div>}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-gray-900">{product.quantity}</span>
                                                    {isOutOfStock && (
                                                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-danger-100 text-danger-800">
                                                            Out of Stock
                                                        </span>
                                                    )}
                                                    {isLowStock && (
                                                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800 flex items-center gap-1">
                                                            <AlertTriangle size={12} />
                                                            Low Stock
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {product.supplierName || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {formatCurrency(product.purchasePrice || 0)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                                {formatCurrency(totalCost)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {product.gstRate ? `${product.gstRate}%` : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {purchaseDate ? format(purchaseDate, 'MMM dd, yyyy') : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                {product.invoiceUrl ? (
                                                    <a
                                                        href={product.invoiceUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-primary-600 hover:text-primary-800 flex items-center gap-1"
                                                        title="View Invoice"
                                                    >
                                                        <FileText size={16} />
                                                        View
                                                    </a>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button
                                                    onClick={() => handleRestockOpen(product)}
                                                    className="text-success-600 hover:text-success-900 mr-4"
                                                    title="Add Stock"
                                                >
                                                    <Plus size={18} className="bg-success-100 rounded-full p-1" />
                                                </button>

                                                <button
                                                    onClick={() => handleOpenModal(product)}
                                                    className="text-primary-600 hover:text-primary-900 mr-4"
                                                    title="Edit"
                                                >
                                                    <Pencil size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(product.id)}
                                                    className="text-danger-600 hover:text-danger-900"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState
                        icon={Package}
                        title="No products found"
                        description="Start adding products to track your inventory"
                        action={() => handleOpenModal()}
                        actionLabel="Add Product"
                    />
                )}
            </div>

            {/* Product Modal */}
            <Modal
                isOpen={modalOpen}
                onClose={handleCloseModal}
                title={editingProduct ? 'Edit Product' : 'Add Product'}
                size="lg"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Product Name *"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Enter product name"
                        />

                        <Input
                            label="SKU *"
                            value={formData.sku}
                            onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                            placeholder="SKU-XXX-XXXX"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="HSN Code"
                            value={formData.hsnCode}
                            onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })}
                            placeholder="12345678"
                        />

                        <Select
                            label="GST Rate"
                            value={formData.gstRate}
                            onChange={(e) => setFormData({ ...formData, gstRate: e.target.value })}
                            options={gstOptions}
                        />
                    </div>

                    {/* Supplier Selection with Auto-fill */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-blue-900 mb-3">Supplier Information</h3>
                        <Select
                            label="Select Supplier"
                            value={formData.supplierId}
                            onChange={(e) => handleSupplierChange(e.target.value)}
                            options={supplierOptions}
                        />

                        {formData.supplierId && (
                            <div className="mt-3 p-3 bg-white rounded border border-blue-200">
                                <div className="text-sm space-y-1">
                                    <div><span className="font-medium">Supplier:</span> {formData.supplierName}</div>
                                    {formData.supplierGst && (
                                        <div><span className="font-medium">GST Number:</span> {formData.supplierGst}</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Quantity *"
                            type="number"
                            value={formData.quantity}
                            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                            placeholder="0"
                        />

                        <Input
                            label="Low Stock Threshold"
                            type="number"
                            value={formData.lowStockThreshold}
                            onChange={(e) => setFormData({ ...formData, lowStockThreshold: e.target.value })}
                            placeholder="10"
                        />
                    </div>

                    <Input
                        label="Purchase Price (per unit) *"
                        type="number"
                        step="0.01"
                        value={formData.purchasePrice}
                        onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                        placeholder="0.00"
                    />

                    {/* Total Purchase Cost (computed) */}
                    {formData.purchasePrice && formData.quantity && (
                        <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg flex justify-between items-center">
                            <p className="text-sm text-emerald-800 font-medium">
                                Total Purchase Cost
                            </p>
                            <p className="text-lg font-bold text-emerald-700">
                                {formatCurrency(parseFloat(formData.quantity) * parseFloat(formData.purchasePrice))}
                            </p>
                        </div>
                    )}

                    {/* Date & Payment */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Purchase Date *"
                            type="date"
                            value={formData.purchaseDate}
                            onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                        />

                        <Select
                            label="Payment Method"
                            value={formData.paymentMethod}
                            onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                            options={paymentMethodOptions}
                        />
                    </div>

                    {/* Invoice Upload */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <Upload size={16} className="inline mr-1" />
                            Attach Invoice / Bill (Optional)
                        </label>
                        <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-primary-400 transition-colors">
                            <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,.webp"
                                onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                        const file = e.target.files[0];
                                        if (file.size > 10 * 1024 * 1024) {
                                            toast.error('File must be under 10MB');
                                            return;
                                        }
                                        setFormData({ ...formData, invoiceFile: file });
                                    }
                                }}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            {formData.invoiceFile ? (
                                <div className="flex items-center justify-center gap-3">
                                    <FileText className="w-5 h-5 text-primary-600" />
                                    <span className="text-sm font-medium text-gray-900">{formData.invoiceFile.name}</span>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setFormData({ ...formData, invoiceFile: null }); }}
                                        className="text-danger-500 hover:text-danger-700"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                                    <p className="text-sm text-gray-500">PDF, JPG, PNG, WEBP — Max 10MB</p>
                                </div>
                            )}
                        </div>
                        {editingProduct?.invoiceUrl && !formData.invoiceFile && (
                            <div className="mt-2">
                                <a href={editingProduct.invoiceUrl} target="_blank" rel="noopener noreferrer"
                                    className="text-sm text-primary-600 hover:text-primary-800 flex items-center gap-1">
                                    <FileText size={14} /> View existing invoice
                                </a>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2 justify-end pt-4">
                        <Button type="button" variant="secondary" onClick={handleCloseModal}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="primary" disabled={uploading}>
                            {uploading ? 'Uploading...' : (editingProduct ? 'Update' : 'Add')} Product
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Restock Modal */}
            {restockingProduct && (
                <Modal
                    isOpen={true}
                    onClose={handleRestockClose}
                    title={`Add Stock: ${restockingProduct.name}`}
                    size="md"
                >
                    <form onSubmit={handleRestockSubmit} className="space-y-4">
                        {/* Current Info */}
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                            <div className="text-sm space-y-1">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Current Stock:</span>
                                    <span className="font-semibold">{restockingProduct.quantity} units</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Current Avg Price:</span>
                                    <span className="font-semibold">{formatCurrency(restockingProduct.purchasePrice)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Quantity to Add *"
                                type="number"
                                value={restockForm.quantity}
                                onChange={(e) => setRestockForm({ ...restockForm, quantity: e.target.value })}
                                placeholder="0"
                            />
                            <Input
                                label="Unit Cost *"
                                type="number"
                                step="0.01"
                                value={restockForm.price}
                                onChange={(e) => setRestockForm({ ...restockForm, price: e.target.value })}
                                placeholder="0.00"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Purchase Date"
                                type="date"
                                value={restockForm.date}
                                onChange={(e) => setRestockForm({ ...restockForm, date: e.target.value })}
                            />
                            <Select
                                label="Payment Method"
                                value={restockForm.paymentMethod}
                                onChange={(e) => setRestockForm({ ...restockForm, paymentMethod: e.target.value })}
                                options={paymentMethodOptions}
                            />
                        </div>

                        {/* Invoice upload for restock */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                <Upload size={14} className="inline mr-1" />
                                Attach Invoice (Optional)
                            </label>
                            <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-3 text-center hover:border-primary-400 transition-colors">
                                <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            const file = e.target.files[0];
                                            if (file.size > 10 * 1024 * 1024) {
                                                toast.error('File must be under 10MB');
                                                return;
                                            }
                                            setRestockForm({ ...restockForm, invoiceFile: file });
                                        }
                                    }}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                {restockForm.invoiceFile ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <FileText className="w-4 h-4 text-primary-600" />
                                        <span className="text-sm font-medium">{restockForm.invoiceFile.name}</span>
                                        <button type="button" onClick={() => setRestockForm({ ...restockForm, invoiceFile: null })}
                                            className="text-danger-500 hover:text-danger-700">
                                            <X size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-500">PDF, JPG, PNG — Max 10MB</p>
                                )}
                            </div>
                        </div>

                        {/* Purchase Total */}
                        {restockForm.quantity && restockForm.price && (
                            <div className="bg-blue-50 p-3 rounded-lg space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-sm text-blue-900">This Purchase Total:</span>
                                    <span className="font-bold text-blue-700">
                                        {formatCurrency(parseFloat(restockForm.quantity) * parseFloat(restockForm.price))}
                                    </span>
                                </div>
                                {/* Show WAC preview if price differs */}
                                {parseFloat(restockForm.price) !== restockingProduct.purchasePrice && (
                                    <div className="flex justify-between border-t border-blue-200 pt-2">
                                        <span className="text-sm text-blue-900">New Avg Cost (WAC):</span>
                                        <span className="font-bold text-blue-700">
                                            {formatCurrency(
                                                ((restockingProduct.quantity * restockingProduct.purchasePrice) +
                                                    (parseFloat(restockForm.quantity) * parseFloat(restockForm.price))) /
                                                (restockingProduct.quantity + parseFloat(restockForm.quantity))
                                            )}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex gap-2 justify-end">
                            <Button type="button" variant="secondary" onClick={handleRestockClose}>
                                Cancel
                            </Button>
                            <Button type="submit" variant="primary" disabled={uploading}>
                                {uploading ? 'Uploading...' : 'Add Stock'}
                            </Button>
                        </div>
                    </form>
                </Modal>
            )}

        </div>
    );
};
