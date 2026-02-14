export const EmptyState = ({
    icon: Icon,
    title,
    description,
    action,
    actionLabel
}) => {
    return (
        <div className="flex flex-col items-center justify-center py-12 px-4">
            {Icon && (
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <Icon className="w-8 h-8 text-gray-400" />
                </div>
            )}
            <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
            {description && (
                <p className="text-gray-500 text-center mb-6 max-w-md">{description}</p>
            )}
            {action && actionLabel && (
                <button
                    onClick={action}
                    className="btn-primary"
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
};
