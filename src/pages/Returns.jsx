import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    subscribeToReturns,
    addReturn,
    deleteReturn,
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
import { Plus, Trash2, Search, ArrowLeftRight, PackageX } from 'lucide-react';
import { formatCurrency } from '../utils/currencyUtils';
import { format } from 'date-fns';
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

    const resetForm = () => {
        setFormData({
            returnType: 'sales',
            orderId: '',
            saleId: '',
            returnDate: format(new Date(), 'yyyy-MM-dd'),
            productId: '',
            quantity: 1,
            restockInventory: true,
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
                returnCharges: Number(formData.returnCharges),
                notes: formData.notes,
            };

            const returnId = await addReturn(user.uid, returnData);

            // Update Inventory if checked
            if (formData.restockInventory) {
                let newQuantity = product.quantity;
                if (formData.returnType === 'sales') {
                    newQuantity += Number(formData.quantity);
                } else {
                    // Purchase return means stock is sent back, so deduct
                    newQuantity = Math.max(0, newQuantity - Number(formData.quantity));
                }
                
                await updateProduct(formData.productId, {
                    quantity: newQuantity
                });
            }

            // Record financial transaction if there are charges/refunds
            if (Number(formData.returnCharges) > 0) {
                const txType = formData.returnType === 'sales' ? 'expense' : 'income';
                const txCategory = formData.returnType === 'sales' ? 'return charges' : 'Purchase Refund';
                const txDesc = formData.returnType === 'sales' 
                    ? `Return charges for Order ${formData.orderId} - ${product.name}`
                    : `Refund received for Purchase Return ${formData.orderId} - ${product.name}`;

                await addTransaction(user.uid, {
                    type: txType,
                    category: txCategory,
                    amount: Number(formData.returnCharges),
                    description: txDesc,
                    date: formData.returnDate,
                    paymentMethod: 'Bank Transfer',
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Returns Management</h1>
                    <p className="text-gray-500 mt-1">Track returned items, restock inventory, and manage fees</p>
                </div>
                <Button onClick={() => setModalOpen(true)} className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Add Return
                </Button>
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
                                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Charges/Refund</th>
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
                                        <td className="px-6 py-4 text-sm font-medium">
                                            <span className={ret.returnCharges > 0 ? (ret.returnType === 'sales' ? 'text-red-600' : 'text-green-600') : 'text-gray-400'}>
                                                {ret.returnCharges > 0 ? formatCurrency(ret.returnCharges) : '-'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleDelete(ret)}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Delete Return"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                            label="Quantity"
                            type="number"
                            min="1"
                            value={formData.quantity}
                            onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                            required
                        />
                        <Input
                            label={formData.returnType === 'sales' ? "Return Charges / Penalty (₹)" : "Refund Amount Received (₹)"}
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="e.g. 150"
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
