import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    subscribeToSuppliers,
    addSupplier,
    updateSupplier,
    deleteSupplier,
} from '../services/supplierService';
import { Modal } from '../components/common/Modal';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Plus, Pencil, Trash2, Truck } from 'lucide-react';
import { isValidEmail, isValidPhone, isValidGST } from '../utils/validationUtils';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export const Suppliers = () => {
    const { user } = useAuth();
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        gstNumber: '',
        contactPerson: '',
        phone: '',
        email: '',
        address: '',
    });

    useEffect(() => {
        if (!user) {
            console.log('🔴 Suppliers: No user logged in');
            return;
        }

        console.log('🔵 Suppliers: Starting subscription for user:', user.uid);

        const unsubscribe = subscribeToSuppliers(user.uid, (data) => {
            console.log('🟢 Suppliers: Received data:', data);
            console.log('🟢 Suppliers: Number of suppliers:', data.length);
            if (data.length === 0) {
                console.log('⚠️ Suppliers: No suppliers found. Check:',
                    '\n1. Firestore rules published?',
                    '\n2. Suppliers collection exists in Firestore?',
                    '\n3. Any permission errors in console?');
            }
            setSuppliers(data);
            setLoading(false);
        });

        return () => {
            console.log('🔵 Suppliers: Unsubscribing');
            unsubscribe();
        };
    }, [user]);

    const resetForm = () => {
        setFormData({
            name: '',
            gstNumber: '',
            contactPerson: '',
            phone: '',
            email: '',
            address: '',
        });
        setEditingSupplier(null);
    };

    const handleOpenModal = (supplier = null) => {
        if (supplier) {
            setEditingSupplier(supplier);
            setFormData({
                name: supplier.name,
                gstNumber: supplier.gstNumber || '',
                contactPerson: supplier.contactPerson || '',
                phone: supplier.phone || '',
                email: supplier.email || '',
                address: supplier.address || '',
            });
        } else {
            resetForm();
        }
        setModalOpen(true);
    };

    const handleCloseModal = () => {
        setModalOpen(false);
        resetForm();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name) {
            toast.error('Please enter supplier name');
            return;
        }

        // Validate email
        if (formData.email && !isValidEmail(formData.email)) {
            toast.error('Please enter a valid email address');
            return;
        }

        // Validate phone
        if (formData.phone && !isValidPhone(formData.phone)) {
            toast.error('Please enter a valid phone number (10 digits)');
            return;
        }

        // Validate GST
        if (formData.gstNumber && !isValidGST(formData.gstNumber)) {
            toast.error('Please enter a valid GST number (15 characters)');
            return;
        }

        try {
            if (editingSupplier) {
                await updateSupplier(editingSupplier.id, formData);
                toast.success('Supplier updated successfully');
            } else {
                await addSupplier(user.uid, formData);
                toast.success('Supplier added successfully');
            }
            handleCloseModal();
        } catch (error) {
            console.error('Error saving supplier:', error);
            toast.error('Failed to save supplier');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this supplier?')) {
            return;
        }

        try {
            await deleteSupplier(id);
            toast.success('Supplier deleted successfully');
        } catch (error) {
            console.error('Error deleting supplier:', error);
            toast.error('Failed to delete supplier');
        }
    };

    // Filter suppliers by search query
    const filteredSuppliers = suppliers
        .sort((a, b) => a.name.localeCompare(b.name)) // Sort by name alphabetically
        .filter((supplier) => {
            if (!searchQuery) return true;

            const query = searchQuery.toLowerCase();
            return (
                supplier.name.toLowerCase().includes(query) ||
                (supplier.gstNumber && supplier.gstNumber.toLowerCase().includes(query)) ||
                (supplier.contactPerson && supplier.contactPerson.toLowerCase().includes(query)) ||
                (supplier.phone && supplier.phone.includes(query)) ||
                (supplier.email && supplier.email.toLowerCase().includes(query))
            );
        });

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
                    <h1 className="text-3xl font-bold text-gray-900">Suppliers</h1>
                    <p className="text-gray-600 mt-1">Manage your supplier information</p>
                </div>
                <Button onClick={() => handleOpenModal()} className="flex items-center gap-2">
                    <Plus size={20} />
                    Add Supplier
                </Button>
            </div>

            {/* Search Bar */}
            {suppliers.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <Input
                        type="text"
                        placeholder="Search suppliers by name, GST, contact, phone, or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full"
                    />
                    {searchQuery && (
                        <div className="mt-2 text-sm text-gray-600">
                            <span className="font-medium">Showing {filteredSuppliers.length} of {suppliers.length} suppliers</span>
                            <button
                                onClick={() => setSearchQuery('')}
                                className="ml-2 text-primary-600 hover:text-primary-800 underline"
                            >
                                Clear search
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Suppliers List */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                {filteredSuppliers.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Supplier Name
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        GST Number
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Contact Person
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Phone
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Email
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Last Updated
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {filteredSuppliers.map((supplier) => (

                                    <tr key={supplier.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {supplier.name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {supplier.gstNumber || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {supplier.contactPerson || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {supplier.phone || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {supplier.email || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {supplier.updatedAt ? format(supplier.updatedAt.toDate(), 'MMM dd, yyyy') : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                            <button
                                                onClick={() => handleOpenModal(supplier)}
                                                className="text-primary-600 hover:text-primary-900"
                                                title="Edit"
                                            >
                                                <Pencil size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(supplier.id)}
                                                className="text-danger-600 hover:text-danger-900"
                                                title="Delete"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState
                        icon={Truck}
                        title="No suppliers yet"
                        description="Add your first supplier to get started"
                        action={() => handleOpenModal()}
                        actionLabel="Add Supplier"
                    />
                )}
            </div>

            {/* Supplier Modal */}
            <Modal
                isOpen={modalOpen}
                onClose={handleCloseModal}
                title={editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                        label="Supplier Name *"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="ABC Suppliers Pvt Ltd"
                        required
                    />

                    <Input
                        label="GST Number"
                        value={formData.gstNumber}
                        onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })}
                        placeholder="22AAAAA0000A1Z5"
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Contact Person"
                            value={formData.contactPerson}
                            onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                            placeholder="John Doe"
                        />

                        <Input
                            label="Phone"
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="+91 98765 43210"
                        />
                    </div>

                    <Input
                        label="Email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="contact@supplier.com"
                    />

                    <div>
                        <label className="label">Address</label>
                        <textarea
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            placeholder="123 Main Street, City, State, PIN"
                            className="input min-h-[80px]"
                        />
                    </div>

                    <div className="flex gap-2 justify-end pt-4">
                        <Button type="button" variant="secondary" onClick={handleCloseModal}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="primary">
                            {editingSupplier ? 'Update' : 'Add'} Supplier
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
