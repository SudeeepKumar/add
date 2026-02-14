import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToTransactions } from '../services/transactionService';
import { subscribeToProducts } from '../services/productService';
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    AlertTriangle,
    ArrowUpRight,
    ArrowDownRight,
} from 'lucide-react';
import { formatCurrency } from '../utils/currencyUtils';
import { format } from 'date-fns';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

export const Dashboard = () => {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        const unsubTransactions = subscribeToTransactions(user.uid, (data) => {
            setTransactions(data);
            setLoading(false);
        });

        const unsubProducts = subscribeToProducts(user.uid, (data) => {
            setProducts(data);
        });

        // Automatic Opening Stock Expense Generation
        const checkAndGenerateOpeningStock = async () => {
            try {
                const { getBusinessSettings, saveBusinessSettings } = await import('../services/businessSettingsService');
                const settings = await getBusinessSettings(user.uid);

                if (!settings.hasImportedOpeningStock) {
                    const { getProducts } = await import('../services/productService');
                    const { addTransaction } = await import('../services/transactionService');

                    // Fetch fresh products to ensure accuracy
                    const productsList = await getProducts(user.uid);
                    let count = 0;
                    let totalValue = 0;

                    for (const product of productsList) {
                        if (product.quantity > 0 && product.purchasePrice > 0) {
                            const cost = product.quantity * product.purchasePrice;
                            await addTransaction(user.uid, {
                                type: 'expense',
                                category: 'Purchase',
                                amount: cost,
                                description: `Opening Stock: ${product.name} (+${product.quantity})`,
                                date: new Date(), // Using current date for the expense recognition
                                paymentMethod: 'Cash',
                                referenceId: product.id,
                                status: 'completed'
                            });
                            count++;
                            totalValue += cost;
                        }
                    }

                    if (count > 0) {
                        toast.success(`Automatically recorded ${count} opening stock expenses`, { duration: 5000 });
                    }

                    // Mark as done
                    await saveBusinessSettings(user.uid, { hasImportedOpeningStock: true });
                }
            } catch (error) {
                console.error('Error generating opening stock:', error);
            }
        };

        // checkAndGenerateOpeningStock();

        return () => {
            unsubTransactions();
            unsubProducts();
        };
    }, [user]);

    // Calculate totals
    const totalIncome = transactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

    const totalExpenses = transactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

    const netProfit = totalIncome - totalExpenses;

    // Get low stock products
    const lowStockProducts = products.filter(
        (p) => p.quantity <= (p.lowStockThreshold || 10)
    );

    // Sort transactions by date (descending)
    const sortedTransactions = [...transactions].sort((a, b) => {
        const dateA = a.date?.toDate?.() || new Date(a.date);
        const dateB = b.date?.toDate?.() || new Date(b.date);
        return dateB - dateA;
    });

    // Get recent transactions
    const recentTransactions = sortedTransactions.slice(0, 5);

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
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-600 mt-1">Welcome back! Here's your business overview.</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Total Income */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-gray-600">Total Income</h3>
                        <div className="w-10 h-10 bg-success-100 rounded-lg flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-success-600" />
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalIncome)}</p>
                    <div className="flex items-center gap-1 mt-2 text-success-600 text-sm">
                        <ArrowUpRight size={16} />
                        <span>Revenue</span>
                    </div>
                </div>

                {/* Total Expenses */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-gray-600">Total Expenses</h3>
                        <div className="w-10 h-10 bg-danger-100 rounded-lg flex items-center justify-center">
                            <TrendingDown className="w-5 h-5 text-danger-600" />
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalExpenses)}</p>
                    <div className="flex items-center gap-1 mt-2 text-danger-600 text-sm">
                        <ArrowDownRight size={16} />
                        <span>Costs</span>
                    </div>
                </div>

                {/* Net Profit/Loss */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-gray-600">Net {netProfit >= 0 ? 'Profit' : 'Loss'}</h3>
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${netProfit >= 0 ? 'bg-primary-100' : 'bg-danger-100'
                            }`}>
                            <DollarSign className={`w-5 h-5 ${netProfit >= 0 ? 'text-primary-600' : 'text-danger-600'
                                }`} />
                        </div>
                    </div>
                    <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-success-600' : 'text-danger-600'
                        }`}>
                        {formatCurrency(Math.abs(netProfit))}
                    </p>
                    <div className="flex items-center gap-1 mt-2 text-gray-600 text-sm">
                        <span>{netProfit >= 0 ? 'Positive' : 'Negative'} Balance</span>
                    </div>
                </div>

                {/* Low Stock Alert */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-gray-600">Low Stock Items</h3>
                        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                            <AlertTriangle className="w-5 h-5 text-orange-600" />
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{lowStockProducts.length}</p>
                    <div className="flex items-center gap-1 mt-2 text-orange-600 text-sm">
                        <span>Needs attention</span>
                    </div>
                </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Transactions</h2>

                {recentTransactions.length > 0 ? (
                    <div className="space-y-3">
                        {recentTransactions.map((transaction) => (
                            <div
                                key={transaction.id}
                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${transaction.type === 'income' ? 'bg-success-100' : 'bg-danger-100'
                                        }`}>
                                        {transaction.type === 'income' ? (
                                            <ArrowUpRight className="w-5 h-5 text-success-600" />
                                        ) : (
                                            <ArrowDownRight className="w-5 h-5 text-danger-600" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900">{transaction.description || transaction.category}</p>
                                        <p className="text-sm text-gray-500">
                                            {format(transaction.date, 'MMM dd, yyyy')} • {transaction.category}
                                        </p>
                                    </div>
                                </div>
                                <span className={`font-semibold ${transaction.type === 'income' ? 'text-success-600' : 'text-danger-600'
                                    }`}>
                                    {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-500 text-center py-8">No transactions yet</p>
                )}
            </div>

            {/* Low Stock Alert */}
            {lowStockProducts.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-6 h-6 text-orange-600 flex-shrink-0" />
                        <div>
                            <h3 className="font-semibold text-orange-900 mb-2">
                                Low Stock Alert
                            </h3>
                            <p className="text-orange-800 mb-3">
                                The following products are running low on stock:
                            </p>
                            <div className="space-y-1">
                                {lowStockProducts.slice(0, 5).map((product) => (
                                    <p key={product.id} className="text-sm text-orange-700">
                                        • {product.name} - Only {product.quantity} left
                                    </p>
                                ))}
                                {lowStockProducts.length > 5 && (
                                    <p className="text-sm text-orange-700 font-medium">
                                        ... and {lowStockProducts.length - 5} more
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
