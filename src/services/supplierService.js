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

const COLLECTION_NAME = 'suppliers';

/**
 * Add a new supplier
 */
export const addSupplier = async (userId, supplierData) => {
    try {
        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            ...supplierData,
            userId,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        });
        return docRef.id;
    } catch (error) {
        console.error('Error adding supplier:', error);
        throw error;
    }
};

/**
 * Update a supplier
 */
export const updateSupplier = async (supplierId, supplierData) => {
    try {
        const docRef = doc(db, COLLECTION_NAME, supplierId);
        await updateDoc(docRef, {
            ...supplierData,
            updatedAt: Timestamp.now(),
        });
    } catch (error) {
        console.error('Error updating supplier:', error);
        throw error;
    }
};

/**
 * Delete a supplier
 */
export const deleteSupplier = async (supplierId) => {
    try {
        await deleteDoc(doc(db, COLLECTION_NAME, supplierId));
    } catch (error) {
        console.error('Error deleting supplier:', error);
        throw error;
    }
};

/**
 * Get suppliers for a user
 */
export const getSuppliers = async (userId) => {
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
        console.error('Error getting suppliers:', error);
        throw error;
    }
};

/**
 * Subscribe to real-time supplier updates
 */
export const subscribeToSuppliers = (userId, callback) => {
    const q = query(
        collection(db, COLLECTION_NAME),
        where('userId', '==', userId)
        // Removed orderBy to avoid composite index requirement
    );

    return onSnapshot(
        q,
        (querySnapshot) => {
            const suppliers = querySnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
            console.log('✅ SupplierService: Successfully fetched suppliers:', suppliers.length);
            callback(suppliers);
        },
        (error) => {
            console.error('❌ SupplierService: ERROR in subscription:', error);
            console.error('❌ Error code:', error.code);
            console.error('❌ Error message:', error.message);

            if (error.code === 'permission-denied') {
                console.error('🚨 PERMISSION DENIED! Firestore rules are blocking access to suppliers collection!');
                console.error('🚨 Solution: Update Firestore security rules in Firebase Console');
            }

            callback([]);
        }
    );
};
