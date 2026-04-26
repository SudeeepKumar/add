import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    subscribeToInvoices,
    addInvoice,
    updateInvoice,
    deleteInvoice,
} from '../services/invoiceService';
import { subscribeToProducts } from '../services/productService';
import { subscribeToBusinessSettings } from '../services/businessSettingsService';
import { isValidEmail } from '../utils/validationUtils';
import { Modal } from '../components/common/Modal';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { SearchableSelect } from '../components/common/SearchableSelect';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Plus, Pencil, Trash2, FileText, Download, Search, Calendar } from 'lucide-react';
import { formatCurrency } from '../utils/currencyUtils';
import { calculateTotalWithGST, calculateGST } from '../utils/taxCalculations';
import { exportInvoicePDF } from '../utils/exportUtils';
import { format, isWithinInterval, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

export const Invoices = () => {
    const { user } = useAuth();
    const [invoices, setInvoices] = useState([]);
    const [products, setProducts] = useState([]);
    const [businessSettings, setBusinessSettings] = useState({});
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [formData, setFormData] = useState({
        customerName: '',
        customerEmail: '',
        customerAddress: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        dueDate: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        items: [{ productId: '', description: '', quantity: 1, price: 0, discount: 0 }],
        gstRate: 18,
        notes: '',
        status: 'unpaid',
    });

    useEffect(() => {
        if (!user) return;

        const unsubInvoices = subscribeToInvoices(user.uid, (data) => {
            setInvoices(data);
            setLoading(false);
        });

        const unsubProducts = subscribeToProducts(user.uid, (data) => {
            setProducts(data);
        });

        const unsubBusinessSettings = subscribeToBusinessSettings(user.uid, (data) => {
            setBusinessSettings(data);
        });

        return () => {
            unsubInvoices();
            unsubProducts();
            unsubBusinessSettings();
        };
    }, [user]);

    const resetForm = () => {
        setFormData({
            customerName: '',
            customerEmail: '',
            customerAddress: '',
            date: format(new Date(), 'yyyy-MM-dd'),
            dueDate: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
            items: [{ productId: '', description: '', quantity: 1, price: 0, discount: 0 }],
            gstRate: 18,
            notes: '',
            status: 'unpaid',
        });
        setEditingInvoice(null);
    };

    const handleOpenModal = (invoice = null) => {
        if (invoice) {
            setEditingInvoice(invoice);
            setFormData({
                customerName: invoice.customerName,
                customerEmail: invoice.customerEmail || '',
                customerAddress: invoice.customerAddress || '',
                date: format(invoice.date, 'yyyy-MM-dd'),
                dueDate: format(invoice.dueDate, 'yyyy-MM-dd'),
                items: invoice.items,
                gstRate: invoice.gstRate,
                notes: invoice.notes || '',
                status: invoice.status,
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

    const handleAddItem = () => {
        setFormData({
            ...formData,
            items: [...formData.items, { productId: '', description: '', quantity: 1, price: 0, discount: 0 }],
        });
    };

    const handleRemoveItem = (index) => {
        const newItems = formData.items.filter((_, i) => i !== index);
        setFormData({ ...formData, items: newItems });
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...formData.items];
        newItems[index][field] = value;

        // If product is selected, auto-fill description, price, and GST
        if (field === 'productId') {
            const product = products.find((p) => p.id === value);
            if (product) {
                newItems[index].description = product.name;
                newItems[index].price = product.sellingPrice || 0;
                newItems[index].hsnCode = product.hsnCode || '';
                newItems[index].sku = product.sku || '';
                // Auto-fill GST rate from product (use product's GST if available)
                if (product.gstRate !== undefined && product.gstRate !== null) {
                    setFormData(prev => ({
                        ...prev,
                        gstRate: product.gstRate,
                        items: newItems,
                    }));
                    return;
                }
            } else if (value === '') {
                // Allow clearing
                newItems[index].description = '';
                newItems[index].price = 0;
                newItems[index].hsnCode = '';
                newItems[index].sku = '';
            }
        }

        setFormData({ ...formData, items: newItems });
    };

    const calculateInvoiceTotals = () => {
        const subtotal = formData.items.reduce((sum, item) => {
            const itemTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.price) || 0);
            const discount = parseFloat(item.discount) || 0;
            return sum + Math.max(0, itemTotal - discount);
        }, 0);

        const gstAmount = calculateGST(subtotal, formData.gstRate);
        const total = subtotal + gstAmount;

        return { subtotal, gstAmount, total };
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.customerName || formData.items.some((item) => !item.description)) {
            toast.error('Please fill in all required fields');
            return;
        }

        // Validate customer email if provided
        if (formData.customerEmail && !isValidEmail(formData.customerEmail)) {
            toast.error('Please enter a valid customer email address');
            return;
        }

        try {
            const { subtotal, gstAmount, total } = calculateInvoiceTotals();

            const invoiceData = {
                customerName: formData.customerName,
                customerEmail: formData.customerEmail,
                customerAddress: formData.customerAddress,
                date: new Date(formData.date),
                dueDate: new Date(formData.dueDate),
                items: formData.items,
                subtotal,
                gstRate: parseFloat(formData.gstRate),
                gstAmount,
                total,
                notes: formData.notes,
                status: formData.status,
            };

            if (editingInvoice) {
                await updateInvoice(editingInvoice.id, invoiceData);
                toast.success('Invoice updated successfully');
            } else {
                const result = await addInvoice(user.uid, invoiceData);
                toast.success(`Invoice ${result.invoiceNumber} created successfully`);
            }

            handleCloseModal();
        } catch (error) {
            console.error('Error saving invoice:', error);
            toast.error('Failed to save invoice');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this invoice?')) {
            return;
        }

        try {
            await deleteInvoice(id);
            toast.success('Invoice deleted successfully');
        } catch (error) {
            console.error('Error deleting invoice:', error);
            toast.error('Failed to delete invoice');
        }
    };

    const handleDownloadPDF = (invoice) => {
        try {
            exportInvoicePDF(invoice, businessSettings);
            toast.success('Invoice PDF downloaded');
        } catch (error) {
            console.error('Error downloading PDF:', error);
            toast.error('Failed to download PDF');
        }
    };

    // Filter invoices by search query and date range
    const filteredInvoices = invoices
        .sort((a, b) => {
            const dateA = a.date?.toDate?.() || new Date(a.date);
            const dateB = b.date?.toDate?.() || new Date(b.date);
            return dateB - dateA;
        })
        .filter((invoice) => {
            // Search filter
            const matchesSearch =
                !searchQuery ||
                invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                invoice.customerName.toLowerCase().includes(searchQuery.toLowerCase());

            // Date range filter
            let matchesDateRange = true;
            if (startDate || endDate) {
                const invoiceDate = invoice.date;
                if (startDate && endDate) {
                    matchesDateRange = isWithinInterval(invoiceDate, {
                        start: parseISO(startDate),
                        end: parseISO(endDate),
                    });
                } else if (startDate) {
                    matchesDateRange = invoiceDate >= parseISO(startDate);
                } else if (endDate) {
                    matchesDateRange = invoiceDate <= parseISO(endDate);
                }
            }

            return matchesSearch && matchesDateRange;
        });

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
                    <h1 className="text-3xl font-bold text-gray-900">Invoices</h1>
                    <p className="text-gray-600 mt-1">Create and manage customer invoices</p>
                </div>
                <Button onClick={() => handleOpenModal()} className="flex items-center gap-2">
                    <Plus size={20} />
                    Create Invoice
                </Button>
            </div>

            {/* Search and Filters */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Search */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <Search size={16} className="inline mr-1" />
                            Search
                        </label>
                        <Input
                            type="text"
                            placeholder="Invoice number or customer..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Start Date */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <Calendar size={16} className="inline mr-1" />
                            From Date
                        </label>
                        <Input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>

                    {/* End Date */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <Calendar size={16} className="inline mr-1" />
                            To Date
                        </label>
                        <Input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                </div>

                {/* Active Filters Info */}
                {(searchQuery || startDate || endDate) && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                        <span className="font-medium">Showing {filteredInvoices.length} of {invoices.length} invoices</span>
                        <button
                            onClick={() => {
                                setSearchQuery('');
                                setStartDate('');
                                setEndDate('');
                            }}
                            className="text-primary-600 hover:text-primary-800 underline"
                        >
                            Clear filters
                        </button>
                    </div>
                )}
            </div>

            {/* Invoices List */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                {filteredInvoices.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Invoice #
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Customer
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Date
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Due Date
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Total
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {filteredInvoices.map((invoice) => (
                                    <tr key={invoice.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {invoice.invoiceNumber}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {invoice.customerName}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {format(invoice.date, 'MMM dd, yyyy')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {format(invoice.dueDate, 'MMM dd, yyyy')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                            {formatCurrency(invoice.total)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span
                                                className={`px-2 py-1 text-xs font-medium rounded-full ${invoice.status === 'paid'
                                                    ? 'bg-success-100 text-success-800'
                                                    : invoice.status === 'overdue'
                                                        ? 'bg-danger-100 text-danger-800'
                                                        : 'bg-orange-100 text-orange-800'
                                                    }`}
                                            >
                                                {invoice.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                            <button
                                                onClick={() => handleDownloadPDF(invoice)}
                                                className="text-primary-600 hover:text-primary-900"
                                                title="Download PDF"
                                            >
                                                <Download size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleOpenModal(invoice)}
                                                className="text-primary-600 hover:text-primary-900"
                                                title="Edit"
                                            >
                                                <Pencil size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(invoice.id)}
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
                        icon={FileText}
                        title="No invoices yet"
                        description="Create your first invoice to get started"
                        action={() => handleOpenModal()}
                        actionLabel="Create Invoice"
                    />
                )}
            </div>

            {/* Invoice Modal */}
            <Modal
                isOpen={modalOpen}
                onClose={handleCloseModal}
                title={editingInvoice ? 'Edit Invoice' : 'Create Invoice'}
                size="lg"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Customer Name *"
                            value={formData.customerName}
                            onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                            placeholder="John Doe"
                        />
                        <Input
                            label="Customer Email"
                            type="email"
                            value={formData.customerEmail}
                            onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                            placeholder="customer@example.com"
                        />
                    </div>

                    <Input
                        label="Customer Address"
                        value={formData.customerAddress}
                        onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
                        placeholder="123 Main St, City, State, ZIP"
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Invoice Date *"
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        />
                        <Input
                            label="Due Date *"
                            type="date"
                            value={formData.dueDate}
                            onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                        />
                    </div>

                    {/* Line Items */}
                    <div>
                        <label className="label mb-2">Line Items *</label>
                        <div className="space-y-3">
                            {formData.items.map((item, index) => (
                                <div key={index} className="grid grid-cols-12 gap-2 items-end">
                                    <div className="col-span-4">
                                        {/* Product Select or Description Input */}
                                        <div className="space-y-2">
                                            <SearchableSelect
                                                value={item.productId}
                                                onChange={(value) => handleItemChange(index, 'productId', value)}
                                                options={products.map(p => ({
                                                    value: p.id,
                                                    label: p.name
                                                }))}
                                                placeholder="Search product..."
                                                className="mb-1"
                                                disabled={!!editingInvoice}
                                            />
                                            <Input
                                                placeholder="Description"
                                                value={item.description}
                                                onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                                disabled={!!editingInvoice}
                                            />
                                        </div>
                                    </div>
                                    <div className="col-span-2">
                                        <Input
                                            type="number"
                                            label={index === 0 ? "Qty" : ""}
                                            value={item.quantity}
                                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                            disabled={!!editingInvoice}
                                        />
                                    </div>
                                    <div className="col-span-3">
                                        <Input
                                            type="number"
                                            step="0.01"
                                            label={index === 0 ? "Price" : ""}
                                            value={item.price}
                                            onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                                            disabled={!!editingInvoice}
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <Input
                                            type="number"
                                            step="0.01"
                                            label={index === 0 ? "Disc." : ""}
                                            placeholder="0"
                                            value={item.discount}
                                            onChange={(e) => handleItemChange(index, 'discount', e.target.value)}
                                            disabled={!!editingInvoice}
                                        />
                                    </div>
                                    <div className="col-span-1 flex items-end justify-center pb-2">
                                        {formData.items.length > 1 && !editingInvoice && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveItem(index)}
                                                className="text-danger-500 hover:text-danger-700"
                                                title="Remove Item"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        {!editingInvoice && (
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={handleAddItem}
                                className="mt-2"
                            >
                                + Add Item
                            </Button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="GST Rate (%)"
                            type="number"
                            step="0.01"
                            value={formData.gstRate}
                            onChange={(e) => setFormData({ ...formData, gstRate: e.target.value })}
                        />
                        <Select
                            label="Status"
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            options={[
                                { value: 'unpaid', label: 'Unpaid' },
                                { value: 'paid', label: 'Paid' },
                                { value: 'overdue', label: 'Overdue' },
                            ]}
                        />
                    </div>

                    <div>
                        <label className="label">Notes</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Additional notes or payment terms"
                            className="input min-h-[80px]"
                        />
                    </div>

                    {/* Invoice Total */}
                    <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Subtotal:</span>
                            <span className="font-medium">{formatCurrency(calculateInvoiceTotals().subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">GST ({formData.gstRate}%):</span>
                            <span className="font-medium">{formatCurrency(calculateInvoiceTotals().gstAmount)}</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold border-t pt-2">
                            <span>Total:</span>
                            <span>{formatCurrency(calculateInvoiceTotals().total)}</span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 justify-end pt-4">
                        <Button type="button" variant="secondary" onClick={handleCloseModal}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="primary">
                            {editingInvoice ? 'Update' : 'Create'} Invoice
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
