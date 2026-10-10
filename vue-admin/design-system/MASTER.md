# HQX Admin System - Clean White Theme Design System

## Overview

A minimal, professional white theme designed for enterprise admin interfaces. Emphasizes clarity, spaciousness, and accessibility with a refined color palette and clean typography.

## Design Philosophy

- **Minimalism First**: Remove visual noise, emphasize content
- **Professional**: Subtle, refined aesthetics suitable for business applications
- **Accessibility**: WCAG AA compliant contrast ratios (4.5:1 minimum)
- **Consistency**: Unified spacing, typography, and interaction patterns

---

## Color System

### Base Colors

```css
/* Backgrounds */
--background: 0 0% 100%;           /* Pure white - main background */
--background-deep: 0 0% 98%;       /* Very light gray - content area */
--foreground: 0 0% 15%;            /* Dark gray - primary text */

/* Cards & Surfaces */
--card: 0 0% 100%;                 /* Pure white - card background */
--card-foreground: 0 0% 15%;       /* Dark gray - card text */

/* Popover & Dialogs */
--popover: 0 0% 100%;              /* Pure white */
--popover-foreground: 0 0% 15%;    /* Dark gray */
```

### Semantic Colors

```css
/* Primary - Refined Blue */
--primary: 221 83% 53%;            /* hsl(221, 83%, 53%) - #3B82F6 */
--primary-foreground: 0 0% 100%;   /* White text on primary */

/* Success - Professional Green */
--success: 142 76% 36%;            /* hsl(142, 76%, 36%) - #10B981 */
--success-foreground: 0 0% 100%;   /* White text on success */

/* Warning - Vibrant Orange */
--warning: 38 92% 50%;             /* hsl(38, 92%, 50%) - #F59E0B */
--warning-foreground: 0 0% 100%;   /* White text on warning */

/* Destructive - Clear Red */
--destructive: 0 84% 60%;          /* hsl(0, 84%, 60%) - #EF4444 */
--destructive-foreground: 0 0% 100%; /* White text on destructive */
```

### UI Element Colors

```css
/* Secondary Elements */
--secondary: 0 0% 96%;             /* Light gray backgrounds */
--secondary-foreground: 0 0% 15%;  /* Dark text */

/* Muted Elements */
--muted: 0 0% 97%;                 /* Very light gray - disabled states */
--muted-foreground: 0 0% 45%;      /* Medium gray - secondary text */

/* Accents & Hover States */
--accent: 0 0% 96%;                /* Light gray - hover background */
--accent-hover: 0 0% 94%;          /* Slightly darker on hover */
--accent-foreground: 0 0% 15%;     /* Dark text on accent */

/* Borders & Inputs */
--border: 0 0% 90%;                /* Subtle gray borders */
--input: 0 0% 88%;                 /* Input border color */
--input-placeholder: 0 0% 55%;     /* Placeholder text color */
--input-background: 0 0% 100%;     /* White input background */

/* Focus Ring */
--ring: 221 83% 53%;               /* Primary blue focus ring */
```

### Layout-Specific Colors

```css
/* Sidebar */
--sidebar: 0 0% 100%;              /* Pure white sidebar */
--sidebar-deep: 0 0% 100%;         /* Pure white sidebar background */

/* Header */
--header: 0 0% 100%;               /* Pure white header */

/* Overlay */
--overlay: 0 0% 0% / 40%;          /* Semi-transparent black overlay */
```

---

## Typography

### Font Family

```css
--font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 
               'Helvetica Neue', Arial, 'Noto Sans', sans-serif;
```

**Rationale**: System font stack ensures optimal rendering on all platforms while maintaining a clean, professional appearance.

### Font Sizes

```css
--font-size-base: 16px;                           /* Base size */
--menu-font-size: calc(var(--font-size-base) * 0.875); /* 14px for menus */
```

### Typography Scale

- **Headings**: Use consistent scale (e.g., 32px, 24px, 20px, 18px)
- **Body**: 16px (base)
- **Small**: 14px (labels, captions)
- **Tiny**: 12px (metadata, timestamps)

### Line Height

- **Headings**: 1.2 - 1.3
- **Body text**: 1.5 - 1.75
- **UI elements**: 1.5

### Font Weight

- **Light**: 300 (large headings)
- **Regular**: 400 (body text)
- **Medium**: 500 (labels, emphasized text)
- **Semibold**: 600 (section headings)
- **Bold**: 700 (primary headings)

---

## Spacing System

Use a consistent 4px/8px increment spacing scale:

```
4px  (0.25rem)  - Micro spacing
8px  (0.5rem)   - Tight spacing
12px (0.75rem)  - Compact spacing
16px (1rem)     - Base spacing
24px (1.5rem)   - Medium spacing
32px (2rem)     - Large spacing
48px (3rem)     - XL spacing
64px (4rem)     - XXL spacing
```

### Application

- **Component padding**: 12px - 16px
- **Section spacing**: 24px - 32px
- **Page margins**: 32px - 48px
- **Touch targets**: Minimum 44×44px (Apple HIG)

---

## Border Radius

```css
--radius: 0.5rem;              /* 8px - base radius */
--radius-sm: calc(var(--radius) - 4px);  /* 4px */
--radius-md: calc(var(--radius) - 2px);  /* 6px */
--radius-lg: var(--radius);              /* 8px */
--radius-xl: calc(var(--radius) + 4px);  /* 12px */
```

**Application**:
- Cards, modals: 8px (base)
- Buttons: 6px (medium)
- Input fields: 6px (medium)
- Tags, badges: 4px (small)
- Large containers: 12px (extra large)

---

## Shadows & Elevation

### Shadow System

```css
--shadow-float: 0 6px 16px 0 rgb(0 0 0 / 8%), 
                0 3px 6px -4px rgb(0 0 0 / 12%),
                0 9px 28px 8px rgb(0 0 0 / 5%);
```

### Elevation Levels

- **Level 0**: No shadow (flush surfaces)
- **Level 1**: `0 1px 2px 0 rgb(0 0 0 / 0.05)` (subtle cards)
- **Level 2**: `0 4px 6px -1px rgb(0 0 0 / 0.1)` (hover states)
- **Level 3**: `--shadow-float` (modals, popovers)
- **Level 4**: `0 20px 25px -5px rgb(0 0 0 / 0.1)` (drawers)

---

## Component Guidelines

### Buttons

**Primary Button**
```css
background: var(--primary);
color: var(--primary-foreground);
padding: 10px 16px;
border-radius: var(--radius-md);
font-weight: 500;
```

**States**:
- Hover: Darken by 10%
- Active: Darken by 15%
- Disabled: `opacity: 0.5`, `cursor: not-allowed`
- Focus: 2px ring with `--ring` color

**Secondary Button**
```css
background: var(--secondary);
color: var(--secondary-foreground);
border: 1px solid var(--border);
```

### Input Fields

```css
background: var(--input-background);
border: 1px solid var(--input);
border-radius: var(--radius-md);
padding: 8px 12px;
font-size: 14px;
```

**States**:
- Focus: Border color changes to `--ring`, add 2px ring
- Error: Border color `--destructive`, red ring
- Disabled: Background `--muted`, text `--muted-foreground`

### Cards

```css
background: var(--card);
color: var(--card-foreground);
border: 1px solid var(--border);
border-radius: var(--radius-lg);
padding: 20px;
```

### Data Tables

- **Header**: Background `--muted`, font-weight 600
- **Row hover**: Background `--accent`
- **Borders**: 1px solid `--border`
- **Padding**: 12px (cells)

---

## Animation & Transitions

### Duration Standards

- **Micro**: 150ms (hover states, ripples)
- **Short**: 200-300ms (component transitions)
- **Medium**: 300-400ms (page transitions)
- **Long**: 400-600ms (complex animations)

### Easing

- **Ease-out**: Entering elements (default)
- **Ease-in**: Exiting elements
- **Ease-in-out**: State changes
- **Spring**: Natural, physics-based motion

### Reduced Motion

Always respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Accessibility Standards

### Contrast Ratios

- **Normal text**: Minimum 4.5:1 (WCAG AA)
- **Large text** (18px+): Minimum 3:1
- **UI components**: Minimum 3:1

### Focus Indicators

- Always visible: 2-4px ring
- Color: `--ring` (primary blue)
- Never remove focus styles

### Touch Targets

- Minimum size: 44×44px (Apple HIG)
- Minimum spacing: 8px between targets

### Keyboard Navigation

- Tab order matches visual order
- All interactive elements reachable
- Escape closes modals/dialogs

---

## Responsive Breakpoints

```css
/* Mobile First */
@media (min-width: 375px)  { /* Small mobile */ }
@media (min-width: 768px)  { /* Tablet */ }
@media (min-width: 1024px) { /* Desktop */ }
@media (min-width: 1440px) { /* Large desktop */ }
```

### Layout Adaptations

- **< 768px**: Single column, bottom navigation
- **768px - 1024px**: Sidebar collapsible, 2-column grids
- **> 1024px**: Full sidebar, 3-4 column grids

---

## Anti-Patterns (Avoid)

❌ **Don't**:
- Use emojis as icons (use SVG icons instead)
- Mix flat and skeuomorphic styles
- Create overly ornate designs
- Use color alone to convey information
- Disable zoom on mobile
- Use text smaller than 12px for body content
- Create horizontal scroll on mobile
- Use decorative-only animations
- Remove focus indicators
- Use low-contrast gray-on-gray combinations

---

## Implementation Checklist

Before delivery, verify:

- [ ] No emojis as icons (use SVG: Heroicons/Lucide)
- [ ] `cursor: pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Text contrast 4.5:1 minimum in light mode
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive at 375px, 768px, 1024px, 1440px
- [ ] Touch targets minimum 44×44px
- [ ] Form labels visible (not placeholder-only)
- [ ] Error messages near relevant fields
- [ ] Loading states for async operations

---

## Integration

This design system is implemented via CSS custom properties in:

- **Base tokens**: `/packages/@core/base/design/src/design-tokens/default.css`
- **Tailwind theme**: `/internal/tailwind-config/src/theme.css`
- **Preferences**: `/packages/@core/preferences/src/config.ts`

### Usage in Components

```css
/* Use semantic tokens */
.button-primary {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.card {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
}
```

---

## References

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Material Design 3](https://m3.material.io/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

---

**Last Updated**: 2026-09-30  
**Version**: 1.0.0  
**Status**: Active
