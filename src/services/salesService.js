import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    where,
    getDocs,
    onSnapshot,
    Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const COLLECTION_NAME = 'sales';

/**
 * Add a new sale record
 */
export const addSale = async (userId, saleData) => {
    try {
        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            ...saleData,
            userId,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        });
        return docRef.id;
    } catch (error) {
        console.error('Error adding sale:', error);
        throw error;
    }
};

/**
 * Update a sale record
 */
export const updateSale = async (saleId, saleData) => {
    try {
        const docRef = doc(db, COLLECTION_NAME, saleId);
        await updateDoc(docRef, {
            ...saleData,
            updatedAt: Timestamp.now(),
        });
    } catch (error) {
        console.error('Error updating sale:', error);
        throw error;
    }
};

/**
 * Delete a sale record
 */
export const deleteSale = async (saleId) => {
    try {
        await deleteDoc(doc(db, COLLECTION_NAME, saleId));
    } catch (error) {
        console.error('Error deleting sale:', error);
        throw error;
    }
};

/**
 * Subscribe to real-time sale updates for a user
 */
export const subscribeToSales = (userId, callback) => {
    const q = query(
        collection(db, COLLECTION_NAME),
        where('userId', '==', userId)
    );

    return onSnapshot(
        q,
        (querySnapshot) => {
            const sales = querySnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
                saleDate: doc.data().saleDate?.toDate?.() || new Date(doc.data().saleDate),
            }));
            callback(sales);
        },
        (error) => {
            console.error('Error in sales subscription:', error);
            callback([]);
        }
    );
};

/**
 * Get all sales for a user (one-time fetch)
 */
export const getSales = async (userId) => {
    try {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('userId', '==', userId)
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            saleDate: doc.data().saleDate?.toDate?.() || new Date(doc.data().saleDate),
        }));
    } catch (error) {
        console.error('Error getting sales:', error);
        throw error;
    }
};

/**
 * Get sales linked to a specific product
 */
export const getSalesByProduct = async (productId) => {
    try {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('productIds', 'array-contains', productId)
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            saleDate: doc.data().saleDate?.toDate?.() || new Date(doc.data().saleDate),
        }));
    } catch (error) {
        console.error('Error getting sales by product:', error);
        throw error;
    }
};
