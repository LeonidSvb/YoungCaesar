
// Phone number normalization function
function normalizePhone(phone) {
    if (!phone) return '';
    
    // Remove all non-digit characters except +
    let cleaned = phone.replace(/[^+\d]/g, '');
    
    // Handle different formats
    if (cleaned.startsWith('+')) {
        return cleaned; // Already in international format
    } else if (cleaned.startsWith('1') && cleaned.length === 11) {
        return '+' + cleaned; // US number with country code
    } else if (cleaned.length === 10) {
        return '+1' + cleaned; // US number without country code
    } else if (cleaned.length > 7) {
        // International number without +, assume it's correct
        return '+' + cleaned;
    }
    
    return phone; // Return original if can't normalize
}

// Test examples:
console.log(normalizePhone('+1-555-123-4567')); // +15551234567
console.log(normalizePhone('(555) 123-4567'));  // +15551234567  
console.log(normalizePhone('555.123.4567'));    // +15551234567
console.log(normalizePhone('34911234567'));     // +34911234567
