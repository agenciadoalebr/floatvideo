---
name: FloatVideo Design System
colors:
  surface: '#faf8ff'
  surface-dim: '#d0d8ff'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f2ff'
  surface-container: '#ebedff'
  surface-container-high: '#e3e7ff'
  surface-container-highest: '#dce1ff'
  on-surface: '#0e193c'
  on-surface-variant: '#414754'
  inverse-surface: '#242f52'
  inverse-on-surface: '#eff0ff'
  outline: '#717786'
  outline-variant: '#c1c6d7'
  surface-tint: '#005cbc'
  primary: '#005ab7'
  on-primary: '#ffffff'
  primary-container: '#0072e5'
  on-primary-container: '#fefcff'
  inverse-primary: '#abc7ff'
  secondary: '#2d00cf'
  on-secondary: '#ffffff'
  secondary-container: '#4323fe'
  on-secondary-container: '#ccc8ff'
  tertiary: '#006578'
  on-tertiary: '#ffffff'
  tertiary-container: '#008097'
  on-tertiary-container: '#f9fdff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d7e2ff'
  primary-fixed-dim: '#abc7ff'
  on-primary-fixed: '#001b3f'
  on-primary-fixed-variant: '#004590'
  secondary-fixed: '#e3dfff'
  secondary-fixed-dim: '#c4c0ff'
  on-secondary-fixed: '#120068'
  on-secondary-fixed-variant: '#3300e3'
  tertiary-fixed: '#afecff'
  tertiary-fixed-dim: '#10d9ff'
  on-tertiary-fixed: '#001f27'
  on-tertiary-fixed-variant: '#004e5d'
  background: '#faf8ff'
  on-background: '#0e193c'
  surface-variant: '#dce1ff'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 40px
    fontWeight: '600'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-xl:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Geist
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: -0.015em
  headline-lg:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.005em
  label-md:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Geist
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  space-xxs: 0.25rem
  space-xs: 0.5rem
  space-sm: 0.75rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
  gutter-mobile: 1rem
  gutter-desktop: 1.5rem
  sidebar-width: 16.25rem
---

## Brand & Style

This design system delivers a high-trust, frictionless SaaS experience tailored to Brazilian small-business owners and marketing agencies. It merges the modern clarity of developer-grade tools (Linear, Vercel) with an accessible, friendly interface engineered for non-technical users. 

### Brand Personality & Mood
- **Confident & Electric:** Driven by vivid electric blue to violet gradients and luminous cyan accents, symbolizing dynamic video interaction.
- **Ultra-Clean & Calm:** Ample whitespace, low-contrast panel borders, and distraction-free layouts keep cognitive load minimal for operators managing campaigns.
- **Approachable Sophistication:** Technical precision without esoteric complexity, using localized, conversational Brazilian Portuguese (pt-BR) terminology.

### Design Movement & Aesthetic
- **Refined Neo-Minimalism:** Subtle translucent backdrops, crisp hairline borders (`1px` with low opacity), and disciplined spacing.
- **Luminescent Highlights:** Functional pops of cyan highlight live statuses, conversion spikes, and video states against neutral slate canvases.

## Colors

The palette balances clinical clarity with electric brand accents. The canvas remains crisp and light, preserving readability and highlighting interactive video assets.

### Core Roles
- **Primary (`#007FFF` - Electric Blue):** Key interactions, selected states, and leading gradient endpoints.
- **Secondary (`#3F1AFB` - Deep Violet):** The trailing endpoint for the signature brand gradient, primary CTAs, and active navigation badges.
- **Tertiary (`#00D6FC` - Cyan):** Accent metrics, live video pulses, conversion alerts, and active toggle track indicators.
- **Neutral / Ink (`#00092D` - Deep Navy Ink):** Primary typography and high-contrast display elements. Avoids pure black (`#000000`) for a more organic, premium tone.

### Supporting Canvas Surfaces
- **Canvas Base:** `#F8FAFC` (Slate 50) for outer frame contrast.
- **Surface Elevation:** `#FFFFFF` (Solid White) for cards, sheets, and popovers.
- **Subtle Hairlines:** `#E2E8F0` / `rgba(226, 232, 240, 0.8)` for structural separation.
- **Muted Ink:** `#64748B` (Slate 500) for helper text, table column headers, and secondary labels.

## Typography

The typography uses Geist across all functional categories to maintain technical poise, high character legibility, and geometric clarity.

### Usage Principles
- **Headlines:** Clean optical kerning with tight negative letter-spacing (`-0.01em` to `-0.02em`) creates authority without bulk.
- **Numbers & Data:** Tabular figures are enabled by default for video play counts, conversion metrics, and retention graphs.
- **Localization Handling:** Brazilian Portuguese features longer noun phrases than English. Text hierarchy permits natural wrapping with comfortable line heights (`1.4` to `1.5`) to prevent clipping in navigation and cards.

## Layout & Spacing

The layout is built upon an 8pt spatial rhythm nested within a fixed-fluid hybrid structure:
- **Navigation:** Persistent left rail fixed at `16.25rem` (260px) on desktop, collapsing to an icon rail or full overlay sheet on tablet/mobile screens.
- **Application Canvas:** Max-width constrained to `88rem` (1408px) to prevent dashboard cards and metric tables from overstretching on ultrawide monitors.
- **Grid Architecture:** 12-column dynamic grid on desktop with `1.5rem` (24px) gutters; single-column stacked layout on mobile with `1rem` (16px) margins.
- **Form Factor Breakpoints:** Mobile (`< 768px`), Tablet (`768px - 1024px`), Desktop (`> 1024px`).

## Elevation & Depth

Visual hierarchy uses flat depth tiers, hairline borders, and targeted ambient backdrops rather than conventional heavy drop shadows.

- **Hairline Framing:** Surface tiers use a unified `1px` border in `rgba(226, 232, 240, 0.8)` or `#EEF2F6`.
- **Resting Depth:** Cards sit flush on `#FFFFFF` with an ambient glow: `0 1px 2px rgba(0, 9, 45, 0.04)`.
- **Floating Overlays & Popovers:** Dropdowns and modals lift slightly using a dual shadow model: `0 4px 12px -2px rgba(0, 9, 45, 0.06), 0 12px 24px -4px rgba(0, 9, 45, 0.04)`.
- **Interactive Video Bubble Preview:** Floating bubbles within the dashboard staging canvas feature an electric perimeter glow: `0 8px 24px -4px rgba(0, 127, 255, 0.25)`.

## Shapes

The interface balances ergonomic softness with geometric rigor.

- **Interactive Core:** Standard inputs, primary buttons, and selector chips utilize `0.5rem` (8px).
- **Cards & Dashboard Panels:** Containers employ `rounded-xl` (`1rem` / 16px) and `rounded-2xl` (`1.5rem` / 24px) for prominent analytics blocks and onboarding flows.
- **Floating Bubble Simulators:** Bubble previews and live triggers use complete circular geometry (`rounded-full` / 9999px) to mirror the live widget behavior on client websites.

## Components

### Buttons
- **Primary Action:** Solid gradient fill from `#007FFF` to `#3F1AFB` with pure white text, semi-bold weight, and a subtle inner top highlight (`box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2)`).
- **Secondary / Neutral:** Crisp `#FFFFFF` surface, `1px` border in `#E2E8F0`, ink text `#00092D`, transitioning to background `#F8FAFC` on hover.
- **Ghost:** Transparent background, slate hover fill (`rgba(241, 245, 249, 0.6)`), used for secondary card actions.

### Cards & Metrics
- Enclosed with `rounded-xl` or `rounded-2xl` surfaces in `#FFFFFF`.
- Hairline borders in `#E2E8F0`. 
- Metric headers display small uppercase labels (`label-sm`) with slate coloring, paired with bold numeric values in tabular Geist.

### Input Fields & Controls
- **Inputs:** `0.5rem` border-radius, `#FFFFFF` background, `1px` border in `#E2E8F0`. Focus state creates a `2px` focus ring in `rgba(0, 127, 255, 0.2)` with a `#007FFF` border.
- **Checkboxes & Radios:** Curved squircle checkboxes (`0.25rem` radius) and circular radios that display full gradient fill `#007FFF` to `#3F1AFB` when checked.
- **Toggle Switches:** Crisp pill track with `#00D6FC` fill when active, paired with a bright white thumb that lifts on drag.

### Chips & Status Badges
- **Active / Published:** Pale cyan tint background (`rgba(0, 214, 252, 0.1)`) with dark cyan text (`#008CA6`) and a pulsing live indicator dot.
- **Draft / Inactive:** Light slate fill (`#F1F5F9`) with `#475569` text.

### Video Bubble Previewer (Domain Component)
- An in-dashboard interactive canvas that lets non-technical users preview floating video widgets on desktop and mobile site viewports.
- Features intuitive slider handles, border-radius customizers, click-to-action (CTA) button link generators, and real-time responsiveness toggles.