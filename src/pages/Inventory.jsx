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
import { Plus, Pencil, Trash2, Package, Search, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../utils/currencyUtils';
import { calculateProfitMargin } from '../utils/taxCalculations';
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
    const [restockForm, setRestockForm] = useState({ quantity: '', price: '' });

    const [formData, setFormData] = useState({
        name: '',
        sku: '',
        hsnCode: '',
        quantity: '',
        purchasePrice: '',
        sellingPrice: '',
        gstRate: '18',
        supplierId: '',
        supplierName: '',
        supplierGst: '',
        lowStockThreshold: '10',
    });

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
            sellingPrice: '',
            gstRate: '18',
            supplierId: '',
            supplierName: '',
            supplierGst: '',
            lowStockThreshold: '10',
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
                sellingPrice: product.sellingPrice.toString(),
                gstRate: product.gstRate?.toString() || '18',
                supplierId: product.supplierId || '',
                supplierName: product.supplierName || '',
                supplierGst: product.supplierGst || '',
                lowStockThreshold: product.lowStockThreshold?.toString() || '10',
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

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name || !formData.sku || !formData.quantity || !formData.purchasePrice || !formData.sellingPrice) {
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

            const productData = {
                name: formData.name,
                sku: formData.sku,
                hsnCode: formData.hsnCode,
                quantity: parseInt(formData.quantity),
                purchasePrice: parseFloat(formData.purchasePrice),
                sellingPrice: parseFloat(formData.sellingPrice),
                gstRate: parseFloat(formData.gstRate),
                supplierId: formData.supplierId,
                supplierName: formData.supplierName,
                supplierGst: formData.supplierGst,
                lowStockThreshold: parseInt(formData.lowStockThreshold),
            };

            let productId;
            if (editingProduct) {
                await updateProduct(editingProduct.id, productData);
                productId = editingProduct.id;
                toast.success('Product updated successfully');

                // Check for stock increase
                const oldQuantity = editingProduct.quantity || 0;
                const newQuantity = productData.quantity;
                if (newQuantity > oldQuantity) {
                    const diff = newQuantity - oldQuantity;
                    const cost = diff * productData.purchasePrice;

                    // Add Expense Transaction
                    const { addTransaction } = await import('../services/transactionService');
                    await addTransaction(user.uid, {
                        type: 'expense',
                        category: 'Purchase',
                        amount: cost,
                        description: `Stock Review/Update: ${productData.name} (+${diff})`,
                        date: new Date(),
                        paymentMethod: 'Cash', // Defaulting to Cash or could be 'Credit' if supplier logic was complex
                        referenceId: productId,
                        status: 'completed'
                    });
                }

            } else {
                productId = await addProduct(user.uid, productData);
                toast.success('Product added successfully');

                // Initial Stock Purchase
                if (productData.quantity > 0) {
                    const cost = productData.quantity * productData.purchasePrice;
                    const { addTransaction } = await import('../services/transactionService');
                    await addTransaction(user.uid, {
                        type: 'expense',
                        category: 'Purchase',
                        amount: cost,
                        description: `Initial Stock: ${productData.name} (+${productData.quantity})`,
                        date: new Date(),
                        paymentMethod: 'Cash',
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
        setRestockForm({ quantity: '', price: product.purchasePrice.toString() });
    };

    const handleRestockClose = () => {
        setRestockingProduct(null);
        setRestockForm({ quantity: '', price: '' });
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
            const newQty = (restockingProduct.quantity || 0) + qty;
            await updateProduct(restockingProduct.id, {
                quantity: newQty,
                purchasePrice: price
            });

            const { addTransaction } = await import('../services/transactionService');
            await addTransaction(user.uid, {
                type: 'expense',
                category: 'Purchase',
                amount: qty * price,
                description: `Restock: ${restockingProduct.name} (+${qty})`,
                date: new Date(),
                paymentMethod: 'Cash',
                referenceId: restockingProduct.id,
                status: 'completed'
            });

            toast.success('Stock added successfully');
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

            return matchesSearch && matchesStatus;
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Status Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Stock Status</label>
                        <div className="flex flex-wrap gap-2">
                            {['all', 'in-stock', 'low-stock', 'out-of-stock'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status)}
                                    className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${filterStatus === status
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
                </div>
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
                                        Selling Price
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        GST / Margin
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
                                    const margin = calculateProfitMargin(product.sellingPrice, product.purchasePrice);

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
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {formatCurrency(product.sellingPrice || 0)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <div className={margin >= 0 ? 'text-success-600 font-semibold' : 'text-danger-600 font-semibold'}>
                                                    {(margin || 0).toFixed(1)}%
                                                </div>
                                                {product.gstRate && <div className="text-xs text-gray-500">GST: {product.gstRate}%</div>}
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

                        <Input
                            label="GST Rate (%)"
                            type="number"
                            step="0.01"
                            value={formData.gstRate}
                            onChange={(e) => setFormData({ ...formData, gstRate: e.target.value })}
                            placeholder="18"
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Purchase Price *"
                            type="number"
                            step="0.01"
                            value={formData.purchasePrice}
                            onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                            placeholder="0.00"
                        />

                        <Input
                            label="Selling Price *"
                            type="number"
                            step="0.01"
                            value={formData.sellingPrice}
                            onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                            placeholder="0.00"
                        />
                    </div>

                    {formData.purchasePrice && formData.sellingPrice && (
                        <div className="bg-gray-50 p-3 rounded-lg flex justify-between items-center">
                            <p className="text-sm text-gray-600">
                                Profit Margin:{' '}
                                <span className={`font-semibold ${calculateProfitMargin(parseFloat(formData.sellingPrice), parseFloat(formData.purchasePrice)) >= 0
                                    ? 'text-success-600'
                                    : 'text-danger-600'
                                    }`}>
                                    {calculateProfitMargin(parseFloat(formData.sellingPrice), parseFloat(formData.purchasePrice)).toFixed(2)}%
                                </span>
                            </p>

                        </div>
                    )}

                    <div className="flex gap-2 justify-end pt-4">
                        <Button type="button" variant="secondary" onClick={handleCloseModal}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="primary">
                            {editingProduct ? 'Update' : 'Add'} Product
                        </Button>
                    </div>
                </form>
            </Modal>

            {restockingProduct && (
                <Modal
                    isOpen={true}
                    onClose={handleRestockClose}
                    title={`Add Stock: ${restockingProduct.name}`}
                    size="md"
                >
                    <form onSubmit={handleRestockSubmit} className="space-y-4">
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
                        {restockForm.quantity && restockForm.price && (
                            <div className="bg-blue-50 p-3 rounded-lg flex justify-between">
                                <span className="text-sm text-blue-900">Total Expense:</span>
                                <span className="font-bold text-blue-700">
                                    {formatCurrency(parseFloat(restockForm.quantity) * parseFloat(restockForm.price))}
                                </span>
                            </div>
                        )}
                        <div className="flex gap-2 justify-end">
                            <Button type="button" variant="secondary" onClick={handleRestockClose}>
                                Cancel
                            </Button>
                            <Button type="submit" variant="primary">
                                Add Stock
                            </Button>
                        </div>
                    </form>
                </Modal>
            )}

        </div>
    );
};
