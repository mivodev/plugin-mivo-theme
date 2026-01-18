function qrMixin() {
    return {
        showQr: false,
        qrScanner: null,
        qrType: 'login', // 'login' or 'check'
        scanTarget: 'voucher', // 'voucher', 'member', 'check'
        qrResult: null,
        qrError: '',
        facingMode: 'environment', // 'environment' or 'user'

        initQr(target) {
            this.scanTarget = target;
            this.qrType = target === 'check' ? 'check' : 'login';
            this.showQr = true;
            this.qrResult = null;
            this.qrError = '';
            
            this.$nextTick(() => {
                this.startCamera();
            });
        },

        async startCamera() {
            if (this.qrScanner) {
                await this.stopCamera();
            }

            // Create instance (using Html5Qrcode directly, NOT Scanner widget)
            this.qrScanner = new Html5Qrcode("reader");
            
            const config = { fps: 10, qrbox: { width: 250, height: 250 } };
            
            try {
                await this.qrScanner.start(
                    { facingMode: this.facingMode },
                    config,
                    this.onScanSuccess.bind(this),
                    this.onScanFailure.bind(this)
                );
            } catch (err) {
                console.error("Error starting scanner", err);
                this.qrError = "Camera error: " + (err.message || err);
            }
        },

        async stopCamera() {
            if (this.qrScanner) {
                try {
                    if(this.qrScanner.isScanning) {
                        await this.qrScanner.stop();
                    }
                    this.qrScanner.clear();
                } catch (e) {
                    console.warn("Error stopping scanner", e);
                }
                this.qrScanner = null;
            }
        },

        async switchCamera() {
            this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
            await this.startCamera();
        },

        async scanFile(event) {
            const file = event.target.files[0];
            if (!file) return;

            // Stop camera temporarily if running
            await this.stopCamera();
            
            // Create temp instance for file scan
            const fileScanner = new Html5Qrcode("reader");
            
            try {
                const decodedText = await fileScanner.scanFile(file, true);
                this.onScanSuccess(decodedText, null);
            } catch (err) {
                this.qrError = "File scan failed: " + (err.message || "No QR found");
                // Resume camera if failed
                await this.startCamera();
            }
            
            // Clear file input
            event.target.value = '';
        },

        onScanSuccess(decodedText, decodedResult) {
            this.qrError = '';
            try {
                // Strict Validation
                const url = new URL(decodedText);
                const currentHost = window.location.hostname;
                const qrHost = url.hostname;

                // 1. Hostname Check (Strict)
                // Skip check for file uploads if they might come from anywhere? 
                // No, adhere to strict security even for files.
                if (qrHost !== currentHost && currentHost !== '127.0.0.1' && currentHost !== 'localhost') {
                     // Check allowed domains if implemented, otherwise strictly block
                     throw new Error('Invalid Hostname. QR is for: ' + qrHost);
                }

                // 2. Parse Data
                const params = new URLSearchParams(url.search);
                
                if (this.qrType === 'login') {
                    const u = params.get('user') || params.get('username');
                    const p = params.get('password');
                    
                    if (!u || !p) throw new Error('Invalid Login QR. Missing username/password.');
                    
                    this.qrResult = { type: 'login', username: u, password: p, display: `User: ${u}` };
                    this.stopCamera();
                } else if (this.qrType === 'check') {
                    const c = params.get('code') || params.get('user') || params.get('username');
                    
                    if (!c) throw new Error('Invalid Check QR. Missing voucher code.');
                    
                    // Directly verify without confirmation step
                    this.stopCamera();
                    this.checkCode = c;
                    this.loginType = 'check';
                    this.closeQr();
                    this.checkVoucher();
                    return; 
                }
                
            } catch (e) {
                console.warn(e);
                this.qrError = 'Security Error: ' + e.message;
            }
        },

        onScanFailure(error) {
            // Ignore frame read errors
        },

        confirmQr() {
            if (!this.qrResult) return;
            
            if (this.scanTarget === 'voucher') {
                this.auth.voucher = this.qrResult.username;
                this.loginType = 'voucher';
                this.submit();
            } else if (this.scanTarget === 'member') {
                    this.auth.username = this.qrResult.username;
                    this.auth.password = this.qrResult.password;
                    this.loginType = 'member';
                    this.submit();
            } else if (this.scanTarget === 'check') {
                this.checkCode = this.qrResult.code;
                this.loginType = 'check'; // Switch tab
                this.checkVoucher();
            }
            this.closeQr();
        },

        closeQr() {
            this.showQr = false;
            this.stopCamera();
        }
    }
}
