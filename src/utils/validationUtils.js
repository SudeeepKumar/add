/**
 * Validate email format
 */
export const isValidEmail = (email) => {
    if (!email) return true; // Optional field
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Validate phone number (Indian format)
 */
export const isValidPhone = (phone) => {
    if (!phone) return true; // Optional field
    // Accepts formats: +91 XXXXX XXXXX, +91-XXXXX-XXXXX, 10 digits, etc.
    const phoneRegex = /^(\+91[\-\s]?)?[0]?(91)?[6789]\d{9}$/;
    return phoneRegex.test(phone.replace(/[\s\-]/g, ''));
};

/**
 * Validate GST number format
 */
export const isValidGST = (gst) => {
    if (!gst) return true; // Optional field
    // GST format: 22AAAAA0000A1Z5 (15 characters)
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstRegex.test(gst.toUpperCase());
};

/**
 * Format phone number for display
 */
export const formatPhoneNumber = (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
        return `${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
    }
    return phone;
};

/**
 * Validate required field
 */
export const isRequired = (value) => {
    return value && value.toString().trim().length > 0;
};
