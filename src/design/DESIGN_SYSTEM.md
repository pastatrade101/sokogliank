# Soko Gliank Design System

## Theme Source
- Central token source: `src/design/themeTokens.js`
- Global style application: `src/contexts/themeContext.js`
- Global component styling: `src/styles/designSystem.css`

## Color Roles
- `primary`, `secondary`, `success`, `warning`, `error`
- `page`, `surface`, `surfaceMuted`
- `text`, `textMuted`, `border`, `overlay`, `focus`

## Typography
- Family: `IBM Plex Sans`
- Scale: `xs(12)`, `sm(14)`, `md(16)`, `lg(18)`, `xl(24)`, `2xl(32)`, `3xl(40)`

## Spacing (8pt-aligned)
- `space-1(4)`, `space-2(8)`, `space-3(12)`, `space-4(16)`, `space-5(20)`, `space-6(24)`, `space-8(32)`, `space-10(40)`

## Shape + Elevation
- Radii: `sm(8)`, `md(12)`, `lg(16)`, `xl(20)`
- Shadows: `sm`, `md`, `lg`

## Motion
- Durations: `fast(120ms)`, `normal(180ms)`, `slow(280ms)`
- Easing: `cubic-bezier(0.2, 0.6, 0, 1)`
- Rules: small translateY + border/background transitions; no heavy animation loops.

## Icons
- Unified icon source: `src/components/icons/AppIcon.js`
- Use `name` prop with standard symbols across navigation, actions, and states.
