# Reference · CSS variables (complete)

**Every** CSS custom property Velt exposes — the complete set, extracted verbatim from the SDK. Override in your own stylesheet (see [`../approaches/css.md`](../approaches/css.md)). Variables cross the shadow DOM; class CSS needs `shadowDom={false}` or `injectCustomCss` (R6).

- **Modern `--velt-*`** — use these.
- **Legacy `--legacy-velt-*`** — older surfaces only.

> Generated from source and exhaustive. If a `--velt-*` name isn't here, it doesn't exist.

---

## Modern `--velt-*`

### Spacing
```
--velt-spacing-2xl: #{rem(1.5)}
--velt-spacing-2xs: #{rem(0.125)}
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
