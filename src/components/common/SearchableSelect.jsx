import { useState, useEffect, useRef } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';

export const SearchableSelect = ({
    label,
    options,
    value,
    onChange,
    placeholder = 'Select...',
    className = '',
    error
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef(null);

    // Update search term when value changes externally
    useEffect(() => {
        const selectedOption = options.find(opt => opt.value === value);
        if (selectedOption) {
            setSearchTerm(selectedOption.label);
        } else if (!value) {
            setSearchTerm('');
        }
    }, [value, options]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
                // Revert search term to selected value on close if not matched
                const selectedOption = options.find(opt => opt.value === value);
                if (selectedOption) {
                    setSearchTerm(selectedOption.label);
                } else if (!value) {
                    setSearchTerm('');
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [options, value]);

    const filteredOptions = options.filter(option =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSelect = (option) => {
        onChange(option.value);
        setSearchTerm(option.label);
        setIsOpen(false);
    };

    const handleClear = (e) => {
        e.stopPropagation();
        onChange('');
        setSearchTerm('');
        setIsOpen(false);
    };

    return (
        <div className={`relative w-full ${className}`} ref={wrapperRef}>
            {label && (
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    {label}
                </label>
            )}
            <div className="relative">
                <div
                    className={`flex items-center w-full px-3 py-2 border ${error ? 'border-danger-500' : 'border-gray-300'
                        } rounded-lg bg-white focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-transparent transition-all`}
                    onClick={() => setIsOpen(true)}
                >
                    <Search size={16} className="text-gray-400 mr-2 flex-shrink-0" />
                    <input
                        type="text"
                        className="w-full outline-none text-sm text-gray-900 placeholder-gray-400"
                        placeholder={placeholder}
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setIsOpen(true);
                        }}
                        onFocus={() => setIsOpen(true)}
                    />
                    {value ? (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors ml-1"
                        >
                            <X size={14} />
                        </button>
                    ) : (
                        <ChevronDown size={16} className="text-gray-400 ml-1" />
                    )}
                </div>

                {/* Dropdown */}
                {isOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredOptions.length > 0 ? (
                            <ul className="py-1">
                                {filteredOptions.map((option) => (
                                    <li
                                        key={option.value}
                                        onClick={() => handleSelect(option)}
                                        className={`px-3 py-2 text-sm cursor-pointer hover:bg-primary-50 transition-colors ${option.value === value
                                            ? 'bg-primary-50 text-primary-700 font-medium'
                                            : 'text-gray-700'
                                            }`}
                                    >
                                        {option.label}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="px-3 py-2 text-sm text-gray-500 text-center">
                                No options found
                            </div>
                        )}
                    </div>
                )}
            </div>
            {error && (
                <p className="mt-1 text-sm text-danger-600">{error}</p>
            )}
        </div>
    );
};
