import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    subscribeToSales,
    addSale,
    updateSale,
    deleteSale,
} from '../services/salesService';
import { subscribeToProducts, updateProduct } from '../services/productService';
import { addTransaction, getTransactionsByReference, deleteTransaction as delTransaction } from '../services/transactionService';
import { Modal } from '../components/common/Modal';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { SearchableSelect } from '../components/common/SearchableSelect';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import {
    Plus, Pencil, Trash2, ShoppingBag, Search, Filter, Calendar,
    TrendingUp, IndianRupee, BarChart3, MinusCircle, Eye,
} from 'lucide-react';
import { formatCurrency } from '../utils/currencyUtils';
import { SALES_PLATFORMS, SALE_STATUSES, PAYMENT_METHODS } from '../utils/constants';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

// Blank line item for sale
const createEmptySaleItem = () => ({
    id: Date.now() + Math.random(),
    productId: '',
    productName: '',
    quantity: '',
    sellingPrice: '',
    purchasePrice: 0, // WAC cost, auto-filled
    availableStock: 0,
});

export const Sales = () => {
    const { user } = useAuth();
    const [sales, setSales] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [viewingSale, setViewingSale] = useState(null);
    const [editingSale, setEditingSale] = useState(null);
    const [saving, setSaving] = useState(false);

    // Filters
    const [filterPlatform, setFilterPlatform] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // Form state
    const [formData, setFormData] = useState({
        platform: 'Flipkart',
        customerName: '',
        orderId: '',
        saleDate: format(new Date(), 'yyyy-MM-dd'),
        paymentMethod: 'UPI',
        status: 'completed',
        notes: '',
        items: [createEmptySaleItem()],
    });

    useEffect(() => {
        if (!user) return;

        const unsubSales = subscribeToSales(user.uid, (data) => {
            setSales(data);
            setLoading(false);
        });

        const unsubProducts = subscribeToProducts(user.uid, (data) => {
            setProducts(data);
        });

        return () => {
            unsubSales();
            unsubProducts();
        };
    }, [user]);

    // ────────────────────────────────────────
    // FORM HELPERS
    // ────────────────────────────────────────

    const resetForm = () => {
        setFormData({
            platform: 'Flipkart',
            customerName: '',
            orderId: '',
            saleDate: format(new Date(), 'yyyy-MM-dd'),
            paymentMethod: 'UPI',
            status: 'completed',
            notes: '',
            items: [createEmptySaleItem()],
        });
        setEditingSale(null);
    };

    const handleOpenModal = (sale = null) => {
        if (sale) {
            setEditingSale(sale);
            setFormData({
                platform: sale.platform,
                customerName: sale.customerName || '',
                orderId: sale.orderId || '',
                saleDate: format(sale.saleDate, 'yyyy-MM-dd'),
                paymentMethod: sale.paymentMethod || 'UPI',
                status: sale.status || 'completed',
                notes: sale.notes || '',
                items: sale.items.map(item => ({
                    id: Date.now() + Math.random(),
                    productId: item.productId,
                    productName: item.productName,
                    quantity: item.quantity.toString(),
                    sellingPrice: item.sellingPrice.toString(),
                    purchasePrice: item.purchasePrice || 0,
                    availableStock: (products.find(p => p.id === item.productId)?.quantity || 0) + item.quantity,
                })),
            });
        } else {
            resetForm();
        }
        setModalOpen(true);
    };

    const handleCloseModal = () => {
        setModalOpen(false);
        resetForm();
    };

    const handleProductSelect = (itemId, productId) => {
        if (!productId) {
            setFormData(prev => ({
                ...prev,
                items: prev.items.map(item =>
                    item.id === itemId ? {
                        ...item,
                        productId: '',
                        productName: '',
                        sellingPrice: '',
                        purchasePrice: 0,
                        availableStock: 0,
                    } : item
                ),
            }));
            return;
        }

        const product = products.find(p => p.id === productId);
        if (product) {
            setFormData(prev => ({
                ...prev,
                items: prev.items.map(item =>
                    item.id === itemId ? {
                        ...item,
                        productId: product.id,
                        productName: product.name,
                        sellingPrice: product.sellingPrice?.toString() || '',
                        purchasePrice: product.purchasePrice || 0,
                        availableStock: product.quantity || 0,
                    } : item
                ),
            }));
        }
    };

    const updateLineItem = (itemId, field, value) => {
        setFormData(prev => ({
            ...prev,
            items: prev.items.map(item =>
                item.id === itemId ? { ...item, [field]: value } : item
            ),
        }));
    };

    const addLineItem = () => {
        setFormData(prev => ({
            ...prev,
            items: [...prev.items, createEmptySaleItem()],
        }));
    };

    const removeLineItem = (itemId) => {
        setFormData(prev => ({
            ...prev,
            items: prev.items.filter(item => item.id !== itemId),
        }));
    };

    const getLineRevenue = (item) => {
        const qty = parseFloat(item.quantity) || 0;
        const price = parseFloat(item.sellingPrice) || 0;
        return qty * price;
    };

    const getLineCost = (item) => {
        const qty = parseFloat(item.quantity) || 0;
        return qty * (item.purchasePrice || 0);
    };

    const getLineProfit = (item) => getLineRevenue(item) - getLineCost(item);

    const getGrandTotals = () => {
        const revenue = formData.items.reduce((sum, item) => sum + getLineRevenue(item), 0);
        const cost = formData.items.reduce((sum, item) => sum + getLineCost(item), 0);
        return { revenue, cost, profit: revenue - cost };
    };

    // ────────────────────────────────────────
    // SUBMIT SALE
    // ────────────────────────────────────────

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate items
        const validItems = formData.items.filter(
            item => item.productId && item.quantity && item.sellingPrice
        );
        if (validItems.length === 0) {
            toast.error('Please add at least one item with product, quantity, and price');
            return;
        }

        // Check stock availability
        for (const item of validItems) {
            const qty = parseInt(item.quantity);
            const available = item.availableStock;
            if (!editingSale && qty > available) {
                toast.error(`Not enough stock for "${item.productName}". Available: ${available}, Requested: ${qty}`);
                return;
            }
        }

        setSaving(true);
        try {
            const saleDate = new Date(formData.saleDate);

            const saleItems = validItems.map(item => ({
                productId: item.productId,
                productName: item.productName,
                quantity: parseInt(item.quantity),
                sellingPrice: parseFloat(item.sellingPrice),
                purchasePrice: item.purchasePrice || 0,
                profit: (parseFloat(item.sellingPrice) - (item.purchasePrice || 0)) * parseInt(item.quantity),
            }));

            const totalRevenue = saleItems.reduce((sum, i) => sum + (i.sellingPrice * i.quantity), 0);
            const totalCost = saleItems.reduce((sum, i) => sum + (i.purchasePrice * i.quantity), 0);
            const totalProfit = totalRevenue - totalCost;

            const saleData = {
                platform: formData.platform,
                customerName: formData.customerName,
                orderId: formData.orderId,
                saleDate: saleDate,
                paymentMethod: formData.paymentMethod,
                status: formData.status,
                notes: formData.notes,
                items: saleItems,
                productIds: saleItems.map(i => i.productId), // for array-contains queries
                totalRevenue,
                totalCost,
                totalProfit,
            };

            if (editingSale) {
                // ── UPDATE EXISTING SALE ──
                // Reverse old stock deductions
                for (const oldItem of editingSale.items) {
                    const product = products.find(p => p.id === oldItem.productId);
                    if (product) {
                        await updateProduct(oldItem.productId, {
                            quantity: product.quantity + oldItem.quantity,
                        });
                    }
                }

                // Apply new stock deductions
                for (const newItem of saleItems) {
                    const product = products.find(p => p.id === newItem.productId);
                    if (product) {
                        const restoredQty = product.quantity + (editingSale.items.find(i => i.productId === newItem.productId)?.quantity || 0);
                        await updateProduct(newItem.productId, {
                            quantity: restoredQty - newItem.quantity,
                        });
                    }
                }

                await updateSale(editingSale.id, saleData);

                // Update linked income transaction
                try {
                    const linkedTxns = await getTransactionsByReference(editingSale.id);
                    const incomeTxn = linkedTxns.find(t => t.type === 'income');
                    if (incomeTxn) {
                        const { updateTransaction } = await import('../services/transactionService');
                        await updateTransaction(incomeTxn.id, {
                            amount: totalRevenue,
                            description: `Sale: ${saleItems.map(i => `${i.productName} ×${i.quantity}`).join(', ')} [${formData.platform}]`,
                            date: saleDate,
                            paymentMethod: formData.paymentMethod,
                        });
                    }
                } catch (syncErr) {
                    console.error('Transaction sync error:', syncErr);
                }

                toast.success('Sale updated successfully');
            } else {
                // ── CREATE NEW SALE ──
                const saleId = await addSale(user.uid, saleData);

                // Deduct stock from each product
                for (const item of saleItems) {
                    const product = products.find(p => p.id === item.productId);
                    if (product) {
                        await updateProduct(item.productId, {
                            quantity: Math.max(0, product.quantity - item.quantity),
                        });
                    }
                }

                // Auto-create income transaction
                if (formData.status !== 'cancelled') {
                    await addTransaction(user.uid, {
                        type: 'income',
                        category: 'Product Sales',
                        amount: totalRevenue,
                        description: `Sale: ${saleItems.map(i => `${i.productName} ×${i.quantity}`).join(', ')} [${formData.platform}]`,
                        date: saleDate,
                        paymentMethod: formData.paymentMethod,
                        referenceId: saleId,
                        status: 'completed',
                    });
                }

                toast.success(`Sale recorded! ${saleItems.length} item${saleItems.length > 1 ? 's' : ''} sold.`);
            }

            handleCloseModal();
        } catch (error) {
            console.error('Error saving sale:', error);
            toast.error('Failed to save sale');
        } finally {
            setSaving(false);
        }
    };

    // ────────────────────────────────────────
    // DELETE SALE
    // ────────────────────────────────────────

    const handleDelete = async (sale) => {
        if (!window.confirm(`Delete this sale? Stock will be restored for ${sale.items.length} item(s).`)) {
            return;
        }

        try {
            // Restore stock for each product
            for (const item of sale.items) {
                const product = products.find(p => p.id === item.productId);
                if (product) {
                    await updateProduct(item.productId, {
                        quantity: product.quantity + item.quantity,
                    });
                }
            }

            // Delete linked transactions
            try {
                const linkedTxns = await getTransactionsByReference(sale.id);
                await Promise.all(linkedTxns.map(t => delTransaction(t.id)));
            } catch (txErr) {
                console.error('Error cleaning up transactions:', txErr);
            }

            await deleteSale(sale.id);
            toast.success('Sale deleted. Stock restored.');
        } catch (error) {
            console.error('Error deleting sale:', error);
            toast.error('Failed to delete sale');
        }
    };

    // ────────────────────────────────────────
    // VIEW DETAIL
    // ────────────────────────────────────────

    const handleViewDetail = (sale) => {
        setViewingSale(sale);
        setDetailModalOpen(true);
    };

    // ────────────────────────────────────────
    // FILTER SALES
    // ────────────────────────────────────────

    const filteredSales = sales
        .sort((a, b) => new Date(b.saleDate) - new Date(a.saleDate))
        .filter((s) => {
            const matchesPlatform = filterPlatform === 'all' || s.platform === filterPlatform;
            const matchesStatus = filterStatus === 'all' || s.status === filterStatus;
            const matchesSearch = !searchQuery ||
                s.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.orderId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.items?.some(i => i.productName.toLowerCase().includes(searchQuery.toLowerCase()));

            let matchesDate = true;
            if (dateFrom || dateTo) {
                const sDate = new Date(s.saleDate);
                if (dateFrom) matchesDate = sDate >= new Date(dateFrom);
                if (dateTo && matchesDate) {
                    const end = new Date(dateTo);
                    end.setHours(23, 59, 59, 999);
                    matchesDate = sDate <= end;
                }
            }

            return matchesPlatform && matchesStatus && matchesSearch && matchesDate;
        });

    // Summary stats for filtered view
    const totalRevenue = filteredSales.reduce((sum, s) => sum + (s.totalRevenue || 0), 0);
    const totalCost = filteredSales.reduce((sum, s) => sum + (s.totalCost || 0), 0);
    const totalProfit = filteredSales.reduce((sum, s) => sum + (s.totalProfit || 0), 0);
    const totalSalesCount = filteredSales.length;

    const productOptions = products
        .filter(p => p.quantity > 0)
        .map(p => ({
            value: p.id,
            label: `${p.name} (Stock: ${p.quantity})`,
        }));

    const paymentMethodOptions = [
        { value: '', label: 'Select Payment Method' },
        ...PAYMENT_METHODS.map(m => ({ value: m, label: m })),
    ];

    const platformOptions = [
        { value: '', label: 'Select Platform' },
        ...SALES_PLATFORMS.map(p => ({ value: p, label: p })),
    ];

    const statusOptions = SALE_STATUSES;

    // Platform badge colors
    const platformColor = (platform) => {
        const map = {
            'Flipkart': 'bg-yellow-100 text-yellow-800',
            'Amazon': 'bg-orange-100 text-orange-800',
            'Meesho': 'bg-pink-100 text-pink-800',
            'Myntra': 'bg-purple-100 text-purple-800',
            'JioMart': 'bg-blue-100 text-blue-800',
            'Website / Direct': 'bg-cyan-100 text-cyan-800',
            'Offline / Walk-in': 'bg-gray-100 text-gray-800',
        };
        return map[platform] || 'bg-gray-100 text-gray-800';
    };

    const statusColor = (status) => {
        const map = {
            'completed': 'bg-success-100 text-success-800',
            'pending': 'bg-orange-100 text-orange-800',
            'shipped': 'bg-blue-100 text-blue-800',
            'returned': 'bg-danger-100 text-danger-800',
            'cancelled': 'bg-gray-100 text-gray-600',
        };
        return map[status] || 'bg-gray-100 text-gray-800';
    };

    // ────────────────────────────────────────
    // RENDER
    // ────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Sales</h1>
                    <p className="text-gray-600 mt-1">
                        Track your Flipkart, Amazon & ecommerce sales
                    </p>
                </div>
                <Button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2"
                >
                    <Plus size={20} />
                    Record Sale
                </Button>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <ShoppingBag size={16} className="text-primary-600" />
                        <span className="text-xs font-medium text-gray-500 uppercase">Total Sales</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{totalSalesCount}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <IndianRupee size={16} className="text-success-600" />
                        <span className="text-xs font-medium text-gray-500 uppercase">Revenue</span>
                    </div>
                    <p className="text-2xl font-bold text-success-600">{formatCurrency(totalRevenue)}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <BarChart3 size={16} className="text-gray-500" />
                        <span className="text-xs font-medium text-gray-500 uppercase">Cost</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-700">{formatCurrency(totalCost)}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingUp size={16} className={totalProfit >= 0 ? 'text-success-600' : 'text-danger-600'} />
                        <span className="text-xs font-medium text-gray-500 uppercase">Profit</span>
                    </div>
                    <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                        {formatCurrency(totalProfit)}
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    {/* Platform Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <Filter size={16} className="inline mr-1" />
                            Platform
                        </label>
                        <div className="flex flex-wrap gap-1">
                            <button
                                onClick={() => setFilterPlatform('all')}
                                className={`px-2 py-1 rounded-lg font-medium transition-all text-xs ${filterPlatform === 'all'
                                    ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                All
                            </button>
                            {SALES_PLATFORMS.slice(0, 4).map(p => (
                                <button
                                    key={p}
                                    onClick={() => setFilterPlatform(p)}
                                    className={`px-2 py-1 rounded-lg font-medium transition-all text-xs ${filterPlatform === p
                                        ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Status Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                        <div className="flex flex-wrap gap-1">
                            <button
                                onClick={() => setFilterStatus('all')}
                                className={`px-2 py-1 rounded-lg font-medium transition-all text-xs ${filterStatus === 'all'
                                    ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                All
                            </button>
                            {SALE_STATUSES.slice(0, 3).map(s => (
                                <button
                                    key={s.value}
                                    onClick={() => setFilterStatus(s.value)}
                                    className={`px-2 py-1 rounded-lg font-medium transition-all text-xs ${filterStatus === s.value
                                        ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    {s.label}
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
                            placeholder="Customer, order ID, product..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Date From */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <Calendar size={16} className="inline mr-1" />
                            From
                        </label>
                        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                    </div>

                    {/* Date To */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <Calendar size={16} className="inline mr-1" />
                            To
                        </label>
                        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                    </div>
                </div>

                {(dateFrom || dateTo || filterPlatform !== 'all' || filterStatus !== 'all' || searchQuery) && (
                    <div className="mt-3">
                        <button
                            onClick={() => {
                                setDateFrom(''); setDateTo('');
                                setFilterPlatform('all'); setFilterStatus('all');
                                setSearchQuery('');
                            }}
                            className="text-sm text-primary-600 hover:text-primary-800 underline"
                        >
                            Clear all filters
                        </button>
                    </div>
                )}
            </div>

            {/* Sales Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                {filteredSales.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Platform</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer / Order</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Products</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Profit</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {filteredSales.map((sale) => (
                                    <tr key={sale.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {format(sale.saleDate, 'MMM dd, yyyy')}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${platformColor(sale.platform)}`}>
                                                {sale.platform}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                                            <div className="text-gray-900 font-medium">
                                                {sale.customerName || '—'}
                                            </div>
                                            {sale.orderId && (
                                                <div className="text-gray-500 text-xs">#{sale.orderId}</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 text-sm text-gray-700 max-w-[200px]">
                                            <div className="truncate">
                                                {sale.items?.map(i => `${i.productName} ×${i.quantity}`).join(', ')}
                                            </div>
                                            <div className="text-xs text-gray-400">
                                                {sale.items?.length || 0} item{(sale.items?.length || 0) > 1 ? 's' : ''}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-success-600">
                                            {formatCurrency(sale.totalRevenue || 0)}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold">
                                            <span className={sale.totalProfit >= 0 ? 'text-success-600' : 'text-danger-600'}>
                                                {formatCurrency(sale.totalProfit || 0)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColor(sale.status)}`}>
                                                {sale.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => handleViewDetail(sale)}
                                                className="text-gray-500 hover:text-gray-700 mr-2"
                                                title="View Details"
                                            >
                                                <Eye size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleOpenModal(sale)}
                                                className="text-primary-600 hover:text-primary-900 mr-2"
                                                title="Edit"
                                            >
                                                <Pencil size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(sale)}
                                                className="text-danger-600 hover:text-danger-900"
                                                title="Delete"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState
                        icon={ShoppingBag}
                        title="No sales recorded yet"
                        description="Start recording your Flipkart, Amazon & ecommerce sales to track revenue and profit"
                        action={() => handleOpenModal()}
                        actionLabel="Record Sale"
                    />
                )}
            </div>

            {/* ═══════════════════════════════════════════════════
                RECORD / EDIT SALE MODAL
               ═══════════════════════════════════════════════════ */}
            <Modal
                isOpen={modalOpen}
                onClose={handleCloseModal}
                title={editingSale ? 'Edit Sale' : 'Record Sale'}
                size="xl"
            >
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Sale Header */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                        <h3 className="text-sm font-semibold text-green-900">Sale Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <Select
                                label="Platform *"
                                value={formData.platform}
                                onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                                options={platformOptions}
                            />
                            <Input
                                label="Sale Date *"
                                type="date"
                                value={formData.saleDate}
                                onChange={(e) => setFormData({ ...formData, saleDate: e.target.value })}
                            />
                            <Select
                                label="Payment Method"
                                value={formData.paymentMethod}
                                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                                options={paymentMethodOptions}
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <Input
                                label="Customer Name"
                                value={formData.customerName}
                                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                                placeholder="e.g. Flipkart Customer"
                            />
                            <Input
                                label="Order / Reference ID"
                                value={formData.orderId}
                                onChange={(e) => setFormData({ ...formData, orderId: e.target.value })}
                                placeholder="e.g. OD12345678"
                            />
                            <Select
                                label="Status"
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                options={statusOptions}
                            />
                        </div>
                    </div>

                    {/* Line Items */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-gray-900">Products Sold</h3>
                            <button
                                type="button"
                                onClick={addLineItem}
                                className="flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-800 transition-colors"
                            >
                                <Plus size={16} /> Add Product
                            </button>
                        </div>

                        <div className="space-y-3">
                            {formData.items.map((item, idx) => (
                                <div
                                    key={item.id}
                                    className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-gray-500">
                                            Item #{idx + 1}
                                        </span>
                                        {formData.items.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeLineItem(item.id)}
                                                className="text-danger-500 hover:text-danger-700 p-1"
                                            >
                                                <MinusCircle size={16} />
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                                        {/* Product picker */}
                                        <div className="md:col-span-5">
                                            <SearchableSelect
                                                label="Product"
                                                value={item.productId}
                                                onChange={(value) => handleProductSelect(item.id, value)}
                                                options={productOptions}
                                                placeholder="Search product..."
                                            />
                                        </div>

                                        {/* Quantity */}
                                        <div className="md:col-span-2">
                                            <Input
                                                label="Qty"
                                                type="number"
                                                min="1"
                                                max={item.availableStock || 9999}
                                                value={item.quantity}
                                                onChange={(e) => updateLineItem(item.id, 'quantity', e.target.value)}
                                                placeholder="0"
                                            />
                                            {item.productId && (
                                                <span className="text-xs text-gray-400">
                                                    Avail: {item.availableStock}
                                                </span>
                                            )}
                                        </div>

                                        {/* Selling Price */}
                                        <div className="md:col-span-2">
                                            <Input
                                                label="Sell Price"
                                                type="number"
                                                step="0.01"
                                                value={item.sellingPrice}
                                                onChange={(e) => updateLineItem(item.id, 'sellingPrice', e.target.value)}
                                                placeholder="0.00"
                                            />
                                        </div>

                                        {/* Calculated Profit */}
                                        <div className="md:col-span-3">
                                            <div className="text-xs text-gray-500 mb-1">Summary</div>
                                            <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs space-y-1">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">Revenue:</span>
                                                    <span className="font-medium">{formatCurrency(getLineRevenue(item))}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">Cost:</span>
                                                    <span className="text-gray-600">{formatCurrency(getLineCost(item))}</span>
                                                </div>
                                                <div className="flex justify-between border-t pt-1">
                                                    <span className="text-gray-500">Profit:</span>
                                                    <span className={`font-bold ${getLineProfit(item) >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                                                        {formatCurrency(getLineProfit(item))}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="label">Notes</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Optional notes about this sale"
                            className="input min-h-[60px]"
                        />
                    </div>

                    {/* Grand Total */}
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                        {(() => {
                            const totals = getGrandTotals();
                            return (
                                <>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Total Revenue:</span>
                                        <span className="font-semibold text-success-600">
                                            {formatCurrency(totals.revenue)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Total Cost (WAC):</span>
                                        <span className="font-medium text-gray-700">
                                            {formatCurrency(totals.cost)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-lg font-bold border-t pt-2">
                                        <span>Profit:</span>
                                        <span className={totals.profit >= 0 ? 'text-success-600' : 'text-danger-600'}>
                                            {formatCurrency(totals.profit)}
                                        </span>
                                    </div>
                                </>
                            );
                        })()}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 justify-end pt-2">
                        <Button type="button" variant="secondary" onClick={handleCloseModal}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="primary" disabled={saving}>
                            {saving ? 'Saving...' : (editingSale ? 'Update Sale' : 'Record Sale')}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* ═══════════════════════════════════════════════════
                SALE DETAIL MODAL
               ═══════════════════════════════════════════════════ */}
            <Modal
                isOpen={detailModalOpen}
                onClose={() => { setDetailModalOpen(false); setViewingSale(null); }}
                title="Sale Details"
                size="lg"
            >
                {viewingSale && (
                    <div className="space-y-4">
                        {/* Sale Info */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div>
                                <span className="text-xs text-gray-500 uppercase">Platform</span>
                                <p className="font-medium mt-1">
                                    <span className={`px-2 py-1 text-xs rounded-full ${platformColor(viewingSale.platform)}`}>
                                        {viewingSale.platform}
                                    </span>
                                </p>
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 uppercase">Date</span>
                                <p className="font-medium mt-1">{format(viewingSale.saleDate, 'MMM dd, yyyy')}</p>
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 uppercase">Status</span>
                                <p className="mt-1">
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColor(viewingSale.status)}`}>
                                        {viewingSale.status}
                                    </span>
                                </p>
                            </div>
                            {viewingSale.customerName && (
                                <div>
                                    <span className="text-xs text-gray-500 uppercase">Customer</span>
                                    <p className="font-medium mt-1">{viewingSale.customerName}</p>
                                </div>
                            )}
                            {viewingSale.orderId && (
                                <div>
                                    <span className="text-xs text-gray-500 uppercase">Order ID</span>
                                    <p className="font-medium mt-1">#{viewingSale.orderId}</p>
                                </div>
                            )}
                            <div>
                                <span className="text-xs text-gray-500 uppercase">Payment</span>
                                <p className="font-medium mt-1">{viewingSale.paymentMethod || '—'}</p>
                            </div>
                        </div>

                        {/* Items Table */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-2">Products Sold</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Product</th>
                                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Qty</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Sell Price</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Cost</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Profit</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {viewingSale.items.map((item, idx) => (
                                            <tr key={idx}>
                                                <td className="px-3 py-2 font-medium">{item.productName}</td>
                                                <td className="px-3 py-2 text-center">{item.quantity}</td>
                                                <td className="px-3 py-2 text-right">{formatCurrency(item.sellingPrice)}</td>
                                                <td className="px-3 py-2 text-right text-gray-500">{formatCurrency(item.purchasePrice)}</td>
                                                <td className={`px-3 py-2 text-right font-semibold ${item.profit >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                                                    {formatCurrency(item.profit)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Totals */}
                        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Total Revenue:</span>
                                <span className="font-semibold text-success-600">{formatCurrency(viewingSale.totalRevenue)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Total Cost:</span>
                                <span className="font-medium text-gray-700">{formatCurrency(viewingSale.totalCost)}</span>
                            </div>
                            <div className="flex justify-between text-lg font-bold border-t pt-2">
                                <span>Profit:</span>
                                <span className={viewingSale.totalProfit >= 0 ? 'text-success-600' : 'text-danger-600'}>
                                    {formatCurrency(viewingSale.totalProfit)}
                                </span>
                            </div>
                        </div>

                        {viewingSale.notes && (
                            <div>
                                <span className="text-xs text-gray-500 uppercase">Notes</span>
                                <p className="text-sm text-gray-700 mt-1">{viewingSale.notes}</p>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
};
