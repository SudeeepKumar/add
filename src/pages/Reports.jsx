import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToTransactions } from '../services/transactionService';
import { subscribeToProducts } from '../services/productService';
import { subscribeToSales } from '../services/salesService';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Download, TrendingUp, TrendingDown, DollarSign, ShoppingBag } from 'lucide-react';
import { formatCurrency } from '../utils/currencyUtils';
import { exportProfitLossPDF, exportToCSV } from '../utils/exportUtils';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import toast from 'react-hot-toast';
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    BarChart,
    Bar,
} from 'recharts';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

export const Reports = () => {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState([]);
    const [products, setProducts] = useState([]);
    const [salesData, setSalesData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState({
        start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
        end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    });

    useEffect(() => {
        if (!user) return;

        const unsubTransactions = subscribeToTransactions(user.uid, (data) => {
            setTransactions(data);
            setLoading(false);
        });

        const unsubProducts = subscribeToProducts(user.uid, (data) => {
            setProducts(data);
        });

        const unsubSales = subscribeToSales(user.uid, (data) => {
            setSalesData(data);
        });

        return () => {
            unsubTransactions();
            unsubProducts();
            unsubSales();
        };
    }, [user]);

    // Filter transactions by date range
    const filteredTransactions = transactions.filter((t) => {
        const transactionDate = format(t.date, 'yyyy-MM-dd');
        return transactionDate >= dateRange.start && transactionDate <= dateRange.end;
    });

    // Calculate income by category
    const incomeByCategory = {};
    filteredTransactions
        .filter((t) => t.type === 'income')
        .forEach((t) => {
            incomeByCategory[t.category] = (incomeByCategory[t.category] || 0) + t.amount;
        });

    const incomeData = Object.entries(incomeByCategory).map(([category, amount]) => ({
        category,
        amount,
    }));

    // Calculate expenses by category
    const expensesByCategory = {};
    filteredTransactions
        .filter((t) => t.type === 'expense')
        .forEach((t) => {
            expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + t.amount;
        });

    const expensesData = Object.entries(expensesByCategory).map(([category, amount]) => ({
        category,
        amount,
    }));

    // Total calculations
    const totalIncome = incomeData.reduce((sum, item) => sum + item.amount, 0);
    const totalExpenses = expensesData.reduce((sum, item) => sum + item.amount, 0);
    const netProfit = totalIncome - totalExpenses;

    // Inventory valuation
    const inventoryPurchaseValue = products.reduce(
        (sum, p) => sum + p.quantity * p.purchasePrice,
        0
    );
    const inventorySellingValue = products.reduce(
        (sum, p) => sum + p.quantity * p.sellingPrice,
        0
    );
    const potentialProfit = inventorySellingValue - inventoryPurchaseValue;

    // Monthly trend data (last 6 months)
    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
        const date = subDays(new Date(), i * 30);
        const monthStart = startOfMonth(date);
        const monthEnd = endOfMonth(date);

        const monthTransactions = transactions.filter((t) => {
            const td = t.date;
            return td >= monthStart && td <= monthEnd;
        });

        const monthIncome = monthTransactions
            .filter((t) => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);

        const monthExpenses = monthTransactions
            .filter((t) => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);

        monthlyData.push({
            month: format(date, 'MMM'),
            income: monthIncome,
            expenses: monthExpenses,
            profit: monthIncome - monthExpenses,
        });
    }

    // ── Sales Analytics ─────────────────────
    // Sales by platform
    const salesByPlatform = {};
    salesData.forEach(sale => {
        const p = sale.platform || 'Other';
        salesByPlatform[p] = (salesByPlatform[p] || 0) + (sale.totalRevenue || 0);
    });
    const platformData = Object.entries(salesByPlatform)
        .map(([platform, revenue]) => ({ platform, revenue }))
        .sort((a, b) => b.revenue - a.revenue);

    // Top products by revenue (from sales)
    const productRevenueMap = {};
    salesData.forEach(sale => {
        (sale.items || []).forEach(item => {
            const key = item.productName;
            if (!productRevenueMap[key]) {
                productRevenueMap[key] = { revenue: 0, cost: 0, qty: 0 };
            }
            productRevenueMap[key].revenue += item.sellingPrice * item.quantity;
            productRevenueMap[key].cost += item.purchasePrice * item.quantity;
            productRevenueMap[key].qty += item.quantity;
        });
    });
    const topProductsData = Object.entries(productRevenueMap)
        .map(([name, data]) => ({ name, ...data, profit: data.revenue - data.cost }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 8);

    // Sales profit margin
    const totalSalesRevenue = salesData.reduce((sum, s) => sum + (s.totalRevenue || 0), 0);
    const totalSalesCost = salesData.reduce((sum, s) => sum + (s.totalCost || 0), 0);
    const totalSalesProfit = totalSalesRevenue - totalSalesCost;
    const profitMarginPercent = totalSalesRevenue > 0
        ? ((totalSalesProfit / totalSalesRevenue) * 100).toFixed(1)
        : '0.0';

    const handleExportPDF = () => {
        try {
            const data = {
                income: incomeData,
                expenses: expensesData,
                totalIncome,
                totalExpenses,
            };
            exportProfitLossPDF(data, dateRange);
            toast.success('PDF exported successfully');
        } catch (error) {
            console.error('Error exporting PDF:', error);
            toast.error('Failed to export PDF');
        }
    };

    const handleExportCSV = () => {
        try {
            const csvData = filteredTransactions.map((t) => ({
                Date: format(t.date, 'yyyy-MM-dd'),
                Type: t.type,
                Category: t.category,
                Amount: t.amount,
                Description: t.description || '',
            }));
            exportToCSV(csvData, `transactions-${dateRange.start}-to-${dateRange.end}`);
            toast.success('CSV exported successfully');
        } catch (error) {
            console.error('Error exporting CSV:', error);
            toast.error('Failed to export CSV');
        }
    };

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
                    <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
                    <p className="text-gray-600 mt-1">Financial insights and performance metrics</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={handleExportPDF} variant="outline" className="flex items-center gap-2">
                        <Download size={18} />
                        Export PDF
                    </Button>
                    <Button onClick={handleExportCSV} variant="outline" className="flex items-center gap-2">
                        <Download size={18} />
                        Export CSV
                    </Button>
                </div>
            </div>

            {/* Date Range Selector */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                            className="input"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                            className="input"
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button
                            onClick={() => setDateRange({
                                start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
                                end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
                            })}
                            variant="secondary"
                            size="sm"
                        >
                            This Month
                        </Button>
                        <Button
                            onClick={() => setDateRange({
                                start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
                                end: format(new Date(), 'yyyy-MM-dd'),
                            })}
                            variant="secondary"
                            size="sm"
                        >
                            Last 30 Days
                        </Button>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-gray-600">Total Income</h3>
                        <TrendingUp className="w-8 h-8 text-success-600" />
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{formatCurrency(totalIncome)}</p>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-gray-600">Total Expenses</h3>
                        <TrendingDown className="w-8 h-8 text-danger-600" />
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{formatCurrency(totalExpenses)}</p>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-gray-600">Net {netProfit >= 0 ? 'Profit' : 'Loss'}</h3>
                        <DollarSign className={`w-8 h-8 ${netProfit >= 0 ? 'text-primary-600' : 'text-danger-600'}`} />
                    </div>
                    <p className={`text-3xl font-bold ${netProfit >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                        {formatCurrency(Math.abs(netProfit))}
                    </p>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Expense Breakdown */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Expense Breakdown</h2>
                    {expensesData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={expensesData}
                                    dataKey="amount"
                                    nameKey="category"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={100}
                                    label={(entry) => `${entry.category}: ${formatCurrency(entry.amount)}`}
                                >
                                    {expensesData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => formatCurrency(value)} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-gray-500 text-center py-12">No expense data available</p>
                    )}
                </div>

                {/* Income Breakdown */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Income Breakdown</h2>
                    {incomeData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={incomeData}
                                    dataKey="amount"
                                    nameKey="category"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={100}
                                    label={(entry) => `${entry.category}: ${formatCurrency(entry.amount)}`}
                                >
                                    {incomeData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => formatCurrency(value)} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-gray-500 text-center py-12">No income data available</p>
                    )}
                </div>
            </div>

            {/* Monthly Trend */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Income vs Expenses (6 Months)</h2>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis tickFormatter={(value) => `₹${value}`} />
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                        <Legend />
                        <Bar dataKey="income" fill="#22c55e" name="Income" />
                        <Bar dataKey="expenses" fill="#ef4444" name="Expenses" />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Inventory Valuation */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Inventory Valuation</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <p className="text-sm text-gray-600 mb-1">Purchase Value</p>
                        <p className="text-2xl font-bold text-gray-900">{formatCurrency(inventoryPurchaseValue)}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600 mb-1">Selling Value</p>
                        <p className="text-2xl font-bold text-gray-900">{formatCurrency(inventorySellingValue)}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600 mb-1">Potential Profit</p>
                        <p className={`text-2xl font-bold ${potentialProfit >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                            {formatCurrency(potentialProfit)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Sales Analytics Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                    <ShoppingBag className="w-5 h-5 text-indigo-600" />
                    <h2 className="text-lg font-semibold text-gray-900">Sales Analytics</h2>
                </div>

                {/* Profit Margin Summary */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-indigo-50 rounded-lg p-4">
                        <p className="text-sm text-indigo-700 mb-1">Total Sales Revenue</p>
                        <p className="text-xl font-bold text-indigo-900">{formatCurrency(totalSalesRevenue)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600 mb-1">Total Cost (COGS)</p>
                        <p className="text-xl font-bold text-gray-900">{formatCurrency(totalSalesCost)}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                        <p className="text-sm text-green-700 mb-1">Sales Profit</p>
                        <p className={`text-xl font-bold ${totalSalesProfit >= 0 ? 'text-green-900' : 'text-danger-600'}`}>
                            {formatCurrency(totalSalesProfit)}
                        </p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4">
                        <p className="text-sm text-blue-700 mb-1">Profit Margin</p>
                        <p className={`text-xl font-bold ${parseFloat(profitMarginPercent) >= 0 ? 'text-blue-900' : 'text-danger-600'}`}>
                            {profitMarginPercent}%
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Sales by Platform */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Revenue by Platform</h3>
                        {platformData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={280}>
                                <PieChart>
                                    <Pie
                                        data={platformData}
                                        dataKey="revenue"
                                        nameKey="platform"
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={100}
                                        label={(entry) => `${entry.platform}: ${formatCurrency(entry.revenue)}`}
                                    >
                                        {platformData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => formatCurrency(value)} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="text-gray-500 text-center py-12">No sales data yet</p>
                        )}
                    </div>

                    {/* Top Products by Revenue */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Top Products by Revenue</h3>
                        {topProductsData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={topProductsData} layout="vertical" margin={{ left: 80 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" tickFormatter={(v) => `₹${v}`} />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        width={75}
                                        tick={{ fontSize: 11 }}
                                    />
                                    <Tooltip formatter={(value) => formatCurrency(value)} />
                                    <Legend />
                                    <Bar dataKey="revenue" fill="#6366f1" name="Revenue" />
                                    <Bar dataKey="profit" fill="#22c55e" name="Profit" />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="text-gray-500 text-center py-12">No product sales data yet</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
