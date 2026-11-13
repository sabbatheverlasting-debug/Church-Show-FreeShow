# Church Show FreeShow — Monterey

Based on FreeShow v1.6.7 (436d4b634878ba723da1d1373637384ec700ce16).
The upstream menus, projects and library tabs are retained.

Build: npm ci, npm run build, then npx electron-builder --config config/building/church-show.yaml --mac dmg --x64 --publish never.

This initial build is a separate application and uses Documents/Church Show FreeShow. Import a backup through FreeShow's import tools; do not point it at your live original library during testing.

Automatic upstream updates are disabled because newer releases no longer support macOS Monterey. The installer is unsigned. Actual Monterey hardware testing is required.

Pending: Church Show projector theme, study tools, children’s activities and quiz integration. These have not yet been ported.

FreeShow's GPL-3.0 license and original attribution remain in place.
