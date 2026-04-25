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
import { Plus, Pencil, Trash2, Package, Search, AlertTriangle, FileText, Upload, X, Calendar, ShoppingCart, MinusCircle } from 'lucide-react';
import { formatCurrency } from '../utils/currencyUtils';
import { GST_RATES, PAYMENT_METHODS } from '../utils/constants';
import { format } from 'date-fns';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';
import toast from 'react-hot-toast';

// Blank line item for purchase
const createEmptyLineItem = () => ({
    id: Date.now() + Math.random(),
    name: '',
    sku: '',
    hsnCode: '',
    quantity: '',
    purchasePrice: '',
    gstRate: '18',
    lowStockThreshold: '10',
    existingProductId: '', // If selecting an existing product
});

export const Inventory = () => {
    const { user } = useAuth();
    const [products, setProducts] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');

    // Date range filter
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // === NEW PURCHASE MODAL (multi-item) ===
    const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
    const [purchaseData, setPurchaseData] = useState({
        supplierId: '',
        supplierName: '',
        supplierGst: '',
        purchaseDate: format(new Date(), 'yyyy-MM-dd'),
        paymentMethod: 'Cash',
        invoiceFile: null,
        items: [createEmptyLineItem()],
    });

    // === EDIT PRODUCT MODAL (single item) ===
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [editFormData, setEditFormData] = useState({
        name: '', sku: '', hsnCode: '', quantity: '',
        purchasePrice: '', gstRate: '18', lowStockThreshold: '10',
        supplierId: '', supplierName: '', supplierGst: '',
    });

    // === RESTOCK MODAL (single item) ===
    const [restockingProduct, setRestockingProduct] = useState(null);
    const [restockForm, setRestockForm] = useState({
        quantity: '', price: '', date: format(new Date(), 'yyyy-MM-dd'),
        paymentMethod: 'Cash', invoiceFile: null,
    });

    // Upload state
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!user) return;
        const unsubProducts = subscribeToProducts(user.uid, (data) => {
            setProducts(data);
            setLoading(false);
        });
        const unsubSuppliers = subscribeToSuppliers(user.uid, (data) => {
            setSuppliers(data);
        });
        return () => { unsubProducts(); unsubSuppliers(); };
    }, [user]);

    // ────────────────────────────────────────
    // SHARED HELPERS
    // ────────────────────────────────────────

    const generateSKU = () => {
        const ts = Date.now().toString(36);
        const rnd = Math.random().toString(36).substring(2, 7);
        return `SKU-${ts}-${rnd}`.toUpperCase();
    };

    const uploadInvoiceFile = async (file) => {
        if (!file) return null;
        try {
            setUploading(true);
            const timestamp = Date.now();
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const storageRef = ref(storage, `purchases/${user.uid}/${timestamp}_${safeName}`);
            const snapshot = await uploadBytes(storageRef, file);
            return await getDownloadURL(snapshot.ref);
        } catch (error) {
            console.error('Error uploading invoice:', error);
            toast.error('Invoice upload failed — purchase saved without invoice.');
            return null;
        } finally {
            setUploading(false);
        }
    };

    // ────────────────────────────────────────
    // NEW PURCHASE (MULTI-ITEM)
    // ────────────────────────────────────────

    const resetPurchaseForm = () => {
        setPurchaseData({
            supplierId: '', supplierName: '', supplierGst: '',
            purchaseDate: format(new Date(), 'yyyy-MM-dd'),
            paymentMethod: 'Cash', invoiceFile: null,
            items: [createEmptyLineItem()],
        });
    };

    const handlePurchaseSupplierChange = (supplierId) => {
        const supplier = suppliers.find(s => s.id === supplierId);
        if (supplier) {
            setPurchaseData(prev => ({
                ...prev,
                supplierId: supplier.id,
                supplierName: supplier.name,
                supplierGst: supplier.gstNumber || '',
            }));
        } else {
            setPurchaseData(prev => ({
                ...prev, supplierId: '', supplierName: '', supplierGst: '',
            }));
        }
    };

    const updateLineItem = (itemId, field, value) => {
        setPurchaseData(prev => ({
            ...prev,
            items: prev.items.map(item =>
                item.id === itemId ? { ...item, [field]: value } : item
            ),
        }));
    };

    const handleExistingProductSelect = (itemId, productId) => {
        if (!productId) {
            updateLineItem(itemId, 'existingProductId', '');
            return;
        }
        const product = products.find(p => p.id === productId);
        if (product) {
            setPurchaseData(prev => ({
                ...prev,
                items: prev.items.map(item =>
                    item.id === itemId ? {
                        ...item,
                        existingProductId: productId,
                        name: product.name,
                        sku: product.sku,
                        hsnCode: product.hsnCode || '',
                        purchasePrice: product.purchasePrice?.toString() || '',
                        gstRate: product.gstRate?.toString() || '18',
                        lowStockThreshold: product.lowStockThreshold?.toString() || '10',
                    } : item
                ),
            }));
        }
    };

    const addLineItem = () => {
        setPurchaseData(prev => ({
            ...prev,
            items: [...prev.items, createEmptyLineItem()],
        }));
    };

    const removeLineItem = (itemId) => {
        setPurchaseData(prev => ({
            ...prev,
            items: prev.items.filter(item => item.id !== itemId),
        }));
    };

    const getLineTotal = (item) => {
        const qty = parseFloat(item.quantity) || 0;
        const price = parseFloat(item.purchasePrice) || 0;
        return qty * price;
    };

    const getGrandTotal = () => {
        return purchaseData.items.reduce((sum, item) => sum + getLineTotal(item), 0);
    };

    const handlePurchaseSubmit = async (e) => {
        e.preventDefault();

        // Validate all items
        const validItems = purchaseData.items.filter(item => item.name && item.quantity && item.purchasePrice);
        if (validItems.length === 0) {
            toast.error('Please add at least one item with name, quantity, and price');
            return;
        }

        // Check for items missing required fields
        const invalidItems = purchaseData.items.filter(item =>
            (item.name || item.quantity || item.purchasePrice) &&
            (!item.name || !item.quantity || !item.purchasePrice)
        );
        if (invalidItems.length > 0) {
            toast.error('Some items are incomplete. Fill in name, quantity, and price for each item.');
            return;
        }

        setSaving(true);
        try {
            // Upload invoice (shared across all items)
            let invoiceUrl = null;
            if (purchaseData.invoiceFile) {
                invoiceUrl = await uploadInvoiceFile(purchaseData.invoiceFile);
            }

            const purchaseDate = new Date(purchaseData.purchaseDate);
            const { addTransaction } = await import('../services/transactionService');

            let successCount = 0;

            for (const item of validItems) {
                const qty = parseInt(item.quantity);
                const price = parseFloat(item.purchasePrice);
                const totalCost = qty * price;

                if (item.existingProductId) {
                    // ── RESTOCK EXISTING PRODUCT (weighted average cost) ──
                    const existingProduct = products.find(p => p.id === item.existingProductId);
                    if (existingProduct) {
                        const oldQty = existingProduct.quantity || 0;
                        const oldPrice = existingProduct.purchasePrice || 0;
                        const newTotalQty = oldQty + qty;
                        const weightedAvgPrice = newTotalQty > 0
                            ? ((oldQty * oldPrice) + (qty * price)) / newTotalQty
                            : price;

                        const existingHistory = existingProduct.purchaseHistory || [];
                        await updateProduct(item.existingProductId, {
                            quantity: newTotalQty,
                            purchasePrice: Math.round(weightedAvgPrice * 100) / 100,
                            totalPurchaseCost: newTotalQty * weightedAvgPrice,
                            purchaseHistory: [...existingHistory, {
                                quantity: qty, unitPrice: price, total: totalCost,
                                date: purchaseDate, paymentMethod: purchaseData.paymentMethod,
                                invoiceUrl: invoiceUrl || null,
                            }],
                        });

                        await addTransaction(user.uid, {
                            type: 'expense', category: 'Purchase',
                            amount: totalCost,
                            description: `Restock: ${existingProduct.name} (+${qty} @ ${formatCurrency(price)})`,
                            date: purchaseDate,
                            paymentMethod: purchaseData.paymentMethod,
                            referenceId: item.existingProductId,
                            status: 'completed',
                        });
                    }
                } else {
                    // ── CREATE NEW PRODUCT ──
                    // Check duplicate name
                    const isDuplicate = products.some(
                        p => p.name.toLowerCase() === item.name.trim().toLowerCase()
                    );
                    if (isDuplicate) {
                        toast.error(`"${item.name}" already exists. Use the existing product dropdown instead.`);
                        continue;
                    }

                    const sku = item.sku || generateSKU();
                    const productData = {
                        name: item.name.trim(),
                        sku: sku,
                        hsnCode: item.hsnCode,
                        quantity: qty,
                        purchasePrice: price,
                        gstRate: parseFloat(item.gstRate),
                        supplierId: purchaseData.supplierId,
                        supplierName: purchaseData.supplierName,
                        supplierGst: purchaseData.supplierGst,
                        lowStockThreshold: parseInt(item.lowStockThreshold) || 10,
                        purchaseDate: purchaseDate,
                        paymentMethod: purchaseData.paymentMethod,
                        totalPurchaseCost: totalCost,
                        purchaseHistory: [{
                            quantity: qty, unitPrice: price, total: totalCost,
                            date: purchaseDate, paymentMethod: purchaseData.paymentMethod,
                            invoiceUrl: invoiceUrl || null,
                        }],
                    };
                    if (invoiceUrl) productData.invoiceUrl = invoiceUrl;

                    const productId = await addProduct(user.uid, productData);

                    if (qty > 0) {
                        await addTransaction(user.uid, {
                            type: 'expense', category: 'Purchase',
                            amount: totalCost,
                            description: `Initial Stock: ${productData.name} (${qty} × ${formatCurrency(price)})`,
                            date: purchaseDate,
                            paymentMethod: purchaseData.paymentMethod,
                            referenceId: productId,
                            status: 'completed',
                        });
                    }
                }
                successCount++;
            }

            if (successCount > 0) {
                toast.success(`Purchase saved! ${successCount} item${successCount > 1 ? 's' : ''} processed.`);
            }
            setPurchaseModalOpen(false);
            resetPurchaseForm();
        } catch (error) {
            console.error('Error saving purchase:', error);
            toast.error('Failed to save purchase');
        } finally {
            setSaving(false);
        }
    };

    // ────────────────────────────────────────
    // EDIT PRODUCT (single)
    // ────────────────────────────────────────

    const handleEditOpen = (product) => {
        setEditingProduct(product);
        setEditFormData({
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
        });
        setEditModalOpen(true);
    };

    const handleEditClose = () => {
        setEditModalOpen(false);
        setEditingProduct(null);
    };

    const handleEditSupplierChange = (supplierId) => {
        const supplier = suppliers.find(s => s.id === supplierId);
        if (supplier) {
            setEditFormData(prev => ({
                ...prev, supplierId: supplier.id,
                supplierName: supplier.name, supplierGst: supplier.gstNumber || '',
            }));
        } else {
            setEditFormData(prev => ({
                ...prev, supplierId: '', supplierName: '', supplierGst: '',
            }));
        }
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        if (!editFormData.name || !editFormData.sku || !editFormData.quantity || !editFormData.purchasePrice) {
            toast.error('Please fill in all required fields');
            return;
        }

        try {
            const qty = parseInt(editFormData.quantity);
            const price = parseFloat(editFormData.purchasePrice);

            const productData = {
                name: editFormData.name,
                sku: editFormData.sku,
                hsnCode: editFormData.hsnCode,
                quantity: qty,
                purchasePrice: price,
                gstRate: parseFloat(editFormData.gstRate),
                supplierId: editFormData.supplierId,
                supplierName: editFormData.supplierName,
                supplierGst: editFormData.supplierGst,
                lowStockThreshold: parseInt(editFormData.lowStockThreshold),
                totalPurchaseCost: qty * price,
            };

            await updateProduct(editingProduct.id, productData);

            // DATA SYNC: Update linked transactions when price/quantity changes
            const oldQty = editingProduct.quantity || 0;
            const oldPrice = editingProduct.purchasePrice || 0;

            if (oldQty !== qty || oldPrice !== price) {
                try {
                    const { getTransactionsByReference, updateTransaction, addTransaction } = await import('../services/transactionService');
                    const linkedTransactions = await getTransactionsByReference(editingProduct.id);
                    const purchaseTransactions = linkedTransactions.filter(t => t.type === 'expense' && t.category === 'Purchase');

                    if (purchaseTransactions.length > 0) {
                        const latestTransaction = purchaseTransactions.sort((a, b) => b.date - a.date)[0];
                        await updateTransaction(latestTransaction.id, {
                            amount: qty * price,
                            description: `Stock Update: ${productData.name} (${qty} × ${formatCurrency(price)})`,
                        });
                        toast.success('Product & linked transactions synced!');
                    } else if (qty > 0) {
                        await addTransaction(user.uid, {
                            type: 'expense', category: 'Purchase',
                            amount: qty * price,
                            description: `Stock Update: ${productData.name} (${qty} × ${formatCurrency(price)})`,
                            date: new Date(),
                            paymentMethod: 'Cash',
                            referenceId: editingProduct.id,
                            status: 'completed',
                        });
                        toast.success('Product updated & transaction created!');
                    }
                } catch (syncError) {
                    console.error('Sync error:', syncError);
                    toast.error('Product updated, but transaction sync failed.');
                }
            } else {
                toast.success('Product updated successfully');
            }

            handleEditClose();
        } catch (error) {
            console.error('Error updating product:', error);
            toast.error('Failed to update product');
        }
    };

    // ────────────────────────────────────────
    // DELETE PRODUCT
    // ────────────────────────────────────────

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this product? This will also remove all linked purchase transactions.')) {
            return;
        }
        try {
            const { getTransactionsByReference, deleteTransaction: delTransaction } = await import('../services/transactionService');
            const linkedTransactions = await getTransactionsByReference(id);
            if (linkedTransactions.length > 0) {
                await Promise.all(linkedTransactions.map(t => delTransaction(t.id)));
            }
            await deleteProduct(id);
            const txCount = linkedTransactions.length;
            toast.success(
                txCount > 0
                    ? `Product deleted along with ${txCount} linked transaction${txCount > 1 ? 's' : ''}`
                    : 'Product deleted successfully'
            );
        } catch (error) {
            console.error('Error deleting product:', error);
            toast.error('Failed to delete product');
        }
    };

    // ────────────────────────────────────────
    // RESTOCK (single item, quick add)
    // ────────────────────────────────────────

    const handleRestockOpen = (product) => {
        setRestockingProduct(product);
        setRestockForm({
            quantity: '', price: product.purchasePrice.toString(),
            date: format(new Date(), 'yyyy-MM-dd'), paymentMethod: 'Cash', invoiceFile: null,
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

        if (!qty || qty <= 0) { toast.error('Please enter valid quantity'); return; }
        if (!price || price < 0) { toast.error('Please enter valid price'); return; }

        try {
            const oldQty = restockingProduct.quantity || 0;
            const oldPrice = restockingProduct.purchasePrice || 0;
            const newTotalQty = oldQty + qty;
            const weightedAvgPrice = newTotalQty > 0
                ? ((oldQty * oldPrice) + (qty * price)) / newTotalQty : price;

            let invoiceUrl = null;
            if (restockForm.invoiceFile) {
                invoiceUrl = await uploadInvoiceFile(restockForm.invoiceFile);
            }

            const restockDate = new Date(restockForm.date);
            const existingHistory = restockingProduct.purchaseHistory || [];

            await updateProduct(restockingProduct.id, {
                quantity: newTotalQty,
                purchasePrice: Math.round(weightedAvgPrice * 100) / 100,
                totalPurchaseCost: newTotalQty * weightedAvgPrice,
                purchaseHistory: [...existingHistory, {
                    quantity: qty, unitPrice: price, total: qty * price,
                    date: restockDate, paymentMethod: restockForm.paymentMethod,
                    invoiceUrl: invoiceUrl || null,
                }],
            });

            const { addTransaction } = await import('../services/transactionService');
            await addTransaction(user.uid, {
                type: 'expense', category: 'Purchase',
                amount: qty * price,
                description: `Restock: ${restockingProduct.name} (+${qty} @ ${formatCurrency(price)})`,
                date: restockDate, paymentMethod: restockForm.paymentMethod,
                referenceId: restockingProduct.id, status: 'completed',
            });

            toast.success(
                oldPrice !== price
                    ? `Stock added! Avg cost: ${formatCurrency(oldPrice)} → ${formatCurrency(weightedAvgPrice)}`
                    : 'Stock added successfully'
            );
            handleRestockClose();
        } catch (error) {
            console.error('Restock error:', error);
            toast.error('Failed to add stock');
        }
    };

    // ────────────────────────────────────────
    // FILTER PRODUCTS
    // ────────────────────────────────────────

    const filteredProducts = products
        .sort((a, b) => a.name.localeCompare(b.name))
        .filter((p) => {
            const matchesSearch = !searchQuery ||
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.sku.toLowerCase().includes(searchQuery.toLowerCase());

            let matchesStatus = true;
            if (filterStatus === 'in-stock') matchesStatus = p.quantity > (p.lowStockThreshold || 10);
            else if (filterStatus === 'low-stock') matchesStatus = p.quantity > 0 && p.quantity <= (p.lowStockThreshold || 10);
            else if (filterStatus === 'out-of-stock') matchesStatus = p.quantity === 0;

            let matchesDate = true;
            if (dateFrom || dateTo) {
                const productDate = p.purchaseDate?.toDate?.()
                    || (p.purchaseDate ? new Date(p.purchaseDate) : null)
                    || p.createdAt?.toDate?.() || (p.createdAt ? new Date(p.createdAt) : null);
                if (productDate) {
                    if (dateFrom) matchesDate = productDate >= new Date(dateFrom);
                    if (dateTo && matchesDate) {
                        const end = new Date(dateTo); end.setHours(23, 59, 59, 999);
                        matchesDate = productDate <= end;
                    }
                } else { matchesDate = !dateFrom && !dateTo; }
            }

            return matchesSearch && matchesStatus && matchesDate;
        });

    // ────────────────────────────────────────
    // RENDER
    // ────────────────────────────────────────

    if (loading) {
        return (<div className="flex items-center justify-center h-full"><LoadingSpinner size="lg" /></div>);
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
    const existingProductOptions = [
        { value: '', label: '➕ New Product' },
        ...products.map(p => ({ value: p.id, label: `${p.name} (Stock: ${p.quantity})` }))
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Inventory</h1>
                    <p className="text-gray-600 mt-1">Manage your products and stock levels</p>
                </div>
                <Button
                    onClick={() => { resetPurchaseForm(); setPurchaseModalOpen(true); }}
                    className="flex items-center gap-2"
                >
                    <ShoppingCart size={20} />
                    New Purchase
                </Button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Stock Status</label>
                        <div className="flex flex-wrap gap-2">
                            {['all', 'in-stock', 'low-stock', 'out-of-stock'].map((status) => (
                                <button key={status} onClick={() => setFilterStatus(status)}
                                    className={`px-3 py-1.5 rounded-lg font-medium transition-all text-xs ${filterStatus === status
                                        ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                                    {status.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <Search size={16} className="inline mr-1" />Search
                        </label>
                        <Input type="text" placeholder="Search by name or SKU..."
                            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <Calendar size={16} className="inline mr-1" />From Date
                        </label>
                        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <Calendar size={16} className="inline mr-1" />To Date
                        </label>
                        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                    </div>
                </div>
                {(dateFrom || dateTo) && (
                    <div className="mt-3">
                        <button onClick={() => { setDateFrom(''); setDateTo(''); }}
                            className="text-sm text-primary-600 hover:text-primary-800 underline">
                            Clear date filters
                        </button>
                    </div>
                )}
            </div>

            {/* Products Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                {filteredProducts.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU / HSN</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Cost</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">GST</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {filteredProducts.map((product) => {
                                    const isLowStock = product.quantity <= (product.lowStockThreshold || 10) && product.quantity > 0;
                                    const isOutOfStock = product.quantity === 0;
                                    const totalCost = (product.quantity || 0) * (product.purchasePrice || 0);
                                    const purchaseDate = product.purchaseDate?.toDate?.()
                                        || (product.purchaseDate ? new Date(product.purchaseDate) : null)
                                        || product.createdAt?.toDate?.() || null;

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
                                                    {isOutOfStock && <span className="px-2 py-1 text-xs font-medium rounded-full bg-danger-100 text-danger-800">Out of Stock</span>}
                                                    {isLowStock && <span className="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800 flex items-center gap-1"><AlertTriangle size={12} />Low</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{product.supplierName || '-'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(product.purchasePrice || 0)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{formatCurrency(totalCost)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{product.gstRate ? `${product.gstRate}%` : '-'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {purchaseDate ? format(purchaseDate, 'MMM dd, yyyy') : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                {product.invoiceUrl ? (
                                                    <a href={product.invoiceUrl} target="_blank" rel="noopener noreferrer"
                                                        className="text-primary-600 hover:text-primary-800 flex items-center gap-1" title="View Invoice">
                                                        <FileText size={16} />View
                                                    </a>
                                                ) : <span className="text-gray-400">-</span>}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button onClick={() => handleRestockOpen(product)}
                                                    className="text-success-600 hover:text-success-900 mr-3" title="Add Stock">
                                                    <Plus size={18} className="bg-success-100 rounded-full p-1" />
                                                </button>
                                                <button onClick={() => handleEditOpen(product)}
                                                    className="text-primary-600 hover:text-primary-900 mr-3" title="Edit">
                                                    <Pencil size={18} />
                                                </button>
                                                <button onClick={() => handleDelete(product.id)}
                                                    className="text-danger-600 hover:text-danger-900" title="Delete">
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
                        icon={Package} title="No products found"
                        description="Start adding products by creating a new purchase"
                        action={() => { resetPurchaseForm(); setPurchaseModalOpen(true); }}
                        actionLabel="New Purchase" />
                )}
            </div>

            {/* ═══════════════════════════════════════════════════
                NEW PURCHASE MODAL — MULTI-ITEM
               ═══════════════════════════════════════════════════ */}
            <Modal
                isOpen={purchaseModalOpen}
                onClose={() => { setPurchaseModalOpen(false); resetPurchaseForm(); }}
                title="New Purchase"
                size="xl"
            >
                <form onSubmit={handlePurchaseSubmit} className="space-y-5">
                    {/* ── Purchase Header: Supplier, Date, Payment ── */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                        <h3 className="text-sm font-semibold text-blue-900">Purchase Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <Select label="Supplier" value={purchaseData.supplierId}
                                onChange={(e) => handlePurchaseSupplierChange(e.target.value)}
                                options={supplierOptions} />
                            <Input label="Purchase Date *" type="date" value={purchaseData.purchaseDate}
                                onChange={(e) => setPurchaseData({ ...purchaseData, purchaseDate: e.target.value })} />
                            <Select label="Payment Method" value={purchaseData.paymentMethod}
                                onChange={(e) => setPurchaseData({ ...purchaseData, paymentMethod: e.target.value })}
                                options={paymentMethodOptions} />
                        </div>
                        {purchaseData.supplierId && purchaseData.supplierGst && (
                            <div className="text-xs text-blue-800 bg-white rounded px-3 py-2 border border-blue-200">
                                <span className="font-medium">Supplier GST:</span> {purchaseData.supplierGst}
                            </div>
                        )}
                    </div>

                    {/* ── Line Items ── */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-gray-900">Purchase Items</h3>
                            <button type="button" onClick={addLineItem}
                                className="flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-800 transition-colors">
                                <Plus size={16} /> Add Item
                            </button>
                        </div>

                        <div className="space-y-3">
                            {purchaseData.items.map((item, index) => (
                                <div key={item.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs font-bold text-gray-500 bg-gray-200 rounded-full px-2.5 py-0.5">
                                            #{index + 1}
                                        </span>
                                        {purchaseData.items.length > 1 && (
                                            <button type="button" onClick={() => removeLineItem(item.id)}
                                                className="text-danger-500 hover:text-danger-700 transition-colors"
                                                title="Remove item">
                                                <MinusCircle size={18} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Row 1: Existing or New product */}
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                                        <div className="md:col-span-2">
                                            <Select label="Existing Product?"
                                                value={item.existingProductId}
                                                onChange={(e) => handleExistingProductSelect(item.id, e.target.value)}
                                                options={existingProductOptions} />
                                        </div>
                                        <Input label="Product Name *" value={item.name}
                                            onChange={(e) => updateLineItem(item.id, 'name', e.target.value)}
                                            placeholder="Product name"
                                            disabled={!!item.existingProductId} />
                                        <Input label="SKU" value={item.sku}
                                            onChange={(e) => updateLineItem(item.id, 'sku', e.target.value)}
                                            placeholder="Auto-generated"
                                            disabled={!!item.existingProductId} />
                                    </div>

                                    {/* Row 2: HSN, Qty, Price, GST */}
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                        <Input label="HSN Code" value={item.hsnCode}
                                            onChange={(e) => updateLineItem(item.id, 'hsnCode', e.target.value)}
                                            placeholder="HSN" />
                                        <Input label="Quantity *" type="number" value={item.quantity}
                                            onChange={(e) => updateLineItem(item.id, 'quantity', e.target.value)}
                                            placeholder="0" />
                                        <Input label="Unit Price *" type="number" step="0.01" value={item.purchasePrice}
                                            onChange={(e) => updateLineItem(item.id, 'purchasePrice', e.target.value)}
                                            placeholder="0.00" />
                                        <Select label="GST" value={item.gstRate}
                                            onChange={(e) => updateLineItem(item.id, 'gstRate', e.target.value)}
                                            options={gstOptions} />
                                        {/* Line Total */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Line Total</label>
                                            <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm font-bold text-emerald-700">
                                                {formatCurrency(getLineTotal(item))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Add more items button (bottom) */}
                        <button type="button" onClick={addLineItem}
                            className="mt-3 w-full py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors flex items-center justify-center gap-2">
                            <Plus size={16} /> Add Another Item
                        </button>
                    </div>

                    {/* ── Invoice Upload ── */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <Upload size={16} className="inline mr-1" />
                            Attach Invoice / Bill (Optional — shared for all items)
                        </label>
                        <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-3 text-center hover:border-primary-400 transition-colors">
                            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
                                onChange={(e) => {
                                    if (e.target.files?.[0]) {
                                        const file = e.target.files[0];
                                        if (file.size > 10 * 1024 * 1024) { toast.error('File must be under 10MB'); return; }
                                        setPurchaseData(prev => ({ ...prev, invoiceFile: file }));
                                    }
                                }}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                            {purchaseData.invoiceFile ? (
                                <div className="flex items-center justify-center gap-3">
                                    <FileText className="w-5 h-5 text-primary-600" />
                                    <span className="text-sm font-medium text-gray-900">{purchaseData.invoiceFile.name}</span>
                                    <button type="button"
                                        onClick={(e) => { e.stopPropagation(); setPurchaseData(prev => ({ ...prev, invoiceFile: null })); }}
                                        className="text-danger-500 hover:text-danger-700"><X size={16} /></button>
                                </div>
                            ) : (
                                <div>
                                    <Upload className="mx-auto h-7 w-7 text-gray-400 mb-1" />
                                    <p className="text-xs text-gray-500">PDF, JPG, PNG, WEBP — Max 10MB</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Grand Total ── */}
                    <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-4 flex justify-between items-center">
                        <div>
                            <p className="text-sm font-medium text-emerald-800">Grand Total</p>
                            <p className="text-xs text-emerald-600">{purchaseData.items.filter(i => i.name && i.quantity && i.purchasePrice).length} item(s)</p>
                        </div>
                        <p className="text-2xl font-bold text-emerald-700">{formatCurrency(getGrandTotal())}</p>
                    </div>

                    {/* ── Actions ── */}
                    <div className="flex gap-2 justify-end pt-2">
                        <Button type="button" variant="secondary" onClick={() => { setPurchaseModalOpen(false); resetPurchaseForm(); }}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="primary" disabled={saving || uploading}>
                            {saving ? 'Saving...' : uploading ? 'Uploading...' : 'Save Purchase'}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* ═══════════════════════════════════════════════════
                EDIT PRODUCT MODAL (single product)
               ═══════════════════════════════════════════════════ */}
            <Modal
                isOpen={editModalOpen}
                onClose={handleEditClose}
                title={`Edit: ${editingProduct?.name || 'Product'}`}
                size="lg"
            >
                <form onSubmit={handleEditSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Product Name *" value={editFormData.name}
                            onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                            placeholder="Product name" />
                        <Input label="SKU *" value={editFormData.sku}
                            onChange={(e) => setEditFormData({ ...editFormData, sku: e.target.value })}
                            placeholder="SKU" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="HSN Code" value={editFormData.hsnCode}
                            onChange={(e) => setEditFormData({ ...editFormData, hsnCode: e.target.value })}
                            placeholder="12345678" />
                        <Select label="GST Rate" value={editFormData.gstRate}
                            onChange={(e) => setEditFormData({ ...editFormData, gstRate: e.target.value })}
                            options={gstOptions} />
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <Select label="Supplier" value={editFormData.supplierId}
                            onChange={(e) => handleEditSupplierChange(e.target.value)}
                            options={supplierOptions} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Quantity *" type="number" value={editFormData.quantity}
                            onChange={(e) => setEditFormData({ ...editFormData, quantity: e.target.value })}
                            placeholder="0" />
                        <Input label="Low Stock Threshold" type="number" value={editFormData.lowStockThreshold}
                            onChange={(e) => setEditFormData({ ...editFormData, lowStockThreshold: e.target.value })}
                            placeholder="10" />
                    </div>
                    <Input label="Purchase Price (per unit) *" type="number" step="0.01"
                        value={editFormData.purchasePrice}
                        onChange={(e) => setEditFormData({ ...editFormData, purchasePrice: e.target.value })}
                        placeholder="0.00" />

                    {editFormData.purchasePrice && editFormData.quantity && (
                        <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg flex justify-between items-center">
                            <span className="text-sm font-medium text-emerald-800">Total Cost</span>
                            <span className="text-lg font-bold text-emerald-700">
                                {formatCurrency(parseFloat(editFormData.quantity) * parseFloat(editFormData.purchasePrice))}
                            </span>
                        </div>
                    )}

                    <div className="flex gap-2 justify-end pt-4">
                        <Button type="button" variant="secondary" onClick={handleEditClose}>Cancel</Button>
                        <Button type="submit" variant="primary">Update Product</Button>
                    </div>
                </form>
            </Modal>

            {/* ═══════════════════════════════════════════════════
                RESTOCK MODAL (quick single-item restock)
               ═══════════════════════════════════════════════════ */}
            {restockingProduct && (
                <Modal isOpen={true} onClose={handleRestockClose}
                    title={`Add Stock: ${restockingProduct.name}`} size="md">
                    <form onSubmit={handleRestockSubmit} className="space-y-4">
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm space-y-1">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Current Stock:</span>
                                <span className="font-semibold">{restockingProduct.quantity} units</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Current Avg Price:</span>
                                <span className="font-semibold">{formatCurrency(restockingProduct.purchasePrice)}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Input label="Quantity to Add *" type="number" value={restockForm.quantity}
                                onChange={(e) => setRestockForm({ ...restockForm, quantity: e.target.value })} placeholder="0" />
                            <Input label="Unit Cost *" type="number" step="0.01" value={restockForm.price}
                                onChange={(e) => setRestockForm({ ...restockForm, price: e.target.value })} placeholder="0.00" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <Input label="Purchase Date" type="date" value={restockForm.date}
                                onChange={(e) => setRestockForm({ ...restockForm, date: e.target.value })} />
                            <Select label="Payment Method" value={restockForm.paymentMethod}
                                onChange={(e) => setRestockForm({ ...restockForm, paymentMethod: e.target.value })}
                                options={paymentMethodOptions} />
                        </div>

                        {/* Invoice */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                <Upload size={14} className="inline mr-1" />Attach Invoice (Optional)
                            </label>
                            <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-3 text-center hover:border-primary-400 transition-colors">
                                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
                                    onChange={(e) => {
                                        if (e.target.files?.[0]) {
                                            const file = e.target.files[0];
                                            if (file.size > 10 * 1024 * 1024) { toast.error('File must be under 10MB'); return; }
                                            setRestockForm({ ...restockForm, invoiceFile: file });
                                        }
                                    }}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                {restockForm.invoiceFile ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <FileText className="w-4 h-4 text-primary-600" />
                                        <span className="text-sm font-medium">{restockForm.invoiceFile.name}</span>
                                        <button type="button" onClick={() => setRestockForm({ ...restockForm, invoiceFile: null })}
                                            className="text-danger-500 hover:text-danger-700"><X size={14} /></button>
                                    </div>
                                ) : <p className="text-xs text-gray-500">PDF, JPG, PNG — Max 10MB</p>}
                            </div>
                        </div>

                        {restockForm.quantity && restockForm.price && (
                            <div className="bg-blue-50 p-3 rounded-lg space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-sm text-blue-900">This Purchase:</span>
                                    <span className="font-bold text-blue-700">
                                        {formatCurrency(parseFloat(restockForm.quantity) * parseFloat(restockForm.price))}
                                    </span>
                                </div>
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
                            <Button type="button" variant="secondary" onClick={handleRestockClose}>Cancel</Button>
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
