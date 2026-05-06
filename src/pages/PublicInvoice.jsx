import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { exportInvoicePDF } from '../utils/exportUtils';
import { Download, FileText, AlertCircle, Phone, Mail, MapPin, Hash } from 'lucide-react';

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
        return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // Loading State
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
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
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : invoice.status === 'overdue'
            ? 'bg-red-50 text-red-700 border-red-200'
            : 'bg-amber-50 text-amber-700 border-amber-200';

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50/50 to-slate-100 py-8 px-4">
            {/* Download Bar */}
            <div className="max-w-[800px] mx-auto mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#1a2342] rounded-xl flex items-center justify-center shadow-lg">
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
                    className="flex items-center gap-2 bg-[#1a2342] hover:bg-[#253060] text-white px-5 py-2.5 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl active:scale-95"
                >
                    <Download size={18} />
                    Download PDF
                </button>
            </div>

            {/* Invoice Card — A4 Proportional */}
            <div className="max-w-[800px] mx-auto bg-white shadow-2xl overflow-hidden" style={{ borderRadius: '4px' }}>

                {/* Top Accent Bar */}
                <div className="h-1.5 bg-gradient-to-r from-blue-600 to-blue-500"></div>

                {/* ═══ HEADER ═══ */}
                <div className="px-8 pt-6 pb-4">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold text-[#1a2342]">
                                {businessSettings.businessName || 'BILLJI'}
                            </h2>
                            <div className="mt-2 space-y-0.5 text-sm text-gray-500">
                                {businessSettings.address && (
                                    <p className="flex items-center gap-1.5">
                                        <MapPin size={12} className="text-gray-400 flex-shrink-0" />
                                        {businessSettings.address}
                                    </p>
                                )}
                                {businessSettings.gstNumber && (
                                    <p className="flex items-center gap-1.5 font-medium text-gray-700">
                                        <Hash size={12} className="text-gray-400 flex-shrink-0" />
                                        GSTIN: {businessSettings.gstNumber}
                                    </p>
                                )}
                                {businessSettings.phone && (
                                    <p className="flex items-center gap-1.5">
                                        <Phone size={12} className="text-gray-400 flex-shrink-0" />
                                        {businessSettings.phone}
                                    </p>
                                )}
                                {businessSettings.email && (
                                    <p className="flex items-center gap-1.5">
                                        <Mail size={12} className="text-gray-400 flex-shrink-0" />
                                        {businessSettings.email}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="text-right">
                            <h3 className="text-3xl font-bold tracking-wide text-blue-600">TAX INVOICE</h3>
                        </div>
                    </div>
                </div>

                {/* Divider */}
                <div className="mx-8 border-t-2 border-[#1a2342]"></div>

                {/* ═══ INVOICE INFO + BILL TO ═══ */}
                <div className="px-8 py-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Bill To */}
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-2">Bill To</p>
                            <p className="font-bold text-gray-900 text-lg">{invoice.customerName}</p>
                            {invoice.customerPhone && (
                                <p className="text-sm text-gray-600 mt-1 flex items-center gap-1.5">
                                    <Phone size={13} className="text-gray-400" />
                                    {invoice.customerPhone}
                                </p>
                            )}
                            {invoice.customerEmail && (
                                <p className="text-sm text-gray-600 mt-0.5 flex items-center gap-1.5">
                                    <Mail size={13} className="text-gray-400" />
                                    {invoice.customerEmail}
                                </p>
                            )}
                        </div>

                        {/* Invoice Details */}
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-3">Invoice Details</p>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Invoice No:</span>
                                    <span className="font-semibold text-gray-900">{invoice.invoiceNumber}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Date:</span>
                                    <span className="text-gray-900">{formatDate(invoice.date)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Due Date:</span>
                                    <span className="text-gray-900">{formatDate(invoice.dueDate)}</span>
                                </div>
                                <div className="flex justify-between text-sm items-center">
                                    <span className="text-gray-500">Status:</span>
                                    <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${statusColor}`}>
                                        {invoice.status?.toUpperCase()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══ ITEMS TABLE ═══ */}
                <div className="px-8 pb-4">
                    <div className="overflow-hidden rounded-lg border border-gray-200">
                        <table className="w-full" style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: 'normal' }}>
                            <thead>
                                <tr className="bg-[#1a2342] text-white">
                                    <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider w-8">#</th>
                                    <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider">Item Description</th>
                                    <th className="px-3 py-3 text-center text-[10px] font-semibold uppercase tracking-wider">HSN</th>
                                    <th className="px-3 py-3 text-center text-[10px] font-semibold uppercase tracking-wider w-12">Qty</th>
                                    <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider">Unit Price</th>
                                    <th className="px-3 py-3 text-center text-[10px] font-semibold uppercase tracking-wider w-16">GST %</th>
                                    <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {invoice.items?.map((item, index) => {
                                    const itemTotal = (item.quantity * item.price) - (item.discount || 0);
                                    return (
                                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                                            <td className="px-3 py-3 text-xs text-gray-400 text-center">{index + 1}</td>
                                            <td className="px-3 py-3 text-sm text-gray-900">{item.description}</td>
                                            <td className="px-3 py-3 text-xs text-gray-500 text-center font-mono">{item.hsnCode || '—'}</td>
                                            <td className="px-3 py-3 text-sm text-gray-600 text-center">{item.quantity}</td>
                                            <td className="px-3 py-3 text-sm text-gray-600 text-right" style={{ letterSpacing: '0', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(item.price)}</td>
                                            <td className="px-3 py-3 text-xs text-gray-500 text-center">{invoice.gstRate || 0}%</td>
                                            <td className="px-3 py-3 text-sm font-semibold text-gray-900 text-right" style={{ letterSpacing: '0', fontVariantNumeric: 'tabular-nums' }}>
                                                {formatMoney(itemTotal)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ═══ TOTALS ═══ */}
                <div className="px-8 pb-5">
                    <div className="flex justify-end">
                        <div className="w-full max-w-xs">
                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                                <div className="flex justify-between text-sm bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                                    <span className="text-gray-500">Subtotal</span>
                                    <span className="text-gray-900" style={{ letterSpacing: '0', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(invoice.subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-sm bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                                    <span className="text-gray-500">GST ({invoice.gstRate || 0}%)</span>
                                    <span className="text-gray-900" style={{ letterSpacing: '0', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(invoice.gstAmount)}</span>
                                </div>
                                <div className="flex justify-between bg-[#1a2342] text-white px-4 py-3">
                                    <span className="font-bold text-base">GRAND TOTAL</span>
                                    <span className="font-bold text-base" style={{ letterSpacing: '0', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(invoice.total)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══ NOTES ═══ */}
                {invoice.notes && invoice.notes.trim() && (
                    <div className="px-8 pb-4">
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Payment Notes</p>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
                        </div>
                    </div>
                )}

                {/* ═══ TERMS & CONDITIONS ═══ */}
                <div className="px-8 pb-4">
                    <div className="border-t border-gray-200 pt-4">
                        <p className="text-[10px] font-bold text-[#1a2342] uppercase tracking-widest mb-2">Terms & Conditions</p>
                        <ol className="text-[11px] text-gray-400 space-y-0.5 list-decimal list-inside">
                            <li>Goods once sold will not be taken back or exchanged.</li>
                            <li>Warranty as per manufacturer policy.</li>
                            <li>Subject to local jurisdiction only.</li>
                            <li>Please keep this invoice for future reference.</li>
                            <li>Payment is due by the date mentioned above.</li>
                        </ol>
                    </div>
                </div>

                {/* ═══ SIGNATURE ═══ */}
                <div className="px-8 pb-6">
                    <div className="border-t border-gray-200 pt-4">
                        <div className="flex justify-end">
                            <div className="text-center w-48">
                                <p className="text-xs font-bold text-[#1a2342] mb-1">
                                    For {businessSettings.businessName || 'BILLJI'}
                                </p>
                                {/* Digital stamp */}
                                <div className="my-3">
                                    <p className="text-[10px] font-semibold text-blue-400 leading-tight">Digitally Signed</p>
                                </div>
                                <div className="border-t border-gray-400 mt-1 pt-1.5">
                                    <p className="text-xs text-gray-500">Authorized Signatory</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══ FOOTER ═══ */}
                <div className="bg-[#1a2342] px-8 py-4 text-center">
                    <p className="text-sm font-semibold text-white">Thank You</p>
                    <p className="text-[11px] text-blue-300/70 mt-1">
                        Powered By BILLJI &nbsp;|&nbsp; Maintained By PANDA STUDIOS
                    </p>
                </div>

                {/* Bottom accent */}
                <div className="h-1 bg-gradient-to-r from-blue-600 to-blue-500"></div>
            </div>

            {/* Bottom Download Button */}
            <div className="max-w-[800px] mx-auto mt-6 text-center">
                <button
                    onClick={handleDownloadPDF}
                    className="inline-flex items-center gap-2 bg-[#1a2342] hover:bg-[#253060] text-white px-8 py-3 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl active:scale-95"
                >
                    <Download size={20} />
                    Download Invoice PDF
                </button>
            </div>
        </div>
    );
};
