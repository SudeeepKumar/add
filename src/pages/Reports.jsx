import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToTransactions } from '../services/transactionService';
import { subscribeToProducts } from '../services/productService';
import { subscribeToSales } from '../services/salesService';
import { subscribeToReturns } from '../services/returnService';
import { calculateFinancials } from '../services/financialService';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { 
    Download, TrendingUp, TrendingDown, DollarSign, ShoppingBag, 
    ArrowLeftRight, PieChart as PieChartIcon, BarChart2, Package, BookOpen
} from 'lucide-react';
import { formatCurrency } from '../utils/currencyUtils';
import { exportProfitLossPDF, exportToCSV } from '../utils/exportUtils';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import toast from 'react-hot-toast';
import {
    PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, 
    CartesianGrid, Tooltip, Legend, BarChart, Bar
} from 'recharts';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

export const Reports = () => {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState([]);
    const [products, setProducts] = useState([]);
    const [salesData, setSalesData] = useState([]);
    const [returnsData, setReturnsData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    
    const [dateRange, setDateRange] = useState({
        start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
        end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    });

    useEffect(() => {
        if (!user) return;

        let loadingCount = 4;
        const checkLoading = () => {
            loadingCount--;
            if (loadingCount === 0) setLoading(false);
        };

        const unsubTransactions = subscribeToTransactions(user.uid, (data) => {
            setTransactions(data);
            checkLoading();
        });
        const unsubProducts = subscribeToProducts(user.uid, (data) => {
            setProducts(data);
            checkLoading();
        });
        const unsubSales = subscribeToSales(user.uid, (data) => {
            setSalesData(data);
            checkLoading();
        });
        const unsubReturns = subscribeToReturns(user.uid, (data) => {
            setReturnsData(data);
            checkLoading();
        });

        return () => {
            unsubTransactions();
            unsubProducts();
            unsubSales();
            unsubReturns();
        };
    }, [user]);

    // ──────────────────────────────────────────────────────────────
    // 1. DATA FILTERING (Applying Date Range to everything)
    // ──────────────────────────────────────────────────────────────
    
    const { filteredTxns, filteredSales, filteredReturns } = useMemo(() => {
        const start = dateRange.start;
        const end = dateRange.end;

        const filteredTxns = transactions.filter((t) => {
            const d = format(t.date, 'yyyy-MM-dd');
            return d >= start && d <= end;
        });

        const filteredSales = salesData.filter((s) => {
            const d = format(new Date(s.saleDate), 'yyyy-MM-dd');
            return d >= start && d <= end;
        });

        const filteredReturns = returnsData.filter((r) => {
            const d = format(new Date(r.returnDate), 'yyyy-MM-dd');
            return d >= start && d <= end;
        });

        return { filteredTxns, filteredSales, filteredReturns };
    }, [transactions, salesData, returnsData, dateRange]);


    // ──────────────────────────────────────────────────────────────
    // 2. OVERVIEW & FINANCIAL METRICS (Filtered Period)
    // ──────────────────────────────────────────────────────────────
    
    const periodFinancials = useMemo(() => {
        return calculateFinancials({
            transactions: filteredTxns,
            sales: filteredSales,
            returns: filteredReturns,
        });
    }, [filteredTxns, filteredSales, filteredReturns]);
    
    // We still need the detailed category breakdown for the charts
    const { incomeData, expensesData } = useMemo(() => {
        const incomeByCategory = {};
        const expensesByCategory = {};
        
        filteredTxns.forEach((t) => {
            if (t.type === 'income' && t.category !== 'Capital' && t.category !== 'Product Sales' && t.category !== 'Purchase Refund') {
                incomeByCategory[t.category] = (incomeByCategory[t.category] || 0) + t.amount;
            } else if (t.type === 'expense' && t.category !== 'Purchase' && t.category !== 'Sales Refund' && t.category !== 'Drawings') {
                if (!t.category.includes('Return Charges')) {
                    expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + t.amount;
                }
            }
        });
        
        if (periodFinancials.netCOGS > 0) expensesByCategory['Cost of Goods Sold (COGS)'] = periodFinancials.netCOGS;
        if (periodFinancials.salesReturnsRefunds > 0) expensesByCategory['Sales Returns'] = periodFinancials.salesReturnsRefunds;
        
        const sReturnCharges = filteredReturns.filter(r => r.returnType === 'sales').reduce((sum, r) => sum + (Number(r.returnCharges) || 0), 0);
        if (sReturnCharges > 0) expensesByCategory['Sales Return Charges'] = sReturnCharges;
        
        const pReturnCharges = filteredReturns.filter(r => r.returnType === 'purchase').reduce((sum, r) => sum + (Number(r.returnCharges) || 0), 0);
        if (pReturnCharges > 0) expensesByCategory['Purchase Return Charges'] = pReturnCharges;

        return {
            incomeData: Object.entries(incomeByCategory).map(([category, amount]) => ({ category, amount })),
            expensesData: Object.entries(expensesByCategory).map(([category, amount]) => ({ category, amount }))
        };
    }, [filteredTxns, filteredReturns, periodFinancials]);

    // Inventory Valuation (Current Snapshot, not date filtered)
    const { inventoryPurchaseValue } = useMemo(() => {
        const pVal = products.reduce((sum, p) => sum + ((Number(p.quantity) || 0) * (Number(p.purchasePrice) || 0)), 0);
        return {
            inventoryPurchaseValue: pVal
        };
    }, [products]);


    // ──────────────────────────────────────────────────────────────
    // 3. SALES ANALYTICS
    // ──────────────────────────────────────────────────────────────
    
    const { 
        totalSalesRevenue, totalSalesCost, salesProfitMargin, 
        platformData, topProductsData, bottomProductsData 
    } = useMemo(() => {
        let rev = 0;
        let cost = 0;
        const salesByPlatform = {};
        const productMap = {};

        // 1. Add all sales
        filteredSales.forEach(sale => {
            rev += (Number(sale.totalRevenue) || 0);
            cost += (Number(sale.totalCost) || 0);

            const p = sale.platform || 'Other';
            salesByPlatform[p] = (salesByPlatform[p] || 0) + (Number(sale.totalRevenue) || 0);

            (sale.items || []).forEach(item => {
                const key = item.productName || 'Unknown Product';
                if (!productMap[key]) productMap[key] = { revenue: 0, cost: 0, qty: 0 };
                productMap[key].revenue += (Number(item.sellingPrice) || 0) * (Number(item.quantity) || 0);
                productMap[key].cost += (Number(item.purchasePrice) || 0) * (Number(item.quantity) || 0);
                productMap[key].qty += (Number(item.quantity) || 0);
            });
        });

        // 2. Subtract all sales returns to get Net Sales
        // CRITICAL: use ret.refundAmount (the actual amount refunded at time of return),
        // NOT the current product sellingPrice which may have changed since the original sale.
        filteredReturns.forEach(ret => {
            if (ret.returnType === 'sales') {
                // Use stored refundAmount for revenue deduction
                const returnRevenue = Number(ret.refundAmount) || 0;
                // For COGS reversal, use purchasePrice stored on product at time of return
                const product = products.find(prod => prod.id === ret.productId);
                const returnCost = product 
                    ? (Number(product.purchasePrice) || 0) * (Number(ret.quantity) || 0)
                    : 0;

                rev -= returnRevenue;
                cost -= returnCost;

                const key = ret.productName || 'Unknown Product';
                if (productMap[key]) {
                    productMap[key].revenue -= returnRevenue;
                    productMap[key].cost -= returnCost;
                    productMap[key].qty -= (Number(ret.quantity) || 0);
                }

                let platform = 'Unknown';
                if (ret.saleId) {
                    const sale = salesData.find(s => s.id === ret.saleId);
                    if (sale) platform = sale.platform;
                } else if (ret.orderId) {
                    const sale = salesData.find(s => s.orderId === ret.orderId);
                    if (sale) platform = sale.platform;
                }
                salesByPlatform[platform] = (Number(salesByPlatform[platform]) || 0) - returnRevenue;
            }
        });

        const platData = Object.entries(salesByPlatform)
            .map(([platform, revenue]) => ({ platform, revenue }))
            .sort((a, b) => b.revenue - a.revenue);

        const prodArr = Object.entries(productMap)
            .map(([name, data]) => ({ name, ...data, profit: data.revenue - data.cost }))
            .sort((a, b) => b.revenue - a.revenue);

        return {
            totalSalesRevenue: rev,
            totalSalesCost: cost,
            salesProfitMargin: rev > 0 ? ((rev - cost) / rev) * 100 : 0,
            platformData: platData,
            topProductsData: prodArr.slice(0, 5),
            bottomProductsData: [...prodArr].reverse().slice(0, 5).filter(p => p.revenue > 0)
        };
    }, [filteredSales, filteredReturns, products, salesData]);


    // ──────────────────────────────────────────────────────────────
    // 4. RETURNS ANALYTICS
    // ──────────────────────────────────────────────────────────────
    
    const { returnsByPlatform, returnsSummary, topReturnedProducts } = useMemo(() => {
        const platMap = {};
        const productReturnMap = {};
        let totalSalesReturnCharges = 0;
        let totalPurchaseRefunds = 0;
        let salesReturnCount = 0;
        let purchaseReturnCount = 0;

        filteredReturns.forEach(r => {
            if (r.returnType === 'sales') {
                salesReturnCount += (r.quantity || 1);
                totalSalesReturnCharges += r.returnCharges || 0;
                
                // Try to find the platform from the original sale
                let platform = 'Unknown';
                if (r.saleId) {
                    const sale = salesData.find(s => s.id === r.saleId);
                    if (sale) platform = sale.platform;
                } else if (r.orderId) {
                    const sale = salesData.find(s => s.orderId === r.orderId);
                    if (sale) platform = sale.platform;
                }

                platMap[platform] = (platMap[platform] || 0) + 1;
                
                // Track returned product quantity
                const prodName = r.productName || 'Unknown Product';
                productReturnMap[prodName] = (productReturnMap[prodName] || 0) + (r.quantity || 1);
                
            } else {
                purchaseReturnCount += (r.quantity || 1);
                totalPurchaseRefunds += r.returnCharges || 0;
            }
        });
        
        const topReturned = Object.entries(productReturnMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        return {
            returnsByPlatform: Object.entries(platMap).map(([platform, count]) => ({ platform, count })),
            returnsSummary: {
                salesReturnCount,
                purchaseReturnCount,
                totalSalesReturnCharges,
                totalPurchaseRefunds
            },
            topReturnedProducts: topReturned
        };
    }, [filteredReturns, salesData]);


    // ──────────────────────────────────────────────────────────────
    // 5. MONTHLY TREND (6 Months, unaffected by Date Picker)
    // ──────────────────────────────────────────────────────────────
    const monthlyData = useMemo(() => {
        const data = [];
        for (let i = 5; i >= 0; i--) {
            const date = subDays(new Date(), i * 30);
            const monthStart = startOfMonth(date);
            const monthEnd = endOfMonth(date);

            const mTxns = transactions.filter((t) => t.date >= monthStart && t.date <= monthEnd);
            const mIncome = mTxns
                .filter(t => t.type === 'income')
                .reduce((s, t) => s + t.amount, 0);
            // Exclude 'Purchase' from expense — purchases are assets, not operating costs.
            // They distort the trend chart with inventory restock spikes.
            const mExpense = mTxns
                .filter(t => t.type === 'expense' && t.category !== 'Purchase')
                .reduce((s, t) => s + t.amount, 0);

            data.push({
                month: format(date, 'MMM'),
                income: mIncome,
                expenses: mExpense,
                profit: mIncome - mExpense,
            });
        }
        return data;
    }, [transactions]);


    // ──────────────────────────────────────────────────────────────
    // 6. FINANCIAL STATEMENTS (Tally-Style)
    // ──────────────────────────────────────────────────────────────
    const tallyData = useMemo(() => {
        const endStr = dateRange.end;
        const upToEndTxns = transactions.filter(t => format(t.date, 'yyyy-MM-dd') <= endStr);
        const upToEndSales = salesData.filter(s => format(new Date(s.saleDate), 'yyyy-MM-dd') <= endStr);
        const upToEndReturns = returnsData.filter(r => format(new Date(r.returnDate), 'yyyy-MM-dd') <= endStr);

        const asOfDateFinancials = calculateFinancials({
            transactions: upToEndTxns,
            sales: upToEndSales,
            returns: upToEndReturns,
        });
        
        // For Trading & P&L we still need the breakdown
        let operatingExpensesBreakdown = {};
        let miscIncomesBreakdown = {};
        
        filteredTxns.forEach(t => {
            if (t.type === 'expense' && t.category !== 'Purchase' && t.category !== 'Sales Refund' && t.category !== 'Drawings' && !t.category.includes('Return Charges')) {
                operatingExpensesBreakdown[t.category] = (operatingExpensesBreakdown[t.category] || 0) + t.amount;
            } else if (t.type === 'income' && t.category !== 'Product Sales' && t.category !== 'Capital') {
                miscIncomesBreakdown[t.category] = (miscIncomesBreakdown[t.category] || 0) + t.amount;
            }
        });
        
        const pSalesReturnCharges = filteredReturns.filter(r => r.returnType === 'sales').reduce((sum, r) => sum + (Number(r.returnCharges) || 0), 0);
        if (pSalesReturnCharges > 0) operatingExpensesBreakdown['Sales Return Charges'] = pSalesReturnCharges;
        
        const pPurchaseReturnCharges = filteredReturns.filter(r => r.returnType === 'purchase').reduce((sum, r) => sum + (Number(r.returnCharges) || 0), 0);
        if (pPurchaseReturnCharges > 0) operatingExpensesBreakdown['Purchase Return Charges'] = pPurchaseReturnCharges;

        // Extract values from periodFinancials for P&L
        const { 
            grossSales, salesReturnsRefunds, netSales, totalPurchases: grossPurchases, 
            purchaseReturnsRefunds: purchaseReturns,
            operatingExpenses, otherIncome: miscIncomes, netProfit: netProfitFin 
        } = periodFinancials;
        
        const netPurchases = grossPurchases - purchaseReturns;
        
        const openingStock = 0; // Simplified for now
        const closingStock = periodFinancials.historicalInventoryValue;

        // Extract values from asOfDateFinancials for Balance Sheet
        const {
            historicalInventoryValue, cashBalance, totalAssets, currentLiabilities,
            capitalIntroduced, drawings, equity, isBalanced, balanceDifference
        } = asOfDateFinancials;
        
        // Use historical inventory for the balance sheet closing stock
        const balanceSheetClosingStock = historicalInventoryValue;

        return {
            // P&L Metrics
            openingStock, grossPurchases, purchaseReturns, netPurchases,
            grossSales, salesReturnsRefunds, netSales,
            closingStock,
            operatingExpenses, operatingExpensesBreakdown, 
            miscIncomes, miscIncomesBreakdown, netProfitFin,
            // Balance Sheet Metrics
            cashBalance, totalAssets, currentLiabilities, 
            retainedEarnings: asOfDateFinancials.netProfit,
            capitalIntroduced, drawings, equity, balanceSheetClosingStock,
            isBalanced, balanceDifference
        };
    }, [filteredTxns, filteredReturns, transactions, returnsData, salesData, periodFinancials]);


    // ──────────────────────────────────────────────────────────────
    // EXPORTS
    // ──────────────────────────────────────────────────────────────

    const handleExportPDF = async () => {
        try {
            // For P&L, keep the highly formatted specific PDF
            if (activeTab === 'pnl') {
                exportProfitLossPDF({ 
                    income: incomeData, 
                    expenses: expensesData, 
                    totalIncome: periodFinancials.grossSales, 
                    totalExpenses: periodFinancials.operatingExpenses 
                }, dateRange);
                toast.success('PDF exported successfully');
                return;
            }

            // For all other tabs, capture exactly what's on screen
            const element = document.getElementById('report-content-area');
            if (!element) return;

            toast.loading('Generating PDF...', { id: 'pdf-toast' });

            const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#f9fafb' });
            const imgData = canvas.toDataURL('image/png');

            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            let position = 0;
            let heightLeft = pdfHeight;
            const pageHeight = pdf.internal.pageSize.getHeight();

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
            heightLeft -= pageHeight;

            while (heightLeft >= 0) {
                position = heightLeft - pdfHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
                heightLeft -= pageHeight;
            }

            pdf.save(`billji-${activeTab}-report-${dateRange.start}.pdf`);
            toast.success('Report downloaded successfully!', { id: 'pdf-toast' });

        } catch (error) {
            console.error(error);
            toast.error('Failed to generate report PDF', { id: 'pdf-toast' });
        }
    };

    const handleExportCSV = () => {
        try {
            const csvData = filteredTxns.map((t) => ({
                Date: format(t.date, 'yyyy-MM-dd'),
                Type: t.type,
                Category: t.category,
                Amount: t.amount,
                Description: t.description || '',
            }));
            exportToCSV(csvData, `transactions-${dateRange.start}-to-${dateRange.end}`);
            toast.success('CSV exported successfully');
        } catch (error) {
            toast.error('Failed to export CSV');
        }
    };


    if (loading) return <div className="flex items-center justify-center h-full"><LoadingSpinner size="lg" /></div>;

    return (
        <div className="space-y-6">
            {/* Header & Export */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
                    <p className="text-gray-600 mt-1">Deep insights into your business performance</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={handleExportPDF} variant="outline" className="flex items-center gap-2"><Download size={18} /> PDF</Button>
                    <Button onClick={handleExportCSV} variant="outline" className="flex items-center gap-2"><Download size={18} /> CSV</Button>
                </div>
            </div>

            {/* Global Date Filter */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                        <input type="date" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} className="input" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                        <input type="date" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} className="input" />
                    </div>
                    <div className="md:col-span-2 flex gap-2">
                        <Button onClick={() => setDateRange({ start: format(startOfMonth(new Date()), 'yyyy-MM-dd'), end: format(endOfMonth(new Date()), 'yyyy-MM-dd') })} variant="secondary" size="sm">This Month</Button>
                        <Button onClick={() => setDateRange({ start: format(subDays(new Date(), 30), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd') })} variant="secondary" size="sm">Last 30 Days</Button>
                        <Button onClick={() => setDateRange({ start: '2000-01-01', end: '2099-12-31' })} variant="secondary" size="sm">All Time</Button>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
                {[
                    { id: 'overview', icon: PieChartIcon, label: 'Overview' },
                    { id: 'sales', icon: ShoppingBag, label: 'Sales' },
                    { id: 'returns', icon: ArrowLeftRight, label: 'Returns' },
                    { id: 'pnl', icon: DollarSign, label: 'Profit & Loss' },
                    { id: 'financials', icon: BookOpen, label: 'Financials (Tally)' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                            activeTab === tab.id ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Contents */}
            <div id="report-content-area" className="mt-6 bg-gray-50/50 p-2 rounded-xl">
                
                {/* ──────────────── OVERVIEW TAB ──────────────── */}
                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-medium text-gray-600">Gross Revenue</h3>
                                    <TrendingUp className="w-8 h-8 text-success-600" />
                                </div>
                                <p className="text-3xl font-bold text-gray-900">{formatCurrency(periodFinancials.grossSales)}</p>
                            </div>
                            <div className="bg-white rounded-xl shadow-sm border border-red-100 p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-medium text-gray-600">Less: Sales Returns</h3>
                                    <ArrowLeftRight className="w-8 h-8 text-red-400" />
                                </div>
                                <p className="text-3xl font-bold text-red-600">({formatCurrency(periodFinancials.salesReturnsRefunds)})</p>
                                <p className="text-xs text-gray-400 mt-1">Net Revenue: {formatCurrency(periodFinancials.netSales)}</p>
                            </div>
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-medium text-gray-600">Total Costs (Expenses)</h3>
                                    <TrendingDown className="w-8 h-8 text-danger-600" />
                                </div>
                                <p className="text-3xl font-bold text-gray-900">{formatCurrency(periodFinancials.operatingExpenses)}</p>
                            </div>
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-medium text-gray-600">Net {periodFinancials.netProfit >= 0 ? 'Profit' : 'Loss'}</h3>
                                    <DollarSign className={`w-8 h-8 ${periodFinancials.netProfit >= 0 ? 'text-primary-600' : 'text-danger-600'}`} />
                                </div>
                                <p className={`text-3xl font-bold ${periodFinancials.netProfit >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                                    {formatCurrency(Math.abs(periodFinancials.netProfit))}
                                </p>
                            </div>
                        </div>


                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Trend Graph */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 lg:col-span-2">
                                <h2 className="text-lg font-semibold text-gray-900 mb-4">6-Month Trend</h2>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={monthlyData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="month" />
                                        <YAxis tickFormatter={(value) => `₹${value}`} />
                                        <Tooltip formatter={(value) => formatCurrency(value)} cursor={{ fill: 'transparent' }} />
                                        <Legend />
                                        <Bar dataKey="income" fill="#22c55e" name="Income" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="expenses" fill="#ef4444" name="Expenses" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Assets / Inventory */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between">
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                        <Package className="w-5 h-5 text-indigo-600" />
                                        Business Assets
                                    </h2>
                                    <p className="text-sm text-gray-500 mb-6">Current snapshot of your inventory valuation.</p>
                                    
                                    <div className="space-y-4">
                                        <div className="p-4 bg-gray-50 rounded-lg">
                                            <p className="text-sm text-gray-600 mb-1">Inventory Value (Cost)</p>
                                            <p className="text-xl font-bold text-gray-900">{formatCurrency(inventoryPurchaseValue)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}


                {/* ──────────────── SALES TAB ──────────────── */}
                {activeTab === 'sales' && (
                    <div className="space-y-6">
                        {/* Sales Margin Summary */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-indigo-50 rounded-xl p-5 border border-indigo-100">
                                <p className="text-sm font-medium text-indigo-700 mb-1">Gross Sales Revenue</p>
                                <p className="text-2xl font-bold text-indigo-900">{formatCurrency(totalSalesRevenue)}</p>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                                <p className="text-sm font-medium text-gray-600 mb-1">Cost of Goods Sold</p>
                                <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalSalesCost)}</p>
                            </div>
                            <div className="bg-green-50 rounded-xl p-5 border border-green-100">
                                <p className="text-sm font-medium text-green-700 mb-1">Gross Sales Profit</p>
                                <p className="text-2xl font-bold text-green-900">
                                    {formatCurrency(totalSalesRevenue - totalSalesCost)}
                                </p>
                            </div>
                            <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
                                <p className="text-sm font-medium text-blue-700 mb-1">Sales Margin %</p>
                                <p className="text-2xl font-bold text-blue-900">
                                    {salesProfitMargin.toFixed(1)}%
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Platform Sales */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Platform</h3>
                                {platformData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie
                                                data={platformData}
                                                dataKey="revenue"
                                                nameKey="platform"
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={100}
                                                paddingAngle={5}
                                                label={(entry) => `${entry.platform} (${formatCurrency(entry.revenue)})`}
                                            >
                                                {platformData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(value) => formatCurrency(value)} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <p className="text-gray-500 text-center py-12">No sales data for this period.</p>
                                )}
                            </div>

                            {/* Top Products */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 5 Products</h3>
                                {topProductsData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={topProductsData} layout="vertical" margin={{ left: 80, right: 20 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                            <XAxis type="number" tickFormatter={(v) => `₹${v}`} />
                                            <YAxis type="category" dataKey="name" width={75} tick={{ fontSize: 11 }} />
                                            <Tooltip formatter={(value) => formatCurrency(value)} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                                            <Legend />
                                            <Bar dataKey="revenue" fill="#6366f1" name="Revenue" radius={[0, 4, 4, 0]} />
                                            <Bar dataKey="profit" fill="#22c55e" name="Profit" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <p className="text-gray-500 text-center py-12">No product data for this period.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}


                {/* ──────────────── RETURNS TAB ──────────────── */}
                {activeTab === 'returns' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-red-50 rounded-xl p-6 border border-red-100">
                                <h3 className="text-red-800 font-semibold mb-4 flex items-center gap-2">
                                    <TrendingDown className="w-5 h-5" /> Sales Returns (Customer → You)
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center border-b border-red-200 pb-2">
                                        <span className="text-red-700">Total Items Returned</span>
                                        <span className="font-bold text-red-900">{returnsSummary.salesReturnCount}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-red-700">Total Penalties/Fees Paid</span>
                                        <span className="font-bold text-red-900">{formatCurrency(returnsSummary.totalSalesReturnCharges)}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-orange-50 rounded-xl p-6 border border-orange-100">
                                <h3 className="text-orange-800 font-semibold mb-4 flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5" /> Purchase Returns (You → Supplier)
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center border-b border-orange-200 pb-2">
                                        <span className="text-orange-700">Total Items Returned</span>
                                        <span className="font-bold text-orange-900">{returnsSummary.purchaseReturnCount}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-orange-700">Total Refunds Received</span>
                                        <span className="font-bold text-orange-900">{formatCurrency(returnsSummary.totalPurchaseRefunds)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Sales Returns by Platform</h3>
                                {returnsByPlatform.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie
                                                data={returnsByPlatform}
                                                dataKey="count"
                                                nameKey="platform"
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={100}
                                                label={(entry) => `${entry.platform} (${entry.count} returns)`}
                                            >
                                                {returnsByPlatform.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(value) => `${value} Returns`} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <p className="text-gray-500 text-center py-12">No sales returns found for this period.</p>
                                )}
                            </div>

                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Most Returned Products</h3>
                                {topReturnedProducts && topReturnedProducts.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={topReturnedProducts} layout="vertical" margin={{ left: 80, right: 20 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                            <XAxis type="number" allowDecimals={false} />
                                            <YAxis type="category" dataKey="name" width={75} tick={{ fontSize: 11 }} />
                                            <Tooltip formatter={(value) => `${value} units`} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                                            <Legend />
                                            <Bar dataKey="count" fill="#ef4444" name="Quantity Returned" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <p className="text-gray-500 text-center py-12">No product returns data for this period.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}


                {/* ──────────────── P&L TAB ──────────────── */}
                {activeTab === 'pnl' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Income Sources</h2>
                            {incomeData.length > 0 ? (
                                <>
                                    <ResponsiveContainer width="100%" height={250}>
                                        <PieChart>
                                            <Pie data={incomeData} dataKey="amount" nameKey="category" cx="50%" cy="50%" outerRadius={80}>
                                                {incomeData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip formatter={(value) => formatCurrency(value)} />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="mt-4 border-t border-gray-100 pt-4">
                                        {incomeData.sort((a,b)=>b.amount-a.amount).map(item => (
                                            <div key={item.category} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                                                <span className="text-gray-600">{item.category}</span>
                                                <span className="font-medium text-gray-900">{formatCurrency(item.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <p className="text-gray-500 text-center py-12">No income data</p>
                            )}
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Expenses Breakdown</h2>
                            {expensesData.length > 0 ? (
                                <>
                                    <ResponsiveContainer width="100%" height={250}>
                                        <PieChart>
                                            <Pie data={expensesData} dataKey="amount" nameKey="category" cx="50%" cy="50%" outerRadius={80}>
                                                {expensesData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip formatter={(value) => formatCurrency(value)} />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="mt-4 border-t border-gray-100 pt-4">
                                        {expensesData.sort((a,b)=>b.amount-a.amount).map(item => (
                                            <div key={item.category} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                                                <span className="text-gray-600">{item.category}</span>
                                                <span className="font-medium text-gray-900">{formatCurrency(item.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <p className="text-gray-500 text-center py-12">No expense data</p>
                            )}
                        </div>
                    </div>
                )}

                {/* ──────────────── FINANCIALS (TALLY) TAB ──────────────── */}
                {activeTab === 'financials' && (
                    <div className="space-y-8">
                        {/* Profit & Loss Account */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                                <h2 className="text-xl font-bold text-gray-900 text-center">Profit & Loss Account (Accrual-Basis)</h2>
                                <p className="text-sm text-gray-500 text-center">For the selected period: {format(new Date(dateRange.start), 'dd MMM yyyy')} to {format(new Date(dateRange.end), 'dd MMM yyyy')}</p>
                            </div>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-200">
                                {/* Debit Side (Expenses) */}
                                <div className="p-0">
                                    <div className="flex justify-between bg-gray-100 px-4 py-2 font-semibold text-gray-700 text-sm border-b border-gray-200">
                                        <span>Expenses (Dr.)</span>
                                        <span>Amount (₹)</span>
                                    </div>
                                    <div className="p-4 space-y-3">
                                        <div className="flex justify-between text-gray-800">
                                            <span>To Purchases A/c</span>
                                            <span>{formatCurrency(tallyData.grossPurchases).replace('₹', '')}</span>
                                        </div>
                                        <div className="flex justify-between text-gray-600 pl-4 text-sm">
                                            <span>Less: Purchase Returns</span>
                                            <span>({formatCurrency(tallyData.purchaseReturns).replace('₹', '')})</span>
                                        </div>
                                        <div className="flex justify-between font-medium text-gray-900 border-b border-gray-100 pb-2">
                                            <span className="pl-6">Net Purchases</span>
                                            <span>{formatCurrency(tallyData.netPurchases).replace('₹', '')}</span>
                                        </div>
                                        
                                        <div className="pt-2">
                                            <div className="font-semibold text-gray-900 mb-2">Operating Expenses</div>
                                            {Object.entries(tallyData.operatingExpensesBreakdown).length > 0 ? (
                                                Object.entries(tallyData.operatingExpensesBreakdown).map(([category, amount]) => (
                                                    <div key={category} className="flex justify-between text-gray-600 pl-4 text-sm mb-1">
                                                        <span>To {category} A/c</span>
                                                        <span>{formatCurrency(amount).replace('₹', '')}</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="flex justify-between text-gray-400 pl-4 text-sm mb-1">
                                                    <span>No Expenses</span>
                                                    <span>0.00</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between font-medium text-gray-900 border-t border-gray-100 pt-2 mt-2">
                                                <span className="pl-6">Total Expenses</span>
                                                <span>{formatCurrency(tallyData.operatingExpenses).replace('₹', '')}</span>
                                            </div>
                                        </div>
                                        
                                        {tallyData.netProfitFin > 0 && (
                                            <div className="flex justify-between font-bold text-gray-900 pt-8 border-t-2 border-gray-300 mt-4">
                                                <span>To Net Profit (transferred to Capital)</span>
                                                <span>{formatCurrency(tallyData.netProfitFin).replace('₹', '')}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Credit Side (Income / Revenue) */}
                                <div className="p-0">
                                    <div className="flex justify-between bg-gray-100 px-4 py-2 font-semibold text-gray-700 text-sm border-b border-gray-200">
                                        <span>Income (Cr.)</span>
                                        <span>Amount (₹)</span>
                                    </div>
                                    <div className="p-4 space-y-3">
                                        <div className="flex justify-between text-gray-800">
                                            <span>By Sales A/c</span>
                                            <span>{formatCurrency(tallyData.grossSales).replace('₹', '')}</span>
                                        </div>
                                        <div className="flex justify-between text-gray-600 pl-4 text-sm">
                                            <span>Less: Sales Returns</span>
                                            <span>{formatCurrency(tallyData.salesReturnsRefunds).replace('₹', '')}</span>
                                        </div>
                                        <div className="flex justify-between font-medium text-gray-900 border-b border-gray-100 pb-2">
                                            <span className="pl-6">Net Sales</span>
                                            <span>{formatCurrency(tallyData.netSales).replace('₹', '')}</span>
                                        </div>
                                        
                                        <div className="flex justify-between text-gray-800 pt-2 pb-2 border-b border-gray-100">
                                            <span>By Closing Stock</span>
                                            <span>{formatCurrency(tallyData.closingStock).replace('₹', '')}</span>
                                        </div>
                                        
                                        {tallyData.miscIncomes > 0 && (
                                            <div className="pt-2">
                                                <div className="font-semibold text-gray-900 mb-2">Other Incomes</div>
                                                {Object.entries(tallyData.miscIncomesBreakdown).map(([category, amount]) => (
                                                    <div key={category} className="flex justify-between text-gray-600 pl-4 text-sm mb-1">
                                                        <span>By {category} A/c</span>
                                                        <span>{formatCurrency(amount).replace('₹', '')}</span>
                                                    </div>
                                                ))}
                                                <div className="flex justify-between font-medium text-gray-900 border-t border-gray-100 pt-2 mt-2">
                                                    <span className="pl-6">Total Misc Income</span>
                                                    <span>{formatCurrency(tallyData.miscIncomes).replace('₹', '')}</span>
                                                </div>
                                            </div>
                                        )}
                                        
                                        {tallyData.netProfitFin < 0 && (
                                            <div className="flex justify-between font-bold text-gray-900 pt-8 border-t-2 border-gray-300 mt-4">
                                                <span>By Net Loss (transferred to Capital)</span>
                                                <span>{formatCurrency(Math.abs(tallyData.netProfitFin)).replace('₹', '')}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Balance Sheet */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                                <h2 className="text-xl font-bold text-gray-900 text-center">Balance Sheet</h2>
                                <p className="text-sm text-gray-500 text-center">As of {format(new Date(dateRange.end), 'dd MMM yyyy')}</p>
                            </div>
                            
                            {!tallyData.isBalanced && (
                                <div className="bg-red-50 border-b border-red-200 px-6 py-3">
                                    <p className="text-red-700 font-medium text-center">
                                        ⚠️ Financial data reconciliation error. Difference: ₹{tallyData.balanceDifference.toFixed(2)}
                                    </p>
                                </div>
                            )}
                            
                            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-200">
                                {/* Liabilities Side */}
                                <div className="p-0 flex flex-col h-full">
                                    <div className="flex justify-between bg-gray-100 px-4 py-2 font-semibold text-gray-700 text-sm border-b border-gray-200">
                                        <span>Liabilities</span>
                                        <span>Amount (₹)</span>
                                    </div>
                                    <div className="p-4 space-y-3 flex-grow">
                                        <div className="flex justify-between font-bold text-gray-900">
                                            <span>Capital Account</span>
                                            <span></span>
                                        </div>
                                        <div className="flex justify-between text-gray-800 pl-4">
                                            <span>Capital Introduced</span>
                                            <span>{formatCurrency(tallyData.capitalIntroduced).replace('₹', '')}</span>
                                        </div>
                                        <div className="flex justify-between text-gray-800 pl-4">
                                            <span>Add: Net Profit</span>
                                            <span>{formatCurrency(tallyData.retainedEarnings).replace('₹', '')}</span>
                                        </div>
                                        <div className="flex justify-between text-gray-800 pl-4">
                                            <span>Less: Drawings</span>
                                            <span>{formatCurrency(tallyData.drawings).replace('₹', '')}</span>
                                        </div>
                                        <div className="flex justify-between font-bold text-gray-900 border-t border-gray-100 pt-2 mt-2">
                                            <span className="pl-6">Total Equity</span>
                                            <span>{formatCurrency(tallyData.equity).replace('₹', '')}</span>
                                        </div>
                                        
                                        {tallyData.currentLiabilities > 0 && (
                                            <>
                                                <div className="flex justify-between font-bold text-gray-900 mt-6 pt-4 border-t border-gray-100">
                                                    <span>Current Liabilities</span>
                                                    <span>{formatCurrency(tallyData.currentLiabilities).replace('₹', '')}</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <div className="flex justify-between bg-gray-50 p-4 font-bold text-lg text-gray-900 border-t-2 border-b-2 border-gray-800 mt-auto">
                                        <span>Total</span>
                                        <span>{formatCurrency(tallyData.equity + tallyData.currentLiabilities).replace('₹', '')}</span>
                                    </div>
                                </div>

                                {/* Assets Side */}
                                <div className="p-0 flex flex-col h-full">
                                    <div className="flex justify-between bg-gray-100 px-4 py-2 font-semibold text-gray-700 text-sm border-b border-gray-200">
                                        <span>Assets</span>
                                        <span>Amount (₹)</span>
                                    </div>
                                    <div className="p-4 space-y-3 flex-grow">
                                        <div className="flex justify-between font-bold text-gray-900">
                                            <span>Current Assets</span>
                                            <span></span>
                                        </div>
                                        <div className="flex justify-between text-gray-800 pl-4">
                                            <span>Closing Stock (Inventory Value)</span>
                                            <span>{formatCurrency(tallyData.balanceSheetClosingStock).replace('₹', '')}</span>
                                        </div>
                                        <div className="flex justify-between text-gray-800 pl-4">
                                            <span>Cash / Bank Balance</span>
                                            <span>{formatCurrency(tallyData.cashBalance).replace('₹', '')}</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between bg-gray-50 p-4 font-bold text-lg text-gray-900 border-t-2 border-b-2 border-gray-800 mt-auto">
                                        <span>Total</span>
                                        <span>{formatCurrency(tallyData.totalAssets).replace('₹', '')}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
