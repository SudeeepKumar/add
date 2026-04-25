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
} from 'firebase/firestore';
import { db } from '../config/firebase';

const COLLECTION_NAME = 'transactions';

/**
 * Add a new transaction
 */
export const addTransaction = async (userId, transactionData) => {
    try {
        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            ...transactionData,
            userId,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        });
        return docRef.id;
    } catch (error) {
        console.error('Error adding transaction:', error);
        throw error;
    }
};

/**
 * Update a transaction
 */
export const updateTransaction = async (transactionId, transactionData) => {
    try {
        const docRef = doc(db, COLLECTION_NAME, transactionId);
        await updateDoc(docRef, {
            ...transactionData,
            updatedAt: Timestamp.now(),
        });
    } catch (error) {
        console.error('Error updating transaction:', error);
        throw error;
    }
};

/**
 * Delete a transaction
 */
export const deleteTransaction = async (transactionId) => {
    try {
        await deleteDoc(doc(db, COLLECTION_NAME, transactionId));
    } catch (error) {
        console.error('Error deleting transaction:', error);
        throw error;
    }
};

/**
 * Get transactions for a user with filters
 */
export const getTransactions = async (userId, filters = {}) => {
    try {
        let q = query(
            collection(db, COLLECTION_NAME),
            where('userId', '==', userId)
        );

        // Apply filters
        if (filters.type) {
            q = query(q, where('type', '==', filters.type));
        }

        if (filters.category) {
            q = query(q, where('category', '==', filters.category));
        }

        if (filters.startDate) {
            q = query(q, where('date', '>=', Timestamp.fromDate(new Date(filters.startDate))));
        }

        if (filters.endDate) {
            q = query(q, where('date', '<=', Timestamp.fromDate(new Date(filters.endDate))));
        }

        q = query(q, orderBy('date', 'desc'));

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            date: doc.data().date?.toDate?.() || new Date(doc.data().date),
        }));
    } catch (error) {
        console.error('Error getting transactions:', error);
        throw error;
    }
};

/**
 * Subscribe to real-time transaction updates
 */
export const subscribeToTransactions = (userId, callback, filters = {}) => {
    let q = query(
        collection(db, COLLECTION_NAME),
        where('userId', '==', userId)
        // Removed orderBy to avoid composite index requirement
    );

    if (filters.type) {
        q = query(q, where('type', '==', filters.type));
    }

    return onSnapshot(
        q,
        (querySnapshot) => {
            const transactions = querySnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
                date: doc.data().date?.toDate?.() || new Date(doc.data().date),
            }));
            callback(transactions);
        },
        (error) => {
            console.error('Error in transaction subscription:', error);
            // Call callback with empty array to stop loading
            callback([]);
        }
    );
};

/**
 * Calculate profit/loss for a date range
 */
export const calculateProfitLoss = async (userId, startDate, endDate) => {
    try {
        const transactions = await getTransactions(userId, { startDate, endDate });

        const income = transactions
            .filter((t) => t.type === 'income')
            .reduce((sum, t) => sum + (t.amount || 0), 0);

        const expenses = transactions
            .filter((t) => t.type === 'expense')
            .reduce((sum, t) => sum + (t.amount || 0), 0);

        return {
            income,
            expenses,
            netProfit: income - expenses,
        };
    } catch (error) {
        console.error('Error calculating profit/loss:', error);
        throw error;
    }
};

/**
 * Get transactions linked to a specific reference (e.g. product ID or invoice ID)
 */
export const getTransactionsByReference = async (referenceId) => {
    try {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('referenceId', '==', referenceId)
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            date: doc.data().date?.toDate?.() || new Date(doc.data().date),
        }));
    } catch (error) {
        console.error('Error getting transactions by reference:', error);
        throw error;
    }
};

/**
 * Update all transactions linked to a referenceId
 * Used for data sync when purchase price/quantity changes
 */
export const updateTransactionsByReference = async (referenceId, updates) => {
    try {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('referenceId', '==', referenceId)
        );

        const querySnapshot = await getDocs(q);
        const updatePromises = querySnapshot.docs.map((docSnap) =>
            updateDoc(doc(db, COLLECTION_NAME, docSnap.id), {
                ...updates,
                updatedAt: Timestamp.now(),
            })
        );

        await Promise.all(updatePromises);
        return querySnapshot.docs.length;
    } catch (error) {
        console.error('Error updating transactions by reference:', error);
        throw error;
    }
};

