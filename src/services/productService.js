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

const COLLECTION_NAME = 'products';

/**
 * Add a new product
 */
export const addProduct = async (userId, productData) => {
    try {
        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            ...productData,
            userId,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        });
        return docRef.id;
    } catch (error) {
        console.error('Error adding product:', error);
        throw error;
    }
};

/**
 * Update a product
 */
export const updateProduct = async (productId, productData) => {
    try {
        const docRef = doc(db, COLLECTION_NAME, productId);
        await updateDoc(docRef, {
            ...productData,
            updatedAt: Timestamp.now(),
        });
    } catch (error) {
        console.error('Error updating product:', error);
        throw error;
    }
};

/**
 * Update product stock quantity
 */
export const updateProductStock = async (productId, quantityChange) => {
    try {
        const { increment, getDoc } = await import('firebase/firestore');
        const docRef = doc(db, COLLECTION_NAME, productId);

        // Check if exists first to avoid crashing on deleted products
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
            console.warn(`Product ${productId} not found, skipping stock update`);
            return;
        }

        await updateDoc(docRef, {
            quantity: increment(quantityChange),
            updatedAt: Timestamp.now(),
        });
    } catch (error) {
        console.error('Error updating product stock:', error);
        // Don't throw, just log. This prevents invoice saving from failing.
    }
};

/**
 * Delete a product
 */
export const deleteProduct = async (productId) => {
    try {
        await deleteDoc(doc(db, COLLECTION_NAME, productId));
    } catch (error) {
        console.error('Error deleting product:', error);
        throw error;
    }
};

/**
 * Get products for a user
 */
export const getProducts = async (userId) => {
    try {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('userId', '==', userId),
            orderBy('name', 'asc')
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));
    } catch (error) {
        console.error('Error getting products:', error);
        throw error;
    }
};

/**
 * Subscribe to real-time product updates
 */
export const subscribeToProducts = (userId, callback) => {
    const q = query(
        collection(db, COLLECTION_NAME),
        where('userId', '==', userId)
        // Removed orderBy to avoid composite index requirement
    );

    return onSnapshot(
        q,
        (querySnapshot) => {
            const products = querySnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
            callback(products);
        },
        (error) => {
            console.error('Error in product subscription:', error);
            // Call callback with empty array to stop loading
            callback([]);
        }
    );
};

/**
 * Get low stock products
 */
export const getLowStockProducts = async (userId) => {
    try {
        const products = await getProducts(userId);
        return products.filter((p) => p.quantity <= (p.lowStockThreshold || 10));
    } catch (error) {
        console.error('Error getting low stock products:', error);
        throw error;
    }
};

/**
 * Calculate total inventory value
 */
export const calculateInventoryValue = async (userId) => {
    try {
        const products = await getProducts(userId);

        const purchaseValue = products.reduce(
            (sum, p) => sum + (p.quantity * p.purchasePrice || 0),
            0
        );

        const sellingValue = products.reduce(
            (sum, p) => sum + (p.quantity * p.sellingPrice || 0),
            0
        );

        return {
            purchaseValue,
            sellingValue,
            potentialProfit: sellingValue - purchaseValue,
        };
    } catch (error) {
        console.error('Error calculating inventory value:', error);
        throw error;
    }
};
