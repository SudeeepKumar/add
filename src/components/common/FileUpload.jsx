import { useState, useCallback } from 'react';
import { Upload, X, FileText } from 'lucide-react';
import { Button } from './Button';

export const FileUpload = ({ onFileSelect, accept = '.csv', maxSize = 5 }) => {
    const [dragActive, setDragActive] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [error, setError] = useState('');

    const validateFile = (file) => {
        // Check file type
        const fileExtension = file.name.split('.').pop().toLowerCase();
        const acceptedTypes = accept.split(',').map(t => t.trim().replace('.', ''));

        if (!acceptedTypes.includes(fileExtension)) {
            return `Please upload a ${accept} file`;
        }

        // Check file size
        const maxSizeBytes = maxSize * 1024 * 1024;
        if (file.size > maxSizeBytes) {
            return `File size must be less than ${maxSize}MB`;
        }

        return null;
    };

    const handleFile = (file) => {
        setError('');
        const validationError = validateFile(file);

        if (validationError) {
            setError(validationError);
            return;
        }

        setSelectedFile(file);
        onFileSelect(file);
    };

    const handleDrag = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    }, []);

    const handleChange = (e) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    };

    const handleRemove = () => {
        setSelectedFile(null);
        setError('');
        onFileSelect(null);
    };

    return (
        <div className="w-full">
            {!selectedFile ? (
                <div
                    className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragActive
                            ? 'border-primary-500 bg-primary-50'
                            : error
                                ? 'border-danger-300 bg-danger-50'
                                : 'border-gray-300 hover:border-primary-400'
                        }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                >
                    <input
                        type="file"
                        accept={accept}
                        onChange={handleChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Upload className={`mx-auto h-12 w-12 mb-4 ${error ? 'text-danger-400' : 'text-gray-400'}`} />
                    <p className="text-lg font-medium text-gray-700 mb-1">
                        {dragActive ? 'Drop file here' : 'Drag & drop your CSV file here'}
                    </p>
                    <p className="text-sm text-gray-500 mb-4">
                        or click to browse (max {maxSize}MB)
                    </p>
                    {error && (
                        <p className="text-sm text-danger-600 font-medium">{error}</p>
                    )}
                </div>
            ) : (
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                                <FileText className="w-5 h-5 text-primary-600" />
                            </div>
                            <div>
                                <p className="font-medium text-gray-900">{selectedFile.name}</p>
                                <p className="text-sm text-gray-500">
                                    {(selectedFile.size / 1024).toFixed(2)} KB
                                </p>
                            </div>
                        </div>
                        <Button
                            onClick={handleRemove}
                            variant="secondary"
                            className="flex items-center gap-2"
                        >
                            <X size={16} />
                            Remove
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};
