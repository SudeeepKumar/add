import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    subscribeToTransactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
} from '../services/transactionService';
import { Modal } from '../components/common/Modal';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Plus, Pencil, Trash2, Receipt, Search, Filter, Calendar } from 'lucide-react';
import { formatCurrency } from '../utils/currencyUtils';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, TRANSACTION_TYPES, GST_RATES, PAYMENT_METHODS } from '../utils/constants';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export const Transactions = () => {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState(null);
    const [filterType, setFilterType] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Date range filter
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // Form state
    const [formData, setFormData] = useState({
        type: 'expense',
        category: '',
        amount: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        description: '',
        gstRate: '18',
        paymentMethod: 'Cash',
    });

    useEffect(() => {
        if (!user) return;

        const unsubscribe = subscribeToTransactions(user.uid, (data) => {
            setTransactions(data);
            setLoading(false);
        });

        return unsubscribe;
    }, [user]);

    const resetForm = () => {
        setFormData({
            type: 'expense',
            category: '',
            amount: '',
            date: format(new Date(), 'yyyy-MM-dd'),
            description: '',
            gstRate: '18',
            paymentMethod: 'Cash',
        });
        setEditingTransaction(null);
    };

    const handleOpenModal = (transaction = null) => {
        if (transaction) {
            setEditingTransaction(transaction);
            setFormData({
                type: transaction.type,
                category: transaction.category,
                amount: transaction.amount.toString(),
                date: format(transaction.date, 'yyyy-MM-dd'),
                description: transaction.description || '',
                gstRate: transaction.gstRate?.toString() || '18',
                paymentMethod: transaction.paymentMethod || 'Cash',
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

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.category || !formData.amount || !formData.date) {
            toast.error('Please fill in all required fields');
            return;
        }

        try {
            const transactionData = {
                type: formData.type,
                category: formData.category,
                amount: parseFloat(formData.amount),
                date: new Date(formData.date),
                description: formData.description,
                gstRate: parseFloat(formData.gstRate),
                paymentMethod: formData.paymentMethod,
            };

            if (editingTransaction) {
                await updateTransaction(editingTransaction.id, transactionData);
                toast.success('Transaction updated successfully');
            } else {
                await addTransaction(user.uid, transactionData);
                toast.success('Transaction added successfully');
            }

            handleCloseModal();
        } catch (error) {
            console.error('Error saving transaction:', error);
            toast.error('Failed to save transaction');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this transaction?')) {
            return;
        }

        try {
            await deleteTransaction(id);
            toast.success('Transaction deleted successfully');
        } catch (error) {
            console.error('Error deleting transaction:', error);
            toast.error('Failed to delete transaction');
        }
    };

    // Filter transactions
    const filteredTransactions = transactions
        .sort((a, b) => {
            const dateA = a.date?.toDate?.() || new Date(a.date);
            const dateB = b.date?.toDate?.() || new Date(b.date);
            return dateB - dateA;
        })
        .filter((t) => {
            const matchesType = filterType === 'all' || t.type === filterType;
            const matchesSearch =
                !searchQuery ||
                t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                t.category.toLowerCase().includes(searchQuery.toLowerCase());

            // Date range filter
            let matchesDate = true;
            if (dateFrom || dateTo) {
                const tDate = t.date?.toDate?.() || new Date(t.date);
                if (dateFrom) {
                    matchesDate = tDate >= new Date(dateFrom);
                }
                if (dateTo && matchesDate) {
                    const toDateEnd = new Date(dateTo);
                    toDateEnd.setHours(23, 59, 59, 999);
                    matchesDate = tDate <= toDateEnd;
                }
            }

            return matchesType && matchesSearch && matchesDate;
        });

    const categories = formData.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

    const gstOptions = GST_RATES;

    const paymentMethodOptions = [
        { value: '', label: 'Select Payment Method' },
        ...PAYMENT_METHODS.map(m => ({ value: m, label: m }))
    ];

    // Summary calculations
    const totalIncome = filteredTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

    const totalExpenses = filteredTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

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
                    <h1 className="text-3xl font-bold text-gray-900">Transactions</h1>
                    <p className="text-gray-600 mt-1">Track your income and expenses</p>
                </div>
                <Button onClick={() => handleOpenModal()} className="flex items-center gap-2">
                    <Plus size={20} />
                    Add Transaction
                </Button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Type Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <Filter size={16} className="inline mr-1" />
                            Type
                        </label>
                        <div className="flex gap-2">
                            {['all', 'income', 'expense'].map((type) => (
                                <button
                                    key={type}
                                    onClick={() => setFilterType(type)}
                                    className={`px-3 py-1.5 rounded-lg font-medium transition-all text-sm ${filterType === type
                                        ? 'bg-primary-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    {type.charAt(0).toUpperCase() + type.slice(1)}
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
                            placeholder="Search by description or category..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Date From */}
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

                    {/* Date To */}
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

                {/* Clear date filters + Summary */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    {(dateFrom || dateTo) && (
                        <button
                            onClick={() => { setDateFrom(''); setDateTo(''); }}
                            className="text-sm text-primary-600 hover:text-primary-800 underline"
                        >
                            Clear date filters
                        </button>
                    )}
                    <div className="flex gap-4 text-sm ml-auto">
                        <span className="text-success-600 font-semibold">
                            Income: {formatCurrency(totalIncome)}
                        </span>
                        <span className="text-danger-600 font-semibold">
                            Expenses: {formatCurrency(totalExpenses)}
                        </span>
                        <span className={`font-bold ${(totalIncome - totalExpenses) >= 0 ? 'text-success-700' : 'text-danger-700'}`}>
                            Net: {formatCurrency(totalIncome - totalExpenses)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Transactions List */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                {filteredTransactions.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Date
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Type
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Category
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Description
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Payment
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        GST
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Amount
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {filteredTransactions.map((transaction) => (
                                    <tr key={transaction.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {format(transaction.date, 'MMM dd, yyyy')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span
                                                className={`px-2 py-1 text-xs font-medium rounded-full ${transaction.type === 'income'
                                                    ? 'bg-success-100 text-success-800'
                                                    : 'bg-danger-100 text-danger-800'
                                                    }`}
                                            >
                                                {transaction.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {transaction.category}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                                            {transaction.description || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {transaction.paymentMethod || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {transaction.gstRate ? `${transaction.gstRate}%` : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                                            <span
                                                className={
                                                    transaction.type === 'income' ? 'text-success-600' : 'text-danger-600'
                                                }
                                            >
                                                {transaction.type === 'income' ? '+' : '-'}
                                                {formatCurrency(transaction.amount)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => handleOpenModal(transaction)}
                                                className="text-primary-600 hover:text-primary-900 mr-4"
                                            >
                                                <Pencil size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(transaction.id)}
                                                className="text-danger-600 hover:text-danger-900"
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
                        icon={Receipt}
                        title="No transactions found"
                        description="Start adding transactions to track your income and expenses"
                        action={() => handleOpenModal()}
                        actionLabel="Add Transaction"
                    />
                )}
            </div>

            {/* Transaction Modal */}
            <Modal
                isOpen={modalOpen}
                onClose={handleCloseModal}
                title={editingTransaction ? 'Edit Transaction' : 'Add Transaction'}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Type Selection */}
                    <div>
                        <label className="label">Transaction Type</label>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, type: 'income', category: '' })}
                                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${formData.type === 'income'
                                    ? 'bg-success-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                Income
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, type: 'expense', category: '' })}
                                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${formData.type === 'expense'
                                    ? 'bg-danger-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                Expense
                            </button>
                        </div>
                    </div>

                    {/* Category */}
                    <Select
                        label="Category *"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        options={[
                            { value: '', label: 'Select a category' },
                            ...categories.map((cat) => ({ value: cat, label: cat })),
                        ]}
                    />

                    {/* Amount */}
                    <Input
                        label="Amount *"
                        type="number"
                        step="0.01"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        placeholder="0.00"
                    />

                    {/* Date */}
                    <Input
                        label="Date *"
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />

                    {/* GST Rate — Dropdown */}
                    <Select
                        label="GST Rate"
                        value={formData.gstRate}
                        onChange={(e) => setFormData({ ...formData, gstRate: e.target.value })}
                        options={gstOptions}
                    />

                    {/* Payment Method */}
                    <Select
                        label="Payment Method"
                        value={formData.paymentMethod}
                        onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                        options={paymentMethodOptions}
                    />

                    {/* Description */}
                    <div>
                        <label className="label">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Optional details about this transaction"
                            className="input min-h-[80px]"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 justify-end pt-4">
                        <Button type="button" variant="secondary" onClick={handleCloseModal}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="primary">
                            {editingTransaction ? 'Update' : 'Add'} Transaction
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
