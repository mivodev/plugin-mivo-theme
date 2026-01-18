/**
 * MIVO Theme Configuration & Main Utilities
 */

// 1. Configuration
window.MivoConfig = {
    // API Configuration
    // Example: "http://192.168.1.1/mivo/public"
    apiBaseUrl: "", 
    
    // Your Mivo Session Name
    apiSession: "router-jakarta-1",

    // Set to true to force Check Voucher tab even if apiBaseUrl is empty (for dev/test)
    debugMode: false
};

// 2. Global Utilities
window.formatTime = function(str) {
    if (!str || str === '-') return '-';
    
    // Normalize string: specific fix for "7 h 12 m 48 s" (remove spaces between value and unit)
    // Converts "7 h 12 m" -> "7h12m" for easier parsing, while keeping standard "1w2d" intact.
    const normalized = str.toLowerCase().replace(/\s+/g, '');
    
    // Regex to parse MikroTik time format (e.g. 1w6d20h56m25s)
    const regex = /(\d+)([wdhms])/g;
    let match;
    const parts = [];
    
    while ((match = regex.exec(normalized)) !== null) {
        const val = match[1];
        const unit = match[2];
        // Use i18n to get localized unit name. Fallback to code if not found.
        const unitName = (window.i18n && window.i18n.translations?.time?.[unit]) || unit;
        parts.push(`${val} ${unitName}`);
    }
    
    return parts.length > 0 ? parts.join(' ') : str;
};

// Helper to parse time string into total seconds for Live Timer
window.parseTimeSeconds = function(str) {
    if (!str || str === '-') return 0;
    const normalized = str.toLowerCase().replace(/\s+/g, '');
    const regex = /(\d+)([wdhms])/g;
    let match;
    let totalSeconds = 0;
    
    while ((match = regex.exec(normalized)) !== null) {
        const val = parseInt(match[1]);
        const unit = match[2];
        
        switch(unit) {
            case 'w': totalSeconds += val * 604800; break;
            case 'd': totalSeconds += val * 86400; break;
            case 'h': totalSeconds += val * 3600; break;
            case 'm': totalSeconds += val * 60; break;
            case 's': totalSeconds += val; break;
        }
    }
    return totalSeconds;
};

// Helper to format seconds back to string (e.g. 70s -> 1m 10s)
window.formatSeconds = function(seconds) {
    if (seconds <= 0) return '0s';
    
    const w = Math.floor(seconds / 604800);
    seconds %= 604800;
    const d = Math.floor(seconds / 86400);
    seconds %= 86400;
    const h = Math.floor(seconds / 3600);
    seconds %= 3600;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    
    const parts = [];
    const t = window.i18n?.translations?.time || {};
    
    if (w > 0) parts.push(`${w} ${t.w || 'w'}`);
    if (d > 0) parts.push(`${d} ${t.d || 'd'}`);
    if (h > 0) parts.push(`${h} ${t.h || 'h'}`);
    if (m > 0) parts.push(`${m} ${t.m || 'm'}`);
    if (s > 0) parts.push(`${s} ${t.s || 's'}`);
    
    return parts.join(' ');
};
