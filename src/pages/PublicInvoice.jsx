import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { exportInvoicePDF } from '../utils/exportUtils';
import { Download, FileText, AlertCircle, Phone } from 'lucide-react';

export const PublicInvoice = () => {
    const { invoiceId } = useParams();
    const [invoice, setInvoice] = useState(null);
    const [businessSettings, setBusinessSettings] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchInvoice = async () => {
            try {
                const docRef = doc(db, 'invoices', invoiceId);
                const docSnap = await getDoc(docRef);

                if (!docSnap.exists()) {
                    setError('Invoice not found');
                    setLoading(false);
                    return;
                }

                const data = docSnap.data();
                const invoiceData = {
                    id: docSnap.id,
                    ...data,
                    date: data.date?.toDate?.() || new Date(data.date),
                    dueDate: data.dueDate?.toDate?.() || new Date(data.dueDate),
                };
                setInvoice(invoiceData);

                // Fetch business settings for this invoice's owner
                if (data.userId) {
                    const settingsRef = doc(db, 'businessSettings', data.userId);
                    const settingsSnap = await getDoc(settingsRef);
                    if (settingsSnap.exists()) {
                        setBusinessSettings(settingsSnap.data());
                    }
                }

                setLoading(false);
            } catch (err) {
                console.error('Error fetching invoice:', err);
                setError('Unable to load this invoice');
                setLoading(false);
            }
        };

        if (invoiceId) {
            fetchInvoice();
        }
    }, [invoiceId]);

    const handleDownloadPDF = () => {
        if (invoice) {
            exportInvoicePDF(invoice, businessSettings);
        }
    };

    const formatDate = (d) => {
        if (!d) return '';
        const date = d instanceof Date ? d : new Date(d);
        return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const formatMoney = (v) => {
        const n = parseFloat(v) || 0;
        return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // Loading State
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600 text-lg">Loading invoice...</p>
                </div>
            </div>
        );
    }

    // Error State
    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-10 h-10 text-red-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Invoice Not Found</h1>
                    <p className="text-gray-600">{error}. The link may have expired or is invalid.</p>
                </div>
            </div>
        );
    }

    const statusColor = invoice.status === 'paid'
        ? 'bg-green-100 text-green-800 border-green-200'
        : invoice.status === 'overdue'
            ? 'bg-red-100 text-red-800 border-red-200'
            : 'bg-orange-100 text-orange-800 border-orange-200';

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 py-8 px-4">
            {/* Download Bar */}
            <div className="max-w-3xl mx-auto mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                        <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-gray-900">
                            {businessSettings.businessName || 'Invoice'}
                        </h1>
                        <p className="text-xs text-gray-500">{invoice.invoiceNumber}</p>
                    </div>
                </div>
                <button
                    onClick={handleDownloadPDF}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition-all duration-200 shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/30 active:scale-95"
                >
                    <Download size={18} />
                    Download PDF
                </button>
            </div>

            {/* Invoice Card */}
            <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
                {/* Header Blue Bar */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold text-white">
                                {businessSettings.businessName || 'BILLJI'}
                            </h2>
                            <p className="text-blue-200 text-sm mt-1">Powered By BILLJI</p>
                        </div>
                        <div className="text-right">
                            <span className="text-3xl font-bold text-white tracking-wide">INVOICE</span>
                        </div>
                    </div>
                </div>

                <div className="px-8 py-6 space-y-6">
                    {/* From & Invoice Details Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* From Box */}
                        <div className="bg-gray-50 rounded-xl p-5">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">From</p>
                            <p className="font-bold text-gray-900 text-lg">
                                {businessSettings.businessName || 'BILLJI'}
                            </p>
                            {businessSettings.address && (
                                <p className="text-sm text-gray-600 mt-1">{businessSettings.address}</p>
                            )}
                            {businessSettings.email && (
                                <p className="text-sm text-gray-600 mt-1">{businessSettings.email}</p>
                            )}
                            {businessSettings.gstNumber && (
                                <p className="text-sm text-gray-600 mt-1">GST: {businessSettings.gstNumber}</p>
                            )}
                        </div>

                        {/* Invoice Details Box */}
                        <div className="bg-gray-50 rounded-xl p-5">
                            <div className="space-y-3">
                                <div>
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Invoice #</p>
                                    <p className="font-medium text-gray-900">{invoice.invoiceNumber}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</p>
                                        <p className="text-sm text-gray-900">{formatDate(invoice.date)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Due Date</p>
                                        <p className="text-sm text-gray-900">{formatDate(invoice.dueDate)}</p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</p>
                                    <span className={`inline-block mt-1 px-3 py-1 text-xs font-semibold rounded-full border ${statusColor}`}>
                                        {invoice.status?.toUpperCase()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bill To */}
                    <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
                        <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">Bill To</p>
                        <p className="font-bold text-gray-900 text-lg">{invoice.customerName}</p>
                        {invoice.customerPhone && (
                            <p className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                                <Phone size={14} className="text-gray-400" />
                                {invoice.customerPhone}
                            </p>
                        )}
                        {invoice.customerEmail && (
                            <p className="text-sm text-gray-600 mt-1">{invoice.customerEmail}</p>
                        )}
                    </div>

                    {/* Items Table */}
                    <div className="overflow-hidden rounded-xl border border-gray-200">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-800 text-white">
                                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider">Description</th>
                                    <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider">Qty</th>
                                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider">Unit Price</th>
                                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider">Discount</th>
                                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {invoice.items?.map((item, index) => {
                                    const itemTotal = (item.quantity * item.price) - (item.discount || 0);
                                    return (
                                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                            <td className="px-5 py-3.5 text-sm text-gray-900">{item.description}</td>
                                            <td className="px-5 py-3.5 text-sm text-gray-600 text-center">{item.quantity}</td>
                                            <td className="px-5 py-3.5 text-sm text-gray-600 text-right">{formatMoney(item.price)}</td>
                                            <td className="px-5 py-3.5 text-sm text-gray-600 text-right">
                                                {item.discount ? formatMoney(item.discount) : '—'}
                                            </td>
                                            <td className="px-5 py-3.5 text-sm font-medium text-gray-900 text-right">
                                                {formatMoney(itemTotal)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Totals */}
                    <div className="flex justify-end">
                        <div className="w-full max-w-xs space-y-2">
                            <div className="flex justify-between text-sm bg-gray-50 rounded-lg px-4 py-2.5">
                                <span className="text-gray-600">Subtotal</span>
                                <span className="font-medium text-gray-900">{formatMoney(invoice.subtotal)}</span>
                            </div>
                            <div className="flex justify-between text-sm bg-gray-50 rounded-lg px-4 py-2.5">
                                <span className="text-gray-600">GST ({invoice.gstRate || 0}%)</span>
                                <span className="font-medium text-gray-900">{formatMoney(invoice.gstAmount)}</span>
                            </div>
                            <div className="flex justify-between bg-blue-600 text-white rounded-xl px-4 py-3">
                                <span className="font-bold text-lg">TOTAL</span>
                                <span className="font-bold text-lg">{formatMoney(invoice.total)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Notes */}
                    {invoice.notes && invoice.notes.trim() && (
                        <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-5">
                            <p className="text-xs font-semibold text-yellow-600 uppercase tracking-wider mb-2">Notes</p>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-gray-50 border-t border-gray-200 px-8 py-5 text-center space-y-1">
                    <p className="text-sm text-gray-500 italic">Thank you for your business!</p>
                    <p className="text-xs text-gray-400 font-semibold">Maintained By PANDA STUDIOS</p>
                    <p className="text-xs text-gray-400">A Product Of Sudeepta Kumar Panda</p>
                </div>
            </div>

            {/* Bottom Download Button (mobile-friendly) */}
            <div className="max-w-3xl mx-auto mt-6 text-center">
                <button
                    onClick={handleDownloadPDF}
                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-medium transition-all duration-200 shadow-lg shadow-blue-600/25 hover:shadow-xl active:scale-95"
                >
                    <Download size={20} />
                    Download Invoice PDF
                </button>
            </div>
        </div>
    );
};
