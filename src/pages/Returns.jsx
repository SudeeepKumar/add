import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    subscribeToReturns,
    addReturn,
    deleteReturn,
    updateReturn,
} from '../services/returnService';
import { subscribeToProducts, updateProduct } from '../services/productService';
import { addTransaction, getTransactionsByReference, deleteTransaction as delTransaction } from '../services/transactionService';
import { subscribeToSales } from '../services/salesService';
import { Modal } from '../components/common/Modal';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { SearchableSelect } from '../components/common/SearchableSelect';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Plus, Trash2, Search, ArrowLeftRight, PackageX, Download } from 'lucide-react';
import { formatCurrency } from '../utils/currencyUtils';
import { format } from 'date-fns';
import { exportSalesReturnSlipPDF } from '../utils/exportUtils';
import toast from 'react-hot-toast';

export const Returns = () => {
    const { user } = useAuth();
    const [returnsList, setReturnsList] = useState([]);
    const [products, setProducts] = useState([]);
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');

    // Form state
    const [formData, setFormData] = useState({
        returnType: 'sales', // 'sales' or 'purchase'
        orderId: '',
        saleId: '', // the actual doc id in sales collection (optional)
        returnDate: format(new Date(), 'yyyy-MM-dd'),
        productId: '',
        quantity: 1,
        restockInventory: true,
        refundAmount: 0,
        returnCharges: 0, // e.g. flipkart fee or refund amount
        notes: '',
    });

    useEffect(() => {
        if (!user) return;

        const unsubReturns = subscribeToReturns(user.uid, (data) => {
            setReturnsList(data);
            setLoading(false);
        });

        const unsubProducts = subscribeToProducts(user.uid, (data) => {
            setProducts(data);
        });
        
        const unsubSales = subscribeToSales(user.uid, (data) => {
            setSales(data);
        });

        return () => {
            unsubReturns();
            unsubProducts();
            unsubSales();
        };
    }, [user]);

    // ────────────────────────────────────────
    // MIGRATE PAST RETURNS
    // ────────────────────────────────────────

    const handleMigratePastReturns = async () => {
        if (!window.confirm("This will scan all your past Sales Returns and update their transactions to the new Refund logic. Proceed?")) return;
        
        setSaving(true);
        let migratedCount = 0;
        try {
            for (const ret of returnsList) {
                // Only process sales returns that haven't been fully migrated with a refundAmount yet
                if (ret.returnType === 'sales' && !ret.refundAmount) {
                    
                    // 1. Find matching sale
                    const sale = sales.find(s => 
                        (ret.saleId && s.id === ret.saleId) || 
                        (ret.orderId && s.orderId === ret.orderId)
                    );

                    if (sale) {
                        const saleItem = sale.items?.find(i => i.productId === ret.productId) || sale.items?.[0];
                        if (saleItem) {
                            const calculatedRefund = (saleItem.sellingPrice || 0) * (ret.quantity || 1);
                            
                            // 2. Update the return document with the calculated refund amount
                            await updateReturn(ret.id, {
                                refundAmount: calculatedRefund
                            });

                            // 3. Delete old transactions associated with this return
                            const oldTxns = await getTransactionsByReference(ret.id);
                            for (const tx of oldTxns) {
                                await delTransaction(tx.id);
                            }

                            const safeReturnDate = (ret.returnDate && !isNaN(new Date(ret.returnDate).getTime())) 
                                ? new Date(ret.returnDate) 
                                : new Date();
                                
                            // 4. Create new transactions
                            if (calculatedRefund > 0) {
                                await addTransaction(user.uid, {
                                    type: 'expense',
                                    category: 'Sales Refund',
                                    amount: calculatedRefund,
                                    description: `Refund given for Sales Return ${ret.orderId} - ${ret.productName}`,
                                    date: format(safeReturnDate, 'yyyy-MM-dd'),
                                    paymentMethod: 'System',
                                    referenceId: ret.id,
                                    status: 'completed',
                                });
                            }

                            if (Number(ret.returnCharges) > 0) {
                                await addTransaction(user.uid, {
                                    type: 'expense',
                                    category: 'Liability - Return Charges',
                                    amount: Number(ret.returnCharges),
                                    description: `Liability/Penalty for Order ${ret.orderId} - ${ret.productName}`,
                                    date: format(safeReturnDate, 'yyyy-MM-dd'),
                                    paymentMethod: 'System',
                                    referenceId: ret.id,
                                    status: 'completed',
                                });
                            }

                            migratedCount++;
                        }
                    }
                }
            }
            toast.success(`Migration complete! ${migratedCount} past returns updated.`);
        } catch (error) {
            console.error("Migration error:", error);
            toast.error(`Error: ${error.message || 'Unknown error'}`);
        } finally {
            setSaving(false);
        }
    };

    // Auto-calculate refund amount based on orderId/saleId and productId
    useEffect(() => {
        if (formData.returnType === 'sales' && formData.productId && (formData.orderId || formData.saleId)) {
            // Find sale by saleId or orderId
            const sale = sales.find(s => 
                (formData.saleId && s.id === formData.saleId) || 
                (formData.orderId && s.orderId === formData.orderId)
            );
            
            if (sale) {
                const saleItem = sale.items?.find(i => i.productId === formData.productId) || sale.items?.[0];
                if (saleItem) {
                    const calculatedRefund = (saleItem.sellingPrice || 0) * (formData.quantity || 1);
                    setFormData(prev => ({
                        ...prev,
                        refundAmount: calculatedRefund
                    }));
                }
            }
        }
    }, [formData.orderId, formData.saleId, formData.productId, formData.quantity, formData.returnType, sales]);

    const resetForm = () => {
        setFormData({
            returnType: 'sales',
            orderId: '',
            saleId: '',
            returnDate: format(new Date(), 'yyyy-MM-dd'),
            productId: '',
            quantity: 1,
            restockInventory: true,
            refundAmount: 0,
            returnCharges: 0,
            notes: '',
        });
    };

    const handleCloseModal = () => {
        setModalOpen(false);
        resetForm();
    };

    const handleSave = async (e) => {
        e.preventDefault();
        
        if (!formData.orderId || !formData.productId || formData.quantity <= 0) {
            toast.error('Please provide Order ID, Product, and valid quantity');
            return;
        }

        try {
            setSaving(true);
            
            const product = products.find(p => p.id === formData.productId);
            if (!product) {
                toast.error('Selected product not found');
                return;
            }

            const returnData = {
                returnType: formData.returnType,
                orderId: formData.orderId,
                saleId: formData.saleId || null,
                returnDate: formData.returnDate,
                productId: formData.productId,
                productName: product.name,
                quantity: Number(formData.quantity),
                restockInventory: formData.restockInventory,
                refundAmount: Number(formData.refundAmount),
                returnCharges: Number(formData.returnCharges),
                notes: formData.notes,
            };

            const returnId = await addReturn(user.uid, returnData);

            // ── INVENTORY UPDATE ──
            // For PURCHASE RETURNS: always deduct stock (goods physically returned to supplier).
            // For SALES RETURNS: only add back if customer returned sellable goods (restockInventory checkbox).
            if (formData.returnType === 'purchase') {
                // Mandatory deduction — goods are leaving your warehouse
                const newQuantity = Math.max(0, product.quantity - Number(formData.quantity));
                await updateProduct(formData.productId, { quantity: newQuantity });
            } else if (formData.returnType === 'sales' && formData.restockInventory) {
                // Optional — only if goods returned in sellable condition
                const newQuantity = product.quantity + Number(formData.quantity);
                await updateProduct(formData.productId, { quantity: newQuantity });
            }

            // SALES RETURN:
            //   - refundAmount → contra-revenue (deducted from Gross Sales in Reports)
            //   - returnCharges → Extracted directly from return records in Reports.jsx
            // We NO LONGER create an explicit transaction for returnCharges here.
            // Purchase Return refund received from supplier
            if (formData.returnType === 'purchase' && Number(formData.refundAmount) > 0) {
                await addTransaction(user.uid, {
                    type: 'income',
                    category: 'Purchase Refund',
                    amount: Number(formData.refundAmount),
                    description: `Refund received from supplier for Purchase Return ${formData.orderId} - ${product.name}`,
                    date: formData.returnDate,
                    paymentMethod: 'System',
                    referenceId: returnId,
                    status: 'completed',
                });
            }

            toast.success('Return processed successfully!');
            handleCloseModal();
        } catch (error) {
            console.error('Error saving return:', error);
            toast.error('Failed to process return');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (ret) => {
        if (!window.confirm('Delete this return record? If it was restocked, the stock will NOT be automatically deducted again. Please adjust inventory manually if needed.')) {
            return;
        }

        try {
            // Find linked transactions (expenses) and delete them
            try {
                const linkedTxns = await getTransactionsByReference(ret.id);
                await Promise.all(linkedTxns.map(t => delTransaction(t.id)));
            } catch (txErr) {
                console.error('Error cleaning up transactions:', txErr);
            }

            await deleteReturn(ret.id);
            toast.success('Return deleted.');
        } catch (error) {
            console.error('Error deleting return:', error);
            toast.error('Failed to delete return');
        }
    };
    
    // Auto-fill form from selected sale order ID if user wants
    const handleOrderSelect = (sale) => {
        if (!sale) return;
        setFormData(prev => ({
            ...prev,
            orderId: sale.orderId || sale.id,
            saleId: sale.id,
        }));
    };

    const filteredReturns = returnsList
        .sort((a, b) => new Date(b.returnDate) - new Date(a.returnDate))
        .filter((r) => {
            if (!searchQuery) return true;
            return r.orderId?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                   r.productName?.toLowerCase().includes(searchQuery.toLowerCase());
        });

    if (loading) return <LoadingSpinner />;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Returns Management</h1>
                    <p className="text-gray-500 mt-1">Track returned items, restock inventory, and manage fees</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        onClick={handleMigratePastReturns}
                        variant="secondary"
                        className="flex items-center gap-2 bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-none"
                    >
                        Update Past Returns
                    </Button>
                    <Button onClick={() => setModalOpen(true)} className="flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        Add Return
                    </Button>
                </div>
            </div>

            {/* Controls */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search by Order ID or Product..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* List */}
            {filteredReturns.length === 0 ? (
                <EmptyState
                    icon={PackageX}
                    title="No returns found"
                    description="You haven't processed any returns yet."
                    action={{ label: "Add Return", onClick: () => setModalOpen(true) }}
                />
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Date</th>
                                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Type</th>
                                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Order/Bill ID</th>
                                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Product</th>
                                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Qty</th>
                                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Inv Adjusted?</th>
                                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Financials</th>
                                    <th className="px-6 py-4 text-sm font-semibold text-gray-600 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredReturns.map((ret) => (
                                    <tr key={ret.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 text-sm text-gray-900">
                                            {format(new Date(ret.returnDate), 'dd MMM, yyyy')}
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                                ret.returnType === 'sales' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                                            }`}>
                                                {ret.returnType === 'sales' ? 'Sales Return' : 'Purchase Return'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                            {ret.orderId}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {ret.productName}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {ret.quantity}
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                                ret.restockInventory ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                                {ret.restockInventory ? 'Yes' : 'No'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <div className="flex flex-col gap-1">
                                                {ret.returnType === 'sales' && ret.refundAmount > 0 && (
                                                    <span className="text-red-600 font-medium" title="Refund given to customer">
                                                        Refund: {formatCurrency(ret.refundAmount)}
                                                    </span>
                                                )}
                                                {ret.returnCharges > 0 && (
                                                    <span className={ret.returnType === 'sales' ? 'text-orange-600 font-medium' : 'text-green-600 font-medium'} title={ret.returnType === 'sales' ? "Liability/Charges" : "Refund Received"}>
                                                        {ret.returnType === 'sales' ? 'Charge: ' : 'Refund: '}
                                                        {formatCurrency(ret.returnCharges)}
                                                    </span>
                                                )}
                                                {(!ret.refundAmount && !ret.returnCharges) && (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {ret.returnType === 'sales' && (
                                                    <button
                                                        onClick={() => {
                                                            const product = products.find(p => p.id === ret.productId);
                                                            exportSalesReturnSlipPDF(ret, product, { businessName: 'BILLJI' });
                                                        }}
                                                        className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                                                        title="Download Credit Note"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleDelete(ret)}
                                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Delete Return"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal */}
            <Modal
                isOpen={modalOpen}
                onClose={handleCloseModal}
                title="Process Return"
            >
                <form onSubmit={handleSave} className="space-y-4">
                    <div className="flex gap-4 p-1 bg-gray-100 rounded-lg w-fit">
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, returnType: 'sales' })}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                                formData.returnType === 'sales' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            Sales Return (Customer → You)
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, returnType: 'purchase' })}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                                formData.returnType === 'purchase' ? 'bg-white text-orange-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            Purchase Return (You → Supplier)
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                            label="Return Date"
                            type="date"
                            value={formData.returnDate}
                            onChange={(e) => setFormData({ ...formData, returnDate: e.target.value })}
                            required
                        />
                        <Input
                            label={formData.returnType === 'sales' ? "Order ID" : "Purchase/Bill ID"}
                            placeholder={formData.returnType === 'sales' ? "e.g. FLP-12345" : "e.g. BILL-999"}
                            value={formData.orderId}
                            onChange={(e) => setFormData({ ...formData, orderId: e.target.value })}
                            required
                        />
                    </div>

                    {formData.returnType === 'sales' && (
                        <div className="space-y-1">
                            <label className="block text-sm font-medium text-gray-700">Optional: Link to Sale</label>
                            <SearchableSelect
                                options={sales.map(s => ({
                                    value: s.id,
                                    label: `${s.orderId || s.id} - ${s.customerName} (${format(new Date(s.saleDate), 'dd MMM')})`
                                }))}
                                value={formData.saleId}
                                onChange={(val) => {
                                    const sale = sales.find(s => s.id === val);
                                    handleOrderSelect(sale);
                                }}
                                placeholder="Select sale to autofill Order ID"
                            />
                        </div>
                    )}

                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">Product Returned *</label>
                        <SearchableSelect
                            options={products.map(p => ({
                                value: p.id,
                                label: p.name
                            }))}
                            value={formData.productId}
                            onChange={(val) => setFormData({ ...formData, productId: val })}
                            placeholder="Select Product"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <Input
                            label="Quantity"
                            type="number"
                            min="1"
                            value={formData.quantity}
                            onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                            required
                        />
                        {formData.returnType === 'sales' && (
                            <div className="space-y-1">
                                <label className="block text-sm font-medium text-gray-700">Customer Refund Amount (₹)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="Auto-calculated"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 focus:outline-none"
                                    value={formData.refundAmount}
                                    readOnly
                                    title="Auto-calculated based on original sale price"
                                />
                                <p className="text-xs text-gray-500">Auto-filled from Order ID</p>
                            </div>
                        )}
                        <Input
                            label={formData.returnType === 'sales' ? "Return Charges / Penalty (₹)" : "Refund Amount Received (₹)"}
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="e.g. 50"
                            value={formData.returnCharges}
                            onChange={(e) => setFormData({ ...formData, returnCharges: Number(e.target.value) })}
                        />
                    </div>

                    <div className={`flex items-center gap-3 p-4 rounded-lg border ${
                        formData.returnType === 'sales' ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100'
                    }`}>
                        <input
                            type="checkbox"
                            id="restockInventory"
                            className={`w-4 h-4 rounded border-gray-300 focus:ring-primary-500 ${
                                formData.returnType === 'sales' ? 'text-blue-600' : 'text-orange-600'
                            }`}
                            checked={formData.restockInventory}
                            onChange={(e) => setFormData({ ...formData, restockInventory: e.target.checked })}
                        />
                        <label htmlFor="restockInventory" className={`text-sm font-medium cursor-pointer ${
                            formData.returnType === 'sales' ? 'text-blue-900' : 'text-orange-900'
                        }`}>
                            {formData.returnType === 'sales' 
                                ? `Restock Inventory (Adds ${formData.quantity || 0} back to stock)`
                                : `Deduct Inventory (Removes ${formData.quantity || 0} from stock)`}
                        </label>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <Button type="button" variant="secondary" onClick={handleCloseModal}>
                            Cancel
                        </Button>
                        <Button type="submit" loading={saving}>
                            Process Return
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
