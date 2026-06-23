# Reference · CSS variables (complete)

**Every** CSS custom property Velt exposes — the complete set, extracted verbatim from the SDK. Override in your own stylesheet (see [`../approaches/css.md`](../approaches/css.md)). Variables cross the shadow DOM; class CSS needs `shadowDom={false}` or `injectCustomCss` (R6).

- **Modern `--velt-*`** — use these.
- **Legacy `--legacy-velt-*`** — older surfaces only.

> Generated from source. This lists the `--velt-*` properties intended for theming; a small number of internal/feature-scoped names exist in source but are not meant to be overridden directly.

---

## Modern `--velt-*`

### Active (theme-resolved) color tokens
> These are the live tokens components actually read. Each resolves to its `--velt-light-mode-*` value (or `--velt-dark-mode-*` under `[data-velt-theme="dark"]`). Override a single token to retheme everywhere it's used; override the `light-mode`/`dark-mode` pair to retheme per theme.
```
--velt-accent: var(--velt-light-mode-accent) / var(--velt-dark-mode-accent)
--velt-accent-foreground: var(--velt-*-mode-accent-foreground)
--velt-accent-hover: var(--velt-*-mode-accent-hover)
--velt-accent-light: var(--velt-*-mode-accent-light)
--velt-accent-text: var(--velt-*-mode-accent-text)
--velt-accent-transparent: var(--velt-*-mode-accent-transparent)
--velt-animation-transparent: var(--velt-*-mode-animation-transparent)
--velt-background-0: var(--velt-*-mode-background-0)
--velt-background-1: var(--velt-*-mode-background-1)
--velt-background-2: var(--velt-*-mode-background-2)
--velt-background-3: var(--velt-*-mode-background-3)
--velt-background-4: var(--velt-*-mode-background-4)
--velt-background-5: var(--velt-*-mode-background-5)
--velt-background-6: var(--velt-*-mode-background-6)
--velt-background-7: var(--velt-*-mode-background-7)
--velt-background-8: var(--velt-*-mode-background-8)
--velt-background-9: var(--velt-*-mode-background-9)
--velt-background-10: var(--velt-*-mode-background-10)
--velt-background-transparent: var(--velt-*-mode-background-transparent)
--velt-border-0: var(--velt-*-mode-border-0)
--velt-border-1: var(--velt-*-mode-border-1)
--velt-border-2: var(--velt-*-mode-border-2)
--velt-border-3: var(--velt-*-mode-border-3)
--velt-border-4: var(--velt-*-mode-border-4)
--velt-border-5: var(--velt-*-mode-border-5)
--velt-border-6: var(--velt-*-mode-border-6)
--velt-border-7: var(--velt-*-mode-border-7)
--velt-border-8: var(--velt-*-mode-border-8)
--velt-border-9: var(--velt-*-mode-border-9)
--velt-border-10: var(--velt-*-mode-border-10)
--velt-border-transparent: var(--velt-*-mode-border-transparent)
--velt-text-0: var(--velt-*-mode-text-0)
--velt-text-1: var(--velt-*-mode-text-1)
--velt-text-2: var(--velt-*-mode-text-2)
--velt-text-3: var(--velt-*-mode-text-3)
--velt-text-4: var(--velt-*-mode-text-4)
--velt-text-5: var(--velt-*-mode-text-5)
--velt-text-6: var(--velt-*-mode-text-6)
--velt-text-7: var(--velt-*-mode-text-7)
--velt-text-8: var(--velt-*-mode-text-8)
--velt-text-9: var(--velt-*-mode-text-9)
--velt-text-10: var(--velt-*-mode-text-10)
--velt-text-11: var(--velt-*-mode-text-11)
--velt-text-12: var(--velt-*-mode-text-12)
--velt-black: var(--velt-*-mode-black)
--velt-white: var(--velt-*-mode-white)
--velt-gray: var(--velt-*-mode-gray)
--velt-green: var(--velt-*-mode-green)
--velt-amber: var(--velt-*-mode-amber)
--velt-cyan: var(--velt-*-mode-cyan)
--velt-magenta: var(--velt-*-mode-magenta)
--velt-orange: var(--velt-*-mode-orange)
--velt-purple: var(--velt-*-mode-purple)
--velt-error: var(--velt-*-mode-error)
--velt-error-foreground: var(--velt-*-mode-error-foreground)
--velt-error-hover: var(--velt-*-mode-error-hover)
--velt-error-light: var(--velt-*-mode-error-light)
--velt-error-transparent: var(--velt-*-mode-error-transparent)
--velt-success: var(--velt-*-mode-success)
--velt-success-foreground: var(--velt-*-mode-success-foreground)
--velt-success-hover: var(--velt-*-mode-success-hover)
--velt-success-light: var(--velt-*-mode-success-light)
--velt-success-transparent: var(--velt-*-mode-success-transparent)
--velt-warning: var(--velt-*-mode-warning)
--velt-warning-foreground: var(--velt-*-mode-warning-foreground)
--velt-warning-hover: var(--velt-*-mode-warning-hover)
--velt-warning-light: var(--velt-*-mode-warning-light)
--velt-warning-transparent: var(--velt-*-mode-warning-transparent)
```

### Spacing
```
--velt-base-rem-unit: 1   (multiplier the rem() scale is built on)
--velt-spacing-2xl: #{rem(1.5)}
--velt-spacing-2xs: #{rem(0.125)}
--velt-spacing-3xl: 80px
--velt-spacing-lg: #{rem(1)}
--velt-spacing-md: #{rem(0.75)}
--velt-spacing-sm: #{rem(0.5)}
--velt-spacing-xl: #{rem(1.25)}
--velt-spacing-xs: #{rem(0.25)}
```

### Border radius
```
--velt-border-radius-2xl: #{rem(1.5)}
--velt-border-radius-2xs: #{rem(0.125)}
--velt-border-radius-3xl: #{rem(2)}
--velt-border-radius-full: #{rem(5)}
--velt-border-radius-lg: #{rem(1)}
--velt-border-radius-md: #{rem(0.75)}
--velt-border-radius-sm: #{rem(0.5)}
--velt-border-radius-xl: #{rem(1.25)}
--velt-border-radius-xs: #{rem(0.25)}
```

### Font
```
--velt-default-font-family: sans-serif
--velt-font-size-2xl: #{rem(2)}
--velt-font-size-2xs: #{rem(0.625)}
--velt-font-size-lg: #{rem(1.5)}
--velt-font-size-md: #{rem(1)}
--velt-font-size-sm: #{rem(0.875)}
--velt-font-size-xl: #{rem(1.75)}
--velt-font-size-xs: #{rem(0.75)}
```

### Font weights
> Consumed via `font-weight: var(--velt-font-weight-N)`. No literal default in source — set to the numeric weight you want.
```
--velt-font-weight-400   (regular)
--velt-font-weight-500   (medium)
--velt-font-weight-600   (semibold)
```

### Icon sizes
```
--Icon-Size-Large: 24px
--Icon-Size-Medium: 16px
--Icon-Size-Small: 12px
```

### Light mode
```
--velt-light-mode-accent-foreground: #FFFFFF
--velt-light-mode-accent-hover: #534FCF
--velt-light-mode-accent-light: #F2F2FE
--velt-light-mode-accent-text: #625DF5
--velt-light-mode-accent-transparent: rgba(148, 145, 248, 0.08)
--velt-light-mode-accent: #625DF5
--velt-light-mode-amber: #FF7162
--velt-light-mode-animation-transparent: rgba(255, 255, 255, 0.2)
--velt-light-mode-background-0: #FFFFFF
--velt-light-mode-background-1: #FAFAFA
--velt-light-mode-background-10: #CCCCCC
--velt-light-mode-background-2: #F5F5F5
--velt-light-mode-background-3: #F0F0F0
--velt-light-mode-background-4: #EBEBEB
--velt-light-mode-background-5: #E5E5E5
--velt-light-mode-background-6: #E0E0E0
--velt-light-mode-background-7: #DBDBDB
--velt-light-mode-background-8: #D6D6D6
--velt-light-mode-background-9: #D1D1D1
--velt-light-mode-background-transparent: rgba(255, 255, 255, 0.80)
--velt-light-mode-black: #080808
--velt-light-mode-border-0: #FFFFFF
--velt-light-mode-border-1: #FAFAFA
--velt-light-mode-border-10: #CCCCCC
--velt-light-mode-border-2: #F5F5F5
--velt-light-mode-border-3: #F0F0F0
--velt-light-mode-border-4: #EBEBEB
--velt-light-mode-border-5: #E5E5E5
--velt-light-mode-border-6: #E0E0E0
--velt-light-mode-border-7: #DBDBDB
--velt-light-mode-border-8: #D6D6D6
--velt-light-mode-border-9: #D1D1D1
--velt-light-mode-border-transparent: rgba(0, 0, 0, 0.16)
--velt-light-mode-cyan: #4BC9F0
--velt-light-mode-error-foreground: #FFFFFF
--velt-light-mode-error-hover: #DE5041
--velt-light-mode-error-light: #FFF4F2
--velt-light-mode-error-transparent: rgba(255, 113, 98, 0.08)
--velt-light-mode-error: #FF7162
--velt-light-mode-gray: #EBEBEB
--velt-light-mode-green: #0DCF82
--velt-light-mode-magenta: #A259FE
--velt-light-mode-orange: #FE965C
--velt-light-mode-purple: #625DF5
--velt-light-mode-success-foreground: #FFFFFF
--velt-light-mode-success-hover: #006B41
--velt-light-mode-success-light: #EDF6F3
--velt-light-mode-success-transparent: rgba(25, 143, 101, 0.08)
--velt-light-mode-success: #198F65
--velt-light-mode-text-0: #0A0A0A
--velt-light-mode-text-1: #141414
--velt-light-mode-text-10: #B8B8B8
--velt-light-mode-text-11: #A3A3A3
--velt-light-mode-text-12: #8F8F8F
--velt-light-mode-text-2: #1F1F1F
--velt-light-mode-text-3: #292929
--velt-light-mode-text-4: #3D3D3D
--velt-light-mode-text-5: #525252
--velt-light-mode-text-6: #666666
--velt-light-mode-text-7: #7A7A7A
--velt-light-mode-text-8: #858585
--velt-light-mode-text-9: #999999
--velt-light-mode-warning-foreground: #474747
--velt-light-mode-warning-hover: #C69400
--velt-light-mode-warning-light: #FFFBEE
--velt-light-mode-warning-transparent: rgba(255, 205, 46, 0.08)
--velt-light-mode-warning: #FFCD2E
--velt-light-mode-white: #FFFFFF
```

### Dark mode
```
--velt-dark-mode-accent-foreground: #FFFFFF
--velt-dark-mode-accent-hover: #534FCF
--velt-dark-mode-accent-light: #F2F2FE
--velt-dark-mode-accent-text: #9491F8
--velt-dark-mode-accent-transparent: rgba(148, 145, 248, 0.08)
--velt-dark-mode-accent: #625DF5
--velt-dark-mode-amber: #FF7162
--velt-dark-mode-animation-transparent: rgba(255, 255, 255, 0.2)
--velt-dark-mode-background-0: #0F0F0F
--velt-dark-mode-background-1: #1A1A1A
--velt-dark-mode-background-10: #474747
--velt-dark-mode-background-2: #1F1F1F
--velt-dark-mode-background-3: #242424
--velt-dark-mode-background-4: #292929
--velt-dark-mode-background-5: #2E2E2E
--velt-dark-mode-background-6: #333333
--velt-dark-mode-background-7: #383838
--velt-dark-mode-background-8: #3D3D3D
--velt-dark-mode-background-9: #424242
--velt-dark-mode-background-transparent: rgba(0, 0, 0, 0.80)
--velt-dark-mode-black: #080808
--velt-dark-mode-border-0: #0F0F0F
--velt-dark-mode-border-1: #1A1A1A
--velt-dark-mode-border-10: #474747
--velt-dark-mode-border-2: #1F1F1F
--velt-dark-mode-border-3: #242424
--velt-dark-mode-border-4: #292929
--velt-dark-mode-border-5: #2E2E2E
--velt-dark-mode-border-6: #333333
--velt-dark-mode-border-7: #383838
--velt-dark-mode-border-8: #3D3D3D
--velt-dark-mode-border-9: #424242
--velt-dark-mode-border-transparent: rgba(255, 255, 255, 0.16)
--velt-dark-mode-cyan: #4BC9F0
--velt-dark-mode-error-foreground: #FFFFFF
--velt-dark-mode-error-hover: #DE5041
--velt-dark-mode-error-light: #FFF4F2
--velt-dark-mode-error-transparent: rgba(255, 113, 98, 0.08)
--velt-dark-mode-error: #FF7162
--velt-dark-mode-gray: #EBEBEB
--velt-dark-mode-green: #0DCF82
--velt-dark-mode-magenta: #A259FE
--velt-dark-mode-orange: #FE965C
--velt-dark-mode-purple: #625DF5
--velt-dark-mode-success-foreground: #FFFFFF
--velt-dark-mode-success-hover: #006B41
--velt-dark-mode-success-light: #EDF6F3
--velt-dark-mode-success-transparent: rgba(25, 143, 101, 0.08)
--velt-dark-mode-success: #198F65
--velt-dark-mode-text-0: #FFFFFF
--velt-dark-mode-text-1: #F5F5F5
--velt-dark-mode-text-10: #525252
--velt-dark-mode-text-11: #474747
--velt-dark-mode-text-12: #3D3D3D
--velt-dark-mode-text-2: #EBEBEB
--velt-dark-mode-text-3: #E0E0E0
--velt-dark-mode-text-4: #D6D6D6
--velt-dark-mode-text-5: #C2C2C2
--velt-dark-mode-text-6: #ADADAD
--velt-dark-mode-text-7: #8F8F8F
--velt-dark-mode-text-8: #7A7A7A
--velt-dark-mode-text-9: #666666
--velt-dark-mode-warning-foreground: #474747
--velt-dark-mode-warning-hover: #C69400
--velt-dark-mode-warning-light: #FFFBEE
--velt-dark-mode-warning-transparent: rgba(255, 205, 46, 0.08)
--velt-dark-mode-warning: #FFCD2E
--velt-dark-mode-white: #FFFFFF
```

### Surface & text aliases
> Semantic aliases components read in newer surfaces. Resolved from the active theme palette; no literal fallback in source.
```
--velt-surface-0   — base surface fill (used in color-mix for translucent surfaces)
--velt-text-primary   — primary text color
--velt-text-secondary-color   — secondary text color
--velt-bg-2   — elevated background fill (e.g. composer format toolbar)
--velt-bg-3   — higher-elevation background fill (e.g. toolbar buttons)
--velt-hover-background   — hover background fill
--velt-component-foreground-on-active / white   — foreground color when a component is in the active state
```

### Legacy flat aliases
> Older flat token names still referenced in a few surfaces. Each carries a literal fallback.
```
--velt-bg-color: #07054C
--velt-bg-color-active: #f44b64
--velt-font-color: #ffffff
--velt-font-color-active: #ffffff
--velt-border: 1px solid #ffffff30
--velt-border-radius: 0.5rem
--velt-icon-size: 1rem
--velt-padding: 6px
--velt-error-color / #dc3545
--velt-gray-100 / #f3f4f6
--velt-gray-500 / #6b7280
--velt-gray-700 / #374151
--velt-primary-500 / #6366f1
```

### Dropdown
> Resolved from the active theme palette.
```
--velt-dropdown-background: var(--velt-*-mode-background-0)
--velt-dropdown-border: var(--velt-*-mode-border-4)
--velt-dropdown-hover: var(--velt-*-mode-background-3)
--velt-dropdown-accent-transparent: var(--velt-*-mode-accent-transparent)
```

### Skeleton loader
> Set inline by the skeleton-loader component; override to size/shape loaders.
```
--velt-skeleton-loader-width   (default: 100%)
--velt-skeleton-loader-height   (default: 100%)
--velt-skeleton-loader-border-radius   (default: inherit)
```

### Comment pin
```
--velt-comment-pin-background-color / #2d62ff   — pin fill color
--velt-comment-pin-transform / none   — extra transform applied to the pin
--velt-line-clamp / 4   — max lines before comment text truncates
```

### Agent suggestion (comment AI suggestions)
```
--velt-agent-accent: #4495ff   — accent color for agent suggestion UI
--velt-agent-accent-transparent: rgba(68, 149, 255, 0.2)
--velt-agent-suggestion-max-height: 320px   — max height of the suggestion panel
```

### Z-index
```
--velt-arrow-z-index: 2147483557
--velt-comment-pin-z-index: 2147483557
--velt-comments-minimap-z-index: 2147483637
--velt-cursor-z-index: 2147483647
--velt-follow-mode-overlay-z-index: 2147483647
--velt-global-overlay-z-index: 2147483637
--velt-live-state-sync-overlay-z-index: 2147483647
--velt-persistent-comment-frame-z-index: 2147483647
--velt-recorder-player-z-index: 2147483557
--velt-toast-popup-z-index: 2147483647
```

---

## Legacy `--legacy-velt-*`

> Some legacy names appear twice — the second is the `[data-velt-theme="dark"]` override value.

```
--legacy-velt-avatar-size: 2rem
--legacy-velt-bg-color: var(--legacy-velt-bg-dark-color)
--legacy-velt-bg-color: var(--legacy-velt-neutral-8)
--legacy-velt-bg-dark-color: var(--legacy-velt-dark-1)
--legacy-velt-blue: #0d6efd
--legacy-velt-border-color: var(--legacy-velt-border-dark-color)
--legacy-velt-border-color: var(--legacy-velt-neutral-6)
--legacy-velt-border-dark-color: var(--legacy-velt-dark-3)
--legacy-velt-dark-1: #141416
--legacy-velt-dark-2: #222226
--legacy-velt-dark-3: #303034
--legacy-velt-dark-4: #404044
--legacy-velt-dark-5: #59595F
--legacy-velt-dark-6: #80808A
--legacy-velt-dark-7: #91919C
--legacy-velt-dark-8: #E5E5E9
--legacy-velt-dropdown-item-color: var(--legacy-velt-neutral-2)
--legacy-velt-dropdown-item-color: var(--legacy-velt-secondary-dark-color)
--legacy-velt-green: #0DCF82
--legacy-velt-grey-2-color: #D4D6DF
--legacy-velt-grey-2-color: var(--legacy-velt-grey-2-dark-color)
--legacy-velt-grey-2-dark-color: var(--legacy-velt-dark-4)
--legacy-velt-grey-4-color: #989898
--legacy-velt-grey-4-color: var(--legacy-velt-grey-4-dark-color)
--legacy-velt-grey-4-dark-color: var(--legacy-velt-dark-6)
--legacy-velt-grey-btn-color: var(--legacy-velt-neutral-5)
--legacy-velt-grey-btn-color: var(--legacy-velt-secondary-dark-color)
--legacy-velt-header-btn-color: var(--legacy-velt-neutral-3)
--legacy-velt-header-btn-color: var(--legacy-velt-secondary-dark-color)
--legacy-velt-hyperlink-color: var(--legacy-velt-purple)
--legacy-velt-hyperlink-color: var(--legacy-velt-secondary-dark-color)
--legacy-velt-neutral-0: #000000
--legacy-velt-neutral-1: #141416
--legacy-velt-neutral-2: #23262F
--legacy-velt-neutral-3: #353945
--legacy-velt-neutral-4: #777E90
--legacy-velt-neutral-5: #B1B5C3
--legacy-velt-neutral-6: #E6E8EC
--legacy-velt-neutral-7: #F4F5F6
--legacy-velt-neutral-8: #FCFCFD
--legacy-velt-neutral-9: #FFFFFF
--legacy-velt-orange: #ECB000
--legacy-velt-primary-btn-color: var(--legacy-velt-border-dark-color)
--legacy-velt-primary-btn-color: var(--legacy-velt-purple)
--legacy-velt-primary-color: var(--legacy-velt-dark-1)
--legacy-velt-primary-color: var(--legacy-velt-primary-dark-color)
--legacy-velt-primary-dark-color: var(--legacy-velt-dark-8)
--legacy-velt-purple: #625DF5
--legacy-velt-secondary-color: var(--legacy-velt-neutral-4)
--legacy-velt-secondary-color: var(--legacy-velt-secondary-dark-color)
--legacy-velt-secondary-dark-color: var(--legacy-velt-dark-7)
--legacy-velt-status-in-progress-color: #ECB000
--legacy-velt-status-open-color: #625DF5
--legacy-velt-status-resolved-color: #00C48C
--legacy-velt-tool-active-bg-color: var(--legacy-velt-purple)
--legacy-velt-tool-active-border-color: var(--legacy-velt-purple)
--legacy-velt-tool-active-border-radius: var(--legacy-velt-tool-border-radius)
--legacy-velt-tool-active-border: 2px solid var(--legacy-velt-tool-active-border-color)
--legacy-velt-tool-active-icon-color: var(--legacy-velt-neutral-9)
--legacy-velt-tool-active-icon-size: var(--legacy-velt-tool-icon-size)
--legacy-velt-tool-bg-color: transparent
--legacy-velt-tool-border-color: transparent
--legacy-velt-tool-border-radius: 50px
--legacy-velt-tool-border: 2px solid var(--legacy-velt-tool-border-color)
--legacy-velt-tool-focus-bg-color: var(--legacy-velt-tool-bg-color)
--legacy-velt-tool-focus-border-color: var(--legacy-velt-neutral-2)
--legacy-velt-tool-focus-border-color: var(--legacy-velt-neutral-7)
--legacy-velt-tool-focus-border-radius: var(--legacy-velt-tool-border-radius)
--legacy-velt-tool-focus-border: 2px solid var(--legacy-velt-tool-focus-border-color)
--legacy-velt-tool-focus-icon-color: var(--legacy-velt-tool-icon-color)
--legacy-velt-tool-focus-icon-size: var(--legacy-velt-tool-icon-size)
--legacy-velt-tool-hover-bg-color: var(--legacy-velt-neutral-1)
--legacy-velt-tool-hover-bg-color: var(--legacy-velt-neutral-7)
--legacy-velt-tool-hover-border-color: var(--legacy-velt-neutral-1)
--legacy-velt-tool-hover-border-color: var(--legacy-velt-neutral-7)
--legacy-velt-tool-hover-border-radius: var(--legacy-velt-tool-border-radius)
--legacy-velt-tool-hover-border: 2px solid var(--legacy-velt-tool-hover-border-color)
--legacy-velt-tool-hover-icon-color: var(--legacy-velt-neutral-3)
--legacy-velt-tool-hover-icon-color: var(--legacy-velt-neutral-5)
--legacy-velt-tool-hover-icon-size: var(--legacy-velt-tool-icon-size)
--legacy-velt-tool-icon-color: var(--legacy-velt-neutral-4)
--legacy-velt-tool-icon-size: 1.5rem
--legacy-velt-tool-padding: 6px
```
