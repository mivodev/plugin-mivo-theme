/**
 * MIVO Theme Configuration & Main Utilities
 */

// 1. Configuration
window.MivoConfig = {
    // API Configuration
    // Example: "http://192.168.1.1/mivo/public"
    apiBaseUrl: "https://mivo.der.my.id", 
    
    // Your Mivo Session Name
    apiSession: "my-router",

    // Set to true to force Check Voucher tab even if apiBaseUrl is empty (for dev/test)
    debugMode: true
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

// Helper to format bytes
window.bytesToSize = function(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = parseInt(Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
};

// Status Page Logic
window.initStatusPage = function(props) {
    return {
        // Props from HTML
        uptimeStr: props.uptime || '-',
        username: props.username || '',
        limitTimeStr: props.limitTime || '',
        limitBytesStr: props.limitBytes || '',
        remainBytesStr: props.remainBytes || '',
        remainTimeStr: props.remainTime || '',
        
        // State
        uptimeSecs: 0,
        formattedUptime: '-',
        apiData: null,
        fetchError: null, // New debug state
        hasApi: window.MivoConfig?.apiBaseUrl !== '',
        
        // Derived Limits & Usage
        limitTimeSecs: 0,
        limitBytes: 0,
        remainBytes: 0,
        limitTimeStrDisplay: '', 

        init() {
            // Initial Parse (Native)
            this.uptimeSecs = window.parseTimeSeconds(this._clean(this.uptimeStr));
            this.updateUptime();
            
            // Start Timer
            setInterval(() => {
                this.uptimeSecs++;
                this.updateUptime();
            }, 1000);
            
            // Initial Calculation
            this.calculateLimits();

            // Smart Fetch: If limits are missing/invalid AND we have API, fetch it.
            if (this.shouldFetchApi() && this.hasApi) {
                console.log("MivoStatus: Local/Dev mode detected. Fetching API...");
                this.fetchStatus();
            }
        },
        
        updateUptime() {
            this.formattedUptime = window.formatSeconds(this.uptimeSecs);
        },
        
        _clean(val) {
             return (!val || val.startsWith('$')) ? '' : val;
        },

        shouldFetchApi() {
            // Fetch if username is valid BUT limits are empty (dev mode or no limit set)
            // 1. Unreplaced Template Check ('$')
            if (this.limitTimeStr.startsWith('$') || this.limitBytesStr.startsWith('$') || this.username.startsWith('$')) return true;
            
            // 2. Empty/Zero Check (Visual Fallback)
            // If native variables are present but "0" or empty, it usually means "Unlimited" in RouterOS.
            // HOWEVER, in some custom setups or dev environments, they might just be missing.
            // We'll trust the API check here: If we HAVE an API config, let's double check it 
            // if we see "0" limits, just in case the API has better info (like your case).
            const isTimeEmpty = !this.limitTimeStr || this.limitTimeStr === '0' || this.limitTimeStr === '0s';
            const isDataEmpty = !this.limitBytesStr || this.limitBytesStr === '0';
            
            if (isTimeEmpty && isDataEmpty) return true;
            
            return false;
        },
        
        calculateLimits() {
            // 1. Clean Inputs
            let cTime = this._clean(this.limitTimeStr);
            let cBytes = this._clean(this.limitBytesStr);
            let cRemainBytes = this._clean(this.remainBytesStr);
            let cRemainTime = this._clean(this.remainTimeStr);
            
            // 2. Parse Native
            this.limitTimeSecs = window.parseTimeSeconds(cTime);
            this.limitBytes = parseInt(cBytes) || 0;
            this.remainBytes = parseInt(cRemainBytes) || 0;
            this.limitTimeStrDisplay = cTime;

            // 3. API Overrides (Hybrid Fallback)
            if (this.apiData) {
                // If native failed (0), try API
                if (this.limitBytes === 0 && this.apiData.limit_quota) {
                    this.limitBytes = parseInt(this.apiData.limit_quota) || 0;
                }
                if (this.limitTimeSecs === 0 && this.apiData.limit_uptime) {
                    this.limitTimeStrDisplay = this.apiData.limit_uptime;
                    this.limitTimeSecs = window.parseTimeSeconds(this.limitTimeStrDisplay);
                }
                
                // For Data Remaining, API usually gives "data_left". 
                // If we don't have native remainBytes, try parsing API
                if (this.remainBytes === 0 && this.apiData.data_left) {
                    // Try parsing "4.4 MiB" or raw number
                    // Simple regex for raw number check
                     if (!isNaN(this.apiData.data_left)) {
                        // It's a number (bytes)
                        this.remainBytes = parseInt(this.apiData.data_left);
                    } else {
                        // It's formatted. We can't easily get exact bytes without a reverse parser.
                        // But for the Progress Bar, we need bytes. 
                        // If we can't parse, we might skip the bar update or implementation a parseBytes helper later.
                        // For now, let's assume API sends raw bytes OR we skip.
                    }
                }
            }
            
            // 4. Fallback: Infer Limit from Uptime + Remaining
            // If Limit is 0, but we have Uptime and Remaining, we can calculate the Limit.
            if (this.limitTimeSecs === 0 && this.uptimeSecs > 0) {
                let remainingSecs = 0;
                
                // Try from Native String
                if (this.remainTimeStr && !this.remainTimeStr.startsWith('$')) {
                     remainingSecs = window.parseTimeSeconds(this.remainTimeStr);
                }
                
                // Try from API if native failed
                if (remainingSecs === 0 && this.apiData && this.apiData.time_left) {
                     remainingSecs = window.parseTimeSeconds(this.apiData.time_left);
                }

                // Apply Inference
                if (remainingSecs > 0) {
                    this.limitTimeSecs = this.uptimeSecs + remainingSecs;
                    this.limitTimeStrDisplay = window.formatSeconds(this.limitTimeSecs) + ' (Est)';
                }
            }
        },
        
        getTimePercent() {
            if (this.limitTimeSecs <= 0) return 0;
            // Native Uptime is counting UP.
            // Bar: Width = Remaining %.
            // Remaining = Limit - Uptime. 
            let remaining = this.limitTimeSecs - this.uptimeSecs;
            let p = (remaining / this.limitTimeSecs) * 100;
            return p < 0 ? 0 : (p > 100 ? 100 : p);
        },
        
        getDataPercent() {
            if (this.limitBytes <= 0) return 0;
            
            // 1. Use Remain Bytes (Native or Parsed API)
            if (this.remainBytes > 0) {
                 let p = (this.remainBytes / this.limitBytes) * 100;
                 return p > 100 ? 100 : p;
            }
            
            // 2. Fallback: Estimate from API "data_left" string if needed?
            // (Skipped for safety to avoid NaN)
            
            return 0;
        },
        
        getBarColor(percent) {
             if (percent > 50) return 'bg-emerald-500';
             if (percent > 20) return 'bg-yellow-500';
             return 'bg-red-500';
        },
        
        getRemainTimeDisplay() {
            const native = this._clean(this.remainTimeStr);
            if (native) return native;
            
            if (this.apiData && this.apiData.time_left) {
                return window.formatTime(this.apiData.time_left);
            }
            return '';
        },
        
        hasRemainTime() {
            // Check native
            if (this._clean(this.remainTimeStr)) return true;
            // Check API
            if (this.apiData && this.apiData.time_left) return true;
            return false;
        },

        refresh() {
            window.location.reload();
        },

        async fetchStatus() {
            try {
                // Determine Username: Prop or Fallback
                let user = this._clean(this.username);
                // Fallback to 'customer' for debugging if username is unreplaced
                if (!user && (this.username.startsWith('$') || window.MivoConfig?.debugMode)) {
                     user = "customer"; 
                }
                
                if (!user) return; // Can't fetch without user

                const url = `${window.MivoConfig.apiBaseUrl}/api/voucher/check/${user}`;
                const res = await fetch(url, {
                    headers: { 'X-Mivo-Session': window.MivoConfig.apiSession } 
                });
                
                if (res.ok) {
                    const json = await res.json();
                    if (json && json.data) {
                        this.apiData = json.data;
                        this.calculateLimits();
                        this.fetchError = "Success";
                    } else {
                         this.fetchError = "No Data in JSON";
                    }
                } else {
                    this.fetchError = "HTTP " + res.status;
                }
            } catch (e) {
                console.error('MivoStatus: API Error', e);
                this.fetchError = e.message;
            }
        }
    };
};
