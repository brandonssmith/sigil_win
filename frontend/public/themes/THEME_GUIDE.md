# Prometheus UI Theme Guide

This document explains how to create custom themes for the Prometheus UI frontend.

## Theme File Format

Theme files should be placed in the `frontend/src/assets/themes/` directory and have the `.theme` extension (e.g., `MyCoolTheme.theme`).

The format is inspired by Ghostty terminal themes, using simple key-value pairs:

```
# Lines starting with # are comments and are ignored.
# Empty lines are also ignored.

# General Colors
background = #121212
foreground = #e0e0e0
cursor-color = #bb86fc
selection-background = #33334d
selection-foreground = #e0e0e0

# Palette Colors (0-15)
# These are used for various UI elements.
palette = 0 = #1f1f1f
palette = 1 = #cf6679
palette = 2 = #03dac6
palette = 3 = #f3bd09
palette = 4 = #33334d
palette = 5 = #bb86fc
palette = 6 = #03dac6
palette = 7 = #e0e0e0
palette = 8 = #d6dbe5
palette = 9 = #de352e
palette = 10 = #1dd361
palette = 11 = #f3bd09
palette = 12 = #1081d6
palette = 13 = #5350b9
palette = 14 = #0f7ddb
palette = 15 = #ffffff
```

*   **Keys:** `background`, `foreground`, `cursor-color`, `selection-background`, `selection-foreground`, and `palette = N` (where N is 0 to 15).
*   **Values:** Standard CSS hex color codes (e.g., `#RRGGBB` or `#RGB`).
*   **Parsing:** The parser converts keys to lowercase and standardizes `palette = N` to `palette_N` (e.g., `palette_0`).
*   **Fallback:** If a key is missing in your theme file, a default color defined in `App.css` will be used.

## CSS Variable Mapping

The application reads your theme file and applies the colors to CSS variables defined in `frontend/src/App.css`. The UI elements then use these variables.

Here's a mapping of the theme file keys to the primary CSS variables and their intended use:

| Theme Key              | CSS Variable                   | Default    | Primary Usage                                                                  |
| :--------------------- | :----------------------------- | :--------- | :----------------------------------------------------------------------------- |
| `background`           | `--theme-background`           | `#121212`  | Main background of the app, chat area.                                         |
| `foreground`           | `--theme-foreground`           | `#e0e0e0`  | Default text color, message text, input text.                                  |
| `cursor-color`         | `--theme-cursor-color`         | `#bb86fc`  | *Not directly used currently, but available.*                                  |
| `selection-background` | `--theme-selection-background` | `#33334d`  | Background color of selected text.                                             |
| `selection-foreground` | `--theme-selection-foreground` | `#e0e0e0`  | Text color of selected text.                                                   |
|                        |                                |            |                                                                                |
| `palette_0`            | `--theme-palette-0`            | `#1f1f1f`  | Panel/Header BG, Backend Msg BG, Input BG base, Border base, Scrollbar Track |
| `palette_1`            | `--theme-palette-1`            | `#cf6679`  | Error text color base.                                                         |
| `palette_2`            | `--theme-palette-2`            | `#03dac6`  | Success text color base, Loading dots flash color.                             |
| `palette_3`            | `--theme-palette-3`            | `#f3bd09`  | Yellow/Warning (available for future use).                                     |
| `palette_4`            | `--theme-palette-4`            | `#33334d`  | User message background, Scrollbar thumb color.                                |
| `palette_5`            | `--theme-palette-5`            | `#bb86fc`  | Header text color, Focus ring color base.                                      |
| `palette_6`            | `--theme-palette-6`            | `#03dac6`  | Button background color base.                                                  |
| `palette_7`            | `--theme-palette-7`            | `#e0e0e0`  | Primary text color (alternative to `foreground`).                              |
| `palette_8`            | `--theme-palette-8`            | `#d6dbe5`  | Lighter grey (available).                                                      |
| `palette_9`            | `--theme-palette-9`            | `#de352e`  | Alternative Red (available).                                                   |
| `palette_10`           | `--theme-palette-10`           | `#1dd361`  | Alternative Green (available).                                                 |
| `palette_11`           | `--theme-palette-11`           | `#f3bd09`  | Alternative Yellow (available).                                                |
| `palette_12`           | `--theme-palette-12`           | `#1081d6`  | Alternative Blue (available).                                                  |
| `palette_13`           | `--theme-palette-13`           | `#5350b9`  | Alternative Purple (available).                                                |
| `palette_14`           | `--theme-palette-14`           | `#0f7ddb`  | Alternative Cyan (available).                                                  |
| `palette_15`           | `--theme-palette-15`           | `#ffffff`  | White (available).                                                             |

**Derived CSS Variables:**

Many specific UI elements use derived variables that are defined in `App.css` based on the primary variables above. This allows for fine-tuning using functions like `color-mix()` for transparency or slight variations.

Examples (`App.css`):

*   `--theme-panel-background: var(--theme-palette-0, #252525);`
*   `--theme-input-background: var(--theme-palette-0, #333);`
*   `--theme-border-color: color-mix(in srgb, var(--theme-palette-0, #333) 80%, transparent);`
*   `--theme-user-message-bg: var(--theme-palette-4, #33334d);`
*   `--theme-backend-message-bg: var(--theme-palette-0, #2a2a2a);`
*   `--theme-button-background: var(--theme-palette-6, #03dac6);`
*   `--theme-button-text: var(--theme-background, #121212);` (Uses main background for contrast)
*   `--theme-button-hover-background: color-mix(in srgb, var(--theme-button-background, #03dac6) 90%, black);`
*   `--theme-header-background: var(--theme-panel-background);`
*   `--theme-header-text: var(--theme-palette-5, #bb86fc);`
*   `--theme-error-text: var(--theme-palette-1, #cf6679);`
*   `--theme-error-background: color-mix(in srgb, var(--theme-error-text, #cf6679) 10%, transparent);`
*   `--theme-success-text: var(--theme-palette-2, #03dac6);`
*   `--theme-success-background: color-mix(in srgb, var(--theme-success-text, #03dac6) 15%, transparent);`
*   `--theme-scrollbar-thumb: var(--theme-palette-4, #444);`
*   `--theme-scrollbar-track: var(--theme-palette-0, #1e1e1e);`
*   `--theme-focus-ring: color-mix(in srgb, var(--theme-palette-5, #bb86fc) 30%, transparent);`
*   `--theme-label-color: color-mix(in srgb, var(--theme-foreground, #e0e0e0) 80%, transparent);`
*   `--theme-dots-color: color-mix(in srgb, var(--theme-foreground, #e0e0e0) 60%, transparent);`
*   `--theme-dots-flash-color: var(--theme-success-text);`
*   `--theme-disabled-background: color-mix(in srgb, var(--theme-foreground, #e0e0e0) 30%, transparent);`
*   `--theme-disabled-text: color-mix(in srgb, var(--theme-foreground, #e0e0e0) 50%, transparent);`

By customizing the `background`, `foreground`, and `palette_0` through `palette_15` values in your `.theme` file, you can significantly alter the look and feel of the UI. 