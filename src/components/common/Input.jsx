export const Input = ({
    label,
    error,
    className = '',
    ...props
}) => {
    return (
        <div className="w-full">
            {label && (
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    {label}
                </label>
            )}
            <input
                className={`w-full px-3 py-2 border ${error ? 'border-danger-500' : 'border-gray-300'
                    } rounded-lg focus:outline-none focus:ring-2 ${error ? 'focus:ring-danger-500' : 'focus:ring-primary-500'
                    } focus:border-transparent transition-all ${className}`}
                {...props}
            />
            {error && (
                <p className="mt-1 text-sm text-danger-600">{error}</p>
            )}
        </div>
    );
};
