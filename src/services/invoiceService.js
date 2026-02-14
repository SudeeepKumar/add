import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    where,
    orderBy,
    getDocs,
    onSnapshot,
    Timestamp,
    getDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const COLLECTION_NAME = 'invoices';

/**
 * Generate invoice number
 */
const generateInvoiceNumber = () => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `INV-${timestamp}-${random}`;
};

/**
 * Add a new invoice
 */
export const addInvoice = async (userId, invoiceData) => {
    try {
        const invoiceNumber = generateInvoiceNumber();
        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            ...invoiceData,
            invoiceNumber,
            userId,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        });

        // Side effects: Reduce stock and Add Income Transaction
        // We do this asynchronously and don't block the UI response, or await it?
        // Better to await to ensure consistency or error reporting.

        // 1. Reduce Stock for each item
        const { updateProductStock } = await import('./productService');
        const stockPromises = invoiceData.items
            .filter(item => item.productId) // Only for tracked products
            .map(item => updateProductStock(item.productId, -Math.abs(item.quantity))); // Ensure negative

        await Promise.all(stockPromises);

        // 2. Add Income Transaction
        const { addTransaction } = await import('./transactionService');
        await addTransaction(userId, {
            type: 'income',
            category: 'Sales',
            amount: invoiceData.total,
            description: `Invoice #${invoiceNumber} - ${invoiceData.customerName}`,
            date: invoiceData.date, // Use invoice date
            paymentMethod: 'Invoice',
            referenceId: docRef.id,
            status: 'completed' // Assuming recognized income
        });

        return { id: docRef.id, invoiceNumber };
    } catch (error) {
        console.error('Error adding invoice:', error);
        throw error;
    }
};

/**
 * Update an invoice
 */
export const updateInvoice = async (invoiceId, invoiceData) => {
    try {
        const docRef = doc(db, COLLECTION_NAME, invoiceId);

        // 1. Fetch original invoice for comparison
        const { getDoc } = await import('firebase/firestore');
        const originalSnap = await getDoc(docRef);
        if (!originalSnap.exists()) throw new Error('Invoice not found');
        const originalData = originalSnap.data();

        // 2. Adjust Stock
        const { updateProductStock } = await import('./productService');

        // Revert old stock (add back)
        const revertPromises = (originalData.items || [])
            .filter(item => item.productId)
            .map(item => updateProductStock(item.productId, Math.abs(item.quantity)));

        await Promise.all(revertPromises);

        // Apply new stock (deduct)
        const applyPromises = (invoiceData.items || [])
            .filter(item => item.productId)
            .map(item => updateProductStock(item.productId, -Math.abs(item.quantity)));

        await Promise.all(applyPromises);

        // 3. Update Invoice Document
        await updateDoc(docRef, {
            ...invoiceData,
            updatedAt: Timestamp.now(),
        });

        // 4. Update Transaction
        // Find transaction with referenceId === invoiceId
        const { getTransactions, updateTransaction } = await import('./transactionService');
        // We can't query by referenceId easily without an index or scanning. 
        // But users usually don't have thousands of transactions yet.
        // A better way is to store transactionId on the invoice, but that requires schema change.
        // Let's try to query by referenceId if possible, or search recent transactions.

        // Actually, let's query transactions with proper filter
        // We need to import query, collection, where, getDocs from firebase/firestore which are already imported at top
        const q = query(
            collection(db, 'transactions'),
            where('referenceId', '==', invoiceId),
            where('type', '==', 'income')
        );
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const transactionDoc = querySnapshot.docs[0];
            await updateTransaction(transactionDoc.id, {
                amount: invoiceData.total,
                date: invoiceData.date,
                description: `Invoice #${originalData.invoiceNumber} - ${invoiceData.customerName}`,
                // Keep other fields like category, paymentMethod
            });
        }

    } catch (error) {
        console.error('Error updating invoice:', error);
        throw error;
    }
};

/**
 * Delete an invoice
 */
export const deleteInvoice = async (invoiceId) => {
    try {
        const docRef = doc(db, COLLECTION_NAME, invoiceId);

        // 1. Fetch invoice to revert stock
        const { getDoc } = await import('firebase/firestore');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const invoiceData = docSnap.data();

            // 2. Revert Stock (Add back)
            const { updateProductStock } = await import('./productService');
            const revertPromises = (invoiceData.items || [])
                .filter(item => item.productId)
                .map(item => updateProductStock(item.productId, Math.abs(item.quantity)));

            await Promise.all(revertPromises);

            // 3. Delete parameters Transaction
            const q = query(
                collection(db, 'transactions'),
                where('referenceId', '==', invoiceId),
                where('type', '==', 'income')
            );
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const { deleteTransaction } = await import('./transactionService');
                await deleteTransaction(querySnapshot.docs[0].id);
            }
        }

        // 4. Delete Invoice
        await deleteDoc(docRef);
    } catch (error) {
        console.error('Error deleting invoice:', error);
        throw error;
    }
};

/**
 * Get invoices for a user
 */
export const getInvoices = async (userId, filters = {}) => {
    try {
        let q = query(
            collection(db, COLLECTION_NAME),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc')
        );

        if (filters.status) {
            q = query(q, where('status', '==', filters.status));
        }

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            date: doc.data().date?.toDate?.() || new Date(doc.data().date),
            dueDate: doc.data().dueDate?.toDate?.() || new Date(doc.data().dueDate),
        }));
    } catch (error) {
        console.error('Error getting invoices:', error);
        throw error;
    }
};

/**
 * Subscribe to real-time invoice updates
 */
export const subscribeToInvoices = (userId, callback) => {
    const q = query(
        collection(db, COLLECTION_NAME),
        where('userId', '==', userId)
        // Removed orderBy to avoid composite index requirement - will sort client-side
    );

    return onSnapshot(
        q,
        (querySnapshot) => {
            const invoices = querySnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
                date: doc.data().date?.toDate?.() || new Date(doc.data().date),
                dueDate: doc.data().dueDate?.toDate?.() || new Date(doc.data().dueDate),
            }));
            callback(invoices);
        },
        (error) => {
            console.error('Error in invoice subscription:', error);
            // Call callback with empty array to stop loading
            callback([]);
        }
    );
};
