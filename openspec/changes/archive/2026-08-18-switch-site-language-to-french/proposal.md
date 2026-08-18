## Why

The multi-warehouse tool distribution system is currently hardcoded and presented in English. However, operational staff, warehouse managers, cashiers, and administrative users operate in a French-speaking environment. Changing the site language to French (Français) ensures higher operational efficiency, eliminates miscommunication in warehouse inventory and sales workflows, reduces user errors during critical transactions, and meets localized business workflow expectations.

## What Changes

- **Full French UI Localization**: Translate all user interface elements across all modules (Authentication, Dashboard, Inventory, Products, Sales, Transfers, Expenses, Salaries, Employees, Reports, and Admin Settings) from English to French.
- **Localized Navigation & Layouts**: Update header bars, sidebar navigation links, warehouse context selectors, user profile pills, action buttons, and modal dialogs to French.
- **Localized Form Validation & Feedback Messages**: Translate form field labels, placeholder texts, input validation errors, API response toast notifications, confirmation prompts, and empty state descriptions into French.
- **Locale-Aware Formatting**: Ensure dates, timestamps, numbers, and currency formatting adhere to French locale conventions (e.g., `fr-FR` or localized regional formatting).
- **Translation Management Structure**: Establish a clean, maintainable translation dictionary/i18n structure in the Vue 3 frontend for consistent text representation across components.

## Capabilities

### New Capabilities
- `localization-french`: Complete French localization system for the frontend UI, covering navigation, views, modal dialogues, notifications, status badges, and locale-aware number and date formatting.

### Modified Capabilities
- `ui-design-system`: Update UI design system requirements to specify French interface copy standards, localized typography and formatting, and layout adaptations for French text length expansion.

## Impact

- **Frontend Codebase**: All Vue 3 layouts (`DashboardLayout.vue`, `AuthLayout.vue`), views (`views/**/*.vue`), components (`components/**/*.vue`), router navigation titles, and store notification messages will be updated to French.
- **Dependencies**: Potential addition of `@intlify/unplugin-vue-i18n` or `vue-i18n` if modular dictionary-based translation is selected, or centralized translation dictionary modules.
- **Backend API**: No breaking schema or API endpoint changes; backend enum codes remain intact while the frontend translates display values (e.g., status badges, roles).
