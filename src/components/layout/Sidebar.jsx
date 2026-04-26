import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
    LayoutDashboard,
    ShoppingBag,
    Receipt,
    Package,
    FileBarChart,
    Truck,
    Upload,
    Settings as SettingsIcon,
    LogOut,
    User,
} from 'lucide-react';
import toast from 'react-hot-toast';

export const Sidebar = ({ onClose }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            await logout();
            toast.success('Logged out successfully');
            navigate('/login');
        } catch (error) {
            toast.error('Failed to logout');
        }
    };

    const navItems = [
        { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/sales', icon: ShoppingBag, label: 'Sales' },
        { path: '/transactions', icon: Receipt, label: 'Transactions' },
        { path: '/inventory', icon: Package, label: 'Inventory' },
        { path: '/reports', icon: FileBarChart, label: 'Reports' },
        { path: '/suppliers', icon: Truck, label: 'Suppliers' },
        { path: '/bulk-import', icon: Upload, label: 'Bulk Import' },
        { path: '/settings', icon: SettingsIcon, label: 'Settings' },
    ];

    return (
        <div className="h-full bg-gray-900 text-white flex flex-col">
            {/* Logo */}
            <div className="p-6 border-b border-gray-800">
                <h1 className="text-2xl font-bold text-gradient bg-gradient-to-r from-primary-400 to-primary-200 bg-clip-text text-transparent">
                    BILLJI
                </h1>
                <p className="text-xs text-gray-400 mt-1">Accounting & Inventory</p>

            </div>


            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={onClose}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive
                                ? 'bg-primary-600 text-white shadow-lg'
                                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                            }`
                        }
                    >
                        <item.icon size={20} />
                        <span className="font-medium">{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            {/* User Section */}
            <div className="p-4 border-t border-gray-800">
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-800 rounded-lg mb-2">
                    <User size={20} className="text-gray-400" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                            {user?.email}
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-white rounded-lg transition-all duration-200"
                >
                    <LogOut size={20} />
                    <span className="font-medium">Logout</span>
                </button>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-800">
                <p className="text-xs text-gray-500 text-center">
                    A Product Of Sudeepta Kumar Panda
                </p>
            </div>
        </div>
    );
};
