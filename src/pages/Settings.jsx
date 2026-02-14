import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    subscribeToBusinessSettings,
    saveBusinessSettings,
} from '../services/businessSettingsService';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Building2, Save } from 'lucide-react';
import toast from 'react-hot-toast';

export const Settings = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        businessName: '',
        gstNumber: '',
        address: '',
        phone: '',
        email: '',
    });

    useEffect(() => {
        if (!user) return;

        const unsubscribe = subscribeToBusinessSettings(user.uid, (data) => {
            setFormData(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);

        try {
            await saveBusinessSettings(user.uid, formData);
            toast.success('Business settings saved successfully');
        } catch (error) {
            console.error('Error saving settings:', error);
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
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
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
                <p className="text-gray-600 mt-1">Manage your business information</p>
            </div>

            {/* Business Information Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-primary-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">Business Information</h2>
                        <p className="text-sm text-gray-600">This information will appear on invoices and reports</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Business Name *"
                            value={formData.businessName}
                            onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                            placeholder="Your Business Name"
                            required
                        />

                        <Input
                            label="GST Number"
                            value={formData.gstNumber}
                            onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })}
                            placeholder="22AAAAA0000A1Z5"
                        />
                    </div>

                    <Input
                        label="Business Address *"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        placeholder="123 Main Street, City, State, PIN"
                        required
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Phone Number"
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="+91 98765 43210"
                        />

                        <Input
                            label="Email Address"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="contact@yourbusiness.com"
                        />
                    </div>

                    <div className="pt-4">
                        <Button type="submit" disabled={saving} className="flex items-center gap-2">
                            <Save size={18} />
                            {saving ? 'Saving...' : 'Save Settings'}
                        </Button>
                    </div>
                </form>
            </div>

            {/* Preview Card */}
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Invoice Preview</h3>
                <div className="bg-white p-4 rounded border border-gray-200">
                    <h4 className="font-bold text-lg text-gray-900">{formData.businessName || 'Your Business Name'}</h4>
                    {formData.gstNumber && (
                        <p className="text-sm text-gray-600 mt-1">GST: {formData.gstNumber}</p>
                    )}
                    {formData.address && (
                        <p className="text-sm text-gray-600 mt-1">{formData.address}</p>
                    )}
                    <div className="flex gap-4 mt-2 text-sm text-gray-600">
                        {formData.phone && <span>📞 {formData.phone}</span>}
                        {formData.email && <span>📧 {formData.email}</span>}
                    </div>
                </div>
            </div>
        </div>
    );
};
