class I18n {
    constructor() {
        this.currentLang = localStorage.getItem('mivo_lang') || 'en';
        this.translations = {};
        this.isLoaded = false;
        this.init();
    }

    async init() {
        await this.loadLanguage(this.currentLang);
        this.isLoaded = true;
    }

    async loadLanguage(lang) {
        try {
            const response = await fetch(`assets/lang/${lang}.json`);
            if (!response.ok) throw new Error(`Failed to load: ${lang}`);
            
            this.translations = await response.json();
            this.currentLang = lang;
            localStorage.setItem('mivo_lang', lang);
            this.applyTranslations();
            
            document.documentElement.lang = lang;
            window.dispatchEvent(new CustomEvent('language-changed', { detail: { lang } }));
        } catch (error) {
            console.error('I18n Error:', error);
        }
    }

    applyTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.getNestedValue(this.translations, key);
            
            if (translation) {
                if (element.tagName === 'INPUT' && element.getAttribute('placeholder')) {
                    element.placeholder = translation;
                } else {
                    element.textContent = translation;
                }
            }
        });
    }

    getNestedValue(obj, path) {
        return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    }
}

window.i18n = new I18n();

function changeLanguage(lang) {
    window.i18n.loadLanguage(lang);
}
