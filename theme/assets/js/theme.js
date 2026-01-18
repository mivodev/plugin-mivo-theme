function initTheme() {
    return {
        theme: localStorage.getItem('mivo_theme') || 'dark',
        toggle() {
            this.theme = this.theme === 'dark' ? 'light' : 'dark';
            this.apply();
        },
        setTheme(val) {
            this.theme = val;
            this.apply();
        },
        apply() {
            localStorage.setItem('mivo_theme', this.theme);
            if (this.theme === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        },
        init() {
            this.apply();
        }
    }
}
