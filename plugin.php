<?php

use App\Core\Hooks;
use App\Core\Router;
use App\Helpers\UrlHelper; // Assuming this exists or we use global functions

/**
 * Plugin Name: Mivo Theme Downloader
 * Description: Allows downloading the Captive Portal theme with auto-configuration.
 * Version: 1.1.0
 * Author: DyzulkDev
 *
 * Category: Hotspot Tools
 * Scope: Session
 * Tags: theme, downloader, hotspot, captive-portal
 * Core Version: >= 1.2.3
 */

// 1. Register Routes
Hooks::addAction('router_init', function(Router $router) {
    
    // Page to show the download button
    $router->get('/{session}/theme/manager', function($session) {
        $title = 'Theme Manager'; // Fallback title
        
        // Include Header
        require ROOT . '/app/Views/layouts/header_main.php';
        
        // 1. Inject Plugin Translations using the new extend() method
        ?>
        <script>
            document.addEventListener('DOMContentLoaded', () => {
                if (window.i18n) {
                    window.i18n.extend({
                        "theme_manager": {
                            "title": "Theme Manager",
                            "desc": "Manage and download your captive portal theme.",
                            "download_title": "Download Mivo Theme",
                            "download_desc": "Download the fully configured captive portal theme for this router session. The package includes your specific configuration (API Base URL and Session ID) automatically injected into the theme assets.",
                            "btn_download": "Download Theme (.zip)",
                            "install_title": "Installation",
                            "install_steps": {
                                "1": "Download the zip file.",
                                "2": "Extract the contents.",
                                "3": "Upload the folders (css, fonts, js, etc.) and login.html to your Mikrotik Hotspot directory."
                            }
                        }
                    });

                    // Add Indonesian Translations if needed (or basic object merge based on current lang?)
                    // ideally extend takes a full object structure. 
                    // Wait, our i18n structure is flat language based files?
                    // i18n.js loads `/lang/{lang}.json`.
                    // So `this.translations` is the flat object for the CURRENT language.
                    // So we need to detect current lang and inject the RIGHT on.
                    
                    const currentLang = localStorage.getItem('mivo_lang') || 'en';
                    if (currentLang === 'id') {
                        window.i18n.extend({
                            "theme_manager": {
                                "title": "Manajer Tema",
                                "desc": "Kelola dan unduh tema captive portal Anda.",
                                "download_title": "Unduh Tema Mivo",
                                "download_desc": "Unduh tema captive portal yang sudah dikonfigurasi sepenuhnya untuk sesi router ini. Paket ini mencakup konfigurasi spesifik Anda (URL Dasar API dan ID Sesi) yang disuntikkan secara otomatis ke dalam aset tema.",
                                "btn_download": "Unduh Tema (.zip)",
                                "install_title": "Instalasi",
                                "install_steps": {
                                    "1": "Unduh file zip.",
                                    "2": "Ekstrak isinya.",
                                    "3": "Unggah folder (css, fonts, js, dll.) dan login.html ke direktori Hotspot Mikrotik Anda."
                                }
                            }
                        });
                    }
                }
            });
        </script>

        <div class="space-y-6">
             <div class="mb-6">
                <h1 class="text-2xl font-bold tracking-tight" data-i18n="theme_manager.title">Theme Manager</h1>
                <p class="text-sm text-accents-5" data-i18n="theme_manager.desc">Manage and download your captive portal theme.</p>
             </div>

             <div class="card p-6 max-w-2xl">
                <h2 class="text-lg font-semibold mb-2" data-i18n="theme_manager.download_title">Download Mivo Theme</h2>
                <p class="text-accents-5 mb-6 text-sm" data-i18n="theme_manager.download_desc">Download the fully configured captive portal theme for this router session. The package includes your specific configuration (API Base URL and Session ID) automatically injected into the theme assets.</p>
                
                <form action="/<?= htmlspecialchars($session) ?>/theme/download" method="POST" target="_blank">
                    <button type="submit" class="btn btn-primary px-6 py-2.5 font-semibold text-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-download mr-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                        <span data-i18n="theme_manager.btn_download">Download Theme (.zip)</span>
                    </button>
                </form>

                <div class="mt-6 pt-6 border-t border-accents-2">
                    <h3 class="text-sm font-semibold mb-2" data-i18n="theme_manager.install_title">Installation</h3>
                    <ol class="list-decimal list-inside text-sm text-accents-5 space-y-1">
                        <li data-i18n="theme_manager.install_steps.1">Download the zip file.</li>
                        <li data-i18n="theme_manager.install_steps.2">Extract the contents.</li>
                        <li data-i18n="theme_manager.install_steps.3">Upload the folders (css, fonts, js, etc.) and login.html to your Mikrotik Hotspot directory.</li>
                    </ol>
                </div>
            </div>
        </div>
        <?php
        
        // Include Footer
        require ROOT . '/app/Views/layouts/footer_main.php';
    });

    // Handle Download Process
    $router->post('/{session}/theme/download', function($session) {
        $sourcePath = __DIR__ . '/theme';
        if (!is_dir($sourcePath)) {
            die("Theme source not found.");
        }

        // Determine Configuration
        $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || $_SERVER['SERVER_PORT'] == 443) ? "https://" : "http://";
        $host = $_SERVER['HTTP_HOST'];
        $baseUrl = $protocol . $host . '/mivo/public'; // Adjust if needed based on real deployment, maybe just $protocol . $host if root
        // If app is in root:
        $baseUrl = $protocol . $host;
        
        // Prepare Zip
        $zipFile = sys_get_temp_dir() . '/mivo-theme-' . $session . '-' . date('YmdHis') . '.zip';
        $zip = new ZipArchive();
        
        if ($zip->open($zipFile, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== TRUE) {
            die("Cannot create zip file.");
        }

        $files = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($sourcePath, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::LEAVES_ONLY
        );

        foreach ($files as $name => $file) {
            if ($file->isDir()) continue;

            $filePath = $file->getRealPath();
            $relativePath = substr($filePath, strlen($sourcePath) + 1);
            
            // Normalize slashes for Zip
            $zipPath = str_replace('\\', '/', $relativePath);

            if (strpos($zipPath, 'assets/js/main.js') !== false) {
                // Read and Replace
                $content = file_get_contents($filePath);
                
                // Replacements
                $content = str_replace('apiBaseUrl: ""', 'apiBaseUrl: "' . $baseUrl . '"', $content);
                $content = str_replace('apiSession: "router-jakarta-1"', 'apiSession: "' . $session . '"', $content);
                
                $zip->addFromString($zipPath, $content);
            } else {
                $zip->addFile($filePath, $zipPath);
            }
        }

        $zip->close();

        // Serve File
        if (file_exists($zipFile)) {
            header('Content-Description: File Transfer');
            header('Content-Type: application/zip');
            header('Content-Disposition: attachment; filename="mivo-theme-'.$session.'.zip"');
            header('Expires: 0');
            header('Cache-Control: must-revalidate');
            header('Pragma: public');
            header('Content-Length: ' . filesize($zipFile));
            readfile($zipFile);
            unlink($zipFile);
            exit;
        } else {
            die("Failed to create zip.");
        }
    });

});

// 2. Inject Menu into Sidebar (Using Footer JS Hack)
Hooks::addAction('mivo_footer', function() {
    // Get current session from URL if possible
    $uri = $_SERVER['REQUEST_URI'] ?? '/';
    $parts = explode('/', trim($uri, '/'));
    if (count($parts) >= 2 && $parts[1] === 'dashboard' || isset($parts[0])) {
        $session = $parts[0]; // Assuming /{session}/...
        
        // Check if it's a valid session context looking like a session string
        // Simple basic check to avoid injecting on non-session pages
        if (!empty($session) && $session !== 'settings' && $session !== 'login' && $session !== 'install') {
            ?>
            <script>
            document.addEventListener("DOMContentLoaded", function() {
                // Find the Hotspot Menu Container
                const hotspotMenu = document.getElementById('hotspot-menu');
                if (hotspotMenu) {
                    // Inject Translation for Menu
                    if (window.i18n) {
                         const currentLang = localStorage.getItem('mivo_lang') || 'en';
                         const menuTrans = {
                             "en": { "sidebar": { "theme_manager": "Theme Manager" } },
                             "id": { "sidebar": { "theme_manager": "Manajer Tema" } }
                         };
                         // Merge relevant lang
                         if (menuTrans[currentLang]) {
                             window.i18n.extend(menuTrans[currentLang]);
                         } else {
                             window.i18n.extend(menuTrans['en']);
                         }
                    }

                    // Create Link
                    const link = document.createElement('a');
                    link.href = '/<?= $session ?>/theme/manager';
                    link.className = 'block px-3 py-2 rounded-md text-sm transition-colors text-accents-6 hover:text-foreground';
                    link.innerHTML = '<span data-i18n="sidebar.theme_manager">Theme Manager</span>';
                    
                    // Add styles to match active state if needed (simplified)
                    if (window.location.pathname.includes('/theme/manager')) {
                        link.className = 'block px-3 py-2 rounded-md text-sm transition-colors bg-white/40 dark:bg-white/5 text-foreground ring-1 ring-white/10 font-medium';
                    }

                    // Append
                    hotspotMenu.appendChild(link);
                }
            });
            </script>
            <?php
        }
    }
});
