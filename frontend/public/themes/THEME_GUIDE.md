# Sigil UI Theme Guide (v2)

This guide explains how to create custom themes for the Sigil UI frontend using the updated CSS variable structure.

## Theme File Format

Theme files are standard CSS files placed in the `frontend/public/themes/` directory (e.g., `MyCoolTheme.css`).

Themes define CSS custom properties (variables) within a `:root` block. The UI components use these variables to style themselves.

The structure provides variables for both **dark mode (default)** and **light mode**. A `body.light-mode` rule at the end of the theme file overrides the base variables for light mode display.

## Core Concepts

1.  **Dark Mode First:** Define all `--variable-dark` colors within the main `:root` block. These are the defaults.
2.  **Light Mode Variants:** Define corresponding `--variable-light` colors within the main `:root` block.
3.  **Base Variables:** Define base variables (e.g., `--background`, `--primary`) that point to the *dark mode* versions initially.
4.  **Light Mode Overrides:** Use the `body.light-mode` selector at the end of the file to switch the base variables to their *light mode* counterparts (e.g., `body.light-mode { --background: var(--background-light); --primary: var(--primary-light); }`).

## CSS Variable Structure

Refer to `Starshine.css` for a complete example. Here's a breakdown of the variable groups:

### 1. Original Mappings (Optional Comments)

It's helpful to include comments mapping any original color palette values if you're adapting an older theme.

```css
/* Original Mappings (Example) */
--button-background-base: #00E0C6; /* Mapped to --primary-dark */
--header-text-color: #a369ff;
/* ... etc ... */
```

### 2. Derived & Default Colors

This is the main section where you define the specific colors for your theme for both dark and light modes.

*   **Backgrounds:**
    *   `--background-dark`, `--background-light`: Overall page background.
    *   `--surface-dark`, `--surface-light`: Background for main content areas like the chat container.
    *   `--panel-bg-dark`, `--panel-bg-light`: Background for side panels.
*   **Inputs:**
    *   `--input-bg-dark`, `--input-bg-light`: Background of text inputs, textareas.
    *   `--disabled-bg-dark`, `--disabled-bg-light`: Background for disabled elements.
    *   `--disabled-fg-dark`, `--disabled-fg-light`: Foreground (text) for disabled elements.
*   **Panel Tabs:**
    *   `--panel-tab-bg-dark`, `--panel-tab-bg-light`: Background of inactive panel tabs.
    *   `--panel-tab-active-bg-dark`, `--panel-tab-active-bg-light`: Background of the active panel tab.
    *   `--panel-tab-text-dark`, `--panel-tab-text-light`: Text color of inactive tabs.
    *   `--panel-tab-active-text-dark`, `--panel-tab-active-text-light`: Text color of the active tab.
    *   `--panel-container-bg-dark`, `--panel-container-bg-light`: Background of the content area below the tabs.
*   **Buttons:**
    *   `--primary-dark`, `--primary-light`: Background color for primary action buttons (e.g., Send, Apply Settings).
    *   `--primary-hover-dark`, `--primary-hover-light`: Hover background for primary buttons.
    *   `--button-foreground-dark`, `--button-foreground-light`: Text color *on* primary buttons.
    *   `--button-bg-dark`, `--button-bg-light`: Background for *secondary* buttons (e.g., Load Model).
    *   `--button-hover-bg-dark`, `--button-hover-bg-light`: Hover background for secondary buttons.
    *   `--button-border-dark`, `--button-border-light`: Border color for secondary buttons.
    *   `--button-text-dark`, `--button-text-light`: Text color for secondary buttons.
*   **Focus Ring:**
    *   `--primary-focus-dark`, `--primary-focus-light`: Color (often semi-transparent) for the focus outline around interactive elements.
*   **Settings Panel & Input Details:** (These often reuse other variables but allow specific overrides)
    *   `--surface-input-dark`, `--surface-input-light`: Input background within settings panels.
    *   `--border-input-dark`, `--border-input-light`: Input border within settings panels.
    *   `--focus-ring-accent-dark`, `--focus-ring-accent-light`: Accent color used in focus styles.
    *   `--focus-ring-color-dark`, `--focus-ring-color-light`: Main color for focus ring styles.
    *   `--text-secondary-dark`, `--text-secondary-light`: Color for secondary text/labels.
    *   `--primary-contrast-dark`, `--primary-contrast-light`: Contrast color for text on primary backgrounds.
    *   `--surface-disabled-dark`, `--surface-disabled-light`: Background for disabled surfaces.
    *   `--text-disabled-dark`, `--text-disabled-light`: Text color for disabled elements.
    *   `--surface-hover-dark`, `--surface-hover-light`: Background color for hovered surfaces (like list items).
    *   `--border-input-hover-dark`, `--border-input-hover-light`: Border color for inputs on hover.

### 3. Base Variable Definitions

Define the base variables used by the UI, initially pointing to the dark mode versions.

```css
/* --- Base variables that will be switched --- */
--background: var(--background-dark);
--surface: var(--surface-dark);
--panel-bg-color: var(--panel-bg-dark);
--input-bg: var(--input-bg-dark);
/* ... etc for all groups ... */
--primary: var(--primary-dark);
--button-foreground: var(--button-foreground-dark);
--button-bg: var(--button-bg-dark);
/* ... etc ... */
```

### 4. Light Mode Overrides

Use the `body.light-mode` selector to switch the base variables to their light counterparts.

```css
/* --- Light Mode Overrides --- */
body.light-mode {
  /* Base */
  --background: var(--background-light);
  --surface: var(--surface-light);
  --panel-bg-color: var(--panel-bg-light);
  --input-bg: var(--input-bg-light);
  /* ... etc for all groups ... */
  --primary: var(--primary-light);
  --button-foreground: var(--button-foreground-light);
  --button-bg: var(--button-bg-light);
  /* ... etc ... */
}
```

## Creating a New Theme

1.  **Copy:** Duplicate an existing theme file (like `Starshine.css`).
2.  **Rename:** Rename the file (e.g., `MyTheme.css`).
3.  **Modify Colors:** Adjust the `--variable-dark` and `--variable-light` values in the "Derived & Default Colors" section to match your desired palette. You can use standard CSS color formats (`#rrggbb`, `rgb()`, `hsl()`, etc.).
4.  **Test:** Select your theme from the Interface panel in the UI to see the results.

## Helper Script (Coming Soon!)

A helper script is planned to simplify the process of generating a new theme template by prompting for key colors and deriving the rest automatically. Stay tuned! 