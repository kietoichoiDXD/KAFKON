---
name: ScribeBA Studio
description: Mission-critical verification workspace for attributed requirements and safe operations
colors:
  primary: "#0f766e"
  primary-hover: "#115e59"
  canvas: "#f8fafc"
  surface: "#ffffff"
  surface-raised: "#f1f5f9"
  surface-navigation: "#ffffff"
  border: "#e2e8f0"
  divider: "#e8edf2"
  text-primary: "#172b4d"
  text-secondary: "#475569"
  text-muted: "#64748b"
  focus: "#0f766e"
  evidence-verified: "#15803d"
  evidence-inferred: "#a16207"
  evidence-assumed: "#7e22ce"
  evidence-blocked: "#be123c"
typography:
  display:
    fontFamily: "Public Sans, Plus Jakarta Sans, Inter, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Public Sans, Plus Jakarta Sans, Inter, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Public Sans, Plus Jakarta Sans, Inter, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Public Sans, Plus Jakarta Sans, Inter, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  label:
    fontFamily: "Public Sans, Plus Jakarta Sans, Inter, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0em"
  mono:
    fontFamily: "JetBrains Mono, IBM Plex Mono, monospace"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0em"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary-hover}"
    textColor: "#f4fffd"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.canvas}"
  input-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
  card-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "20px"
---

# Design System: ScribeBA Studio

## Overview

**Creative North Star: “The Verification Workbench”**

ScribeBA is a focused engineering workbench for following a requirement from its source through a human decision to a readiness state. Deep slate surfaces keep dense operational information contained, while full ink text, fine separators, and compact labels make the workspace quick to scan. Public Sans carries the interface; JetBrains Mono marks values that need exact reading, such as timestamps, identifiers, metrics, and hashes.

Teal is reserved for selection and primary actions. Verified, inferred, assumed, and blocked each retain distinct state colors because they describe different evidence conditions and risks. The interface should make provenance and unresolved decisions visible without turning every surface into an alert. The current workspace uses a compact icon rail on wide screens and a bottom navigation bar on narrow screens.

**Key Characteristics:**
- Dark slate, border-defined work surfaces with restrained tonal layering.
- Teal selection and action accents, with state color reserved for verification and risk.
- Dense, readable data presentation with tabular numerals and mono identifiers.

## Colors

The palette pairs deep, low-chroma slate surfaces and pale text with a single teal interaction accent; status hues remain semantically distinct.

### Primary
- **Workbench Teal** (`{colors.primary}`): Selection indicators, active navigation icons, focus borders, and key interactive affordances. Use sparingly; selections use a 1px teal line.
- **Deep Teal** (`{colors.primary-hover}`): Filled primary actions and stronger teal emphasis against the dark canvas.

### Neutral
- **Night Canvas** (`{colors.canvas}`): The application background and open workspace regions.
- **Slate Surface** (`{colors.surface}`): Panels, content cards, and contained work areas.
- **Raised Slate** (`{colors.surface-raised}`): Hovered or raised controls and adjacent surface separation.
- **Navigation Slate** (`{colors.surface-navigation}`): Sidebar and navigation surface.
- **Structural Border** (`{colors.border}`) and **Quiet Divider** (`{colors.divider}`): Panel outlines and internal separators; use hairlines to define dense information groups.
- **Pale Ink** (`{colors.text-primary}`), **Soft Ink** (`{colors.text-secondary}`), and **Muted Ink** (`{colors.text-muted}`): Primary copy, supporting copy, and secondary metadata respectively.
- **Focus Mint** (`{colors.focus}`): High-contrast keyboard focus outline.

### Secondary
- **Verified Green** (`{colors.evidence-verified}`): Verified evidence and healthy operational states.
- **Inference Amber** (`{colors.evidence-inferred}`): Inferences and items needing review.
- **Assumption Violet** (`{colors.evidence-assumed}`): Explicitly unconfirmed premises.
- **Blocker Coral** (`{colors.evidence-blocked}`): Missing answers, blockers, and active operational risk.

### Named Rules
**The Teal Selection Rule.** Teal signals selection, focus, or a primary action; selected rows use a 1px teal edge.

**The State Has Meaning Rule.** Keep green, amber, violet, and coral tied to their verification meanings. Never use them as interchangeable decoration.

## Typography

**Display Font:** Public Sans (with Plus Jakarta Sans, Inter, sans-serif fallbacks)
**Body Font:** Public Sans (with Plus Jakarta Sans, Inter, sans-serif fallbacks)
**Label/Mono Font:** JetBrains Mono (with IBM Plex Mono, monospace fallbacks)

**Character:** Public Sans is compact and neutral for sustained operational reading. JetBrains Mono gives measurements, timestamps, and identifiers a precise, inspectable character. Numeric figures use tabular alignment.

### Hierarchy
- **Display** (600, 24px, 1.25): View titles and prominent workspace headings.
- **Headline** (600, 20px, 1.35): Secondary section headings and key decision titles.
- **Title** (600, 16px, 1.4): Panel and card headings.
- **Body** (400, 14px, 1.5): Main explanatory and evidence text; allow long-form claims to wrap comfortably.
- **Label** (500, 12px, 1.4): Controls, captions, table metadata, and short status labels.
- **Mono** (500, 13px, 1.4): Identifiers, timestamps, telemetry, code, and integrity values.

### Named Rules
**The Exact Value Rule.** Use JetBrains Mono and tabular figures where a value must be compared, copied, or audited; keep prose in Public Sans.

## Layout

The desktop workspace uses a compact 64px navigation rail beside a flexible content viewport. Main work areas favor aligned grids and master-detail layouts: evidence, decision, and readiness remain distinct while the selected source stays inspectable. Content commonly uses 24–32px outer padding, 16–24px panel spacing, and 8–16px control spacing. Dense data can use 12px labels and 14px body copy; preserve clear row and column alignment.

At widths up to 760px, navigation becomes a fixed 64px bottom bar with icon and short label. Main content occupies the remaining viewport and scrolls vertically. Review columns stack for narrow screens. Preserve useful touch targets and prevent horizontally clipped essential values.

## Elevation & Depth

The system is border-led and tonally layered. Canvas, panel, raised, and navigation surfaces establish depth; 1px structural borders and quiet dividers organize content. Shadows are reserved for overlays such as dialogs and menus, not used as the default card treatment. Interactive panels shift surface and border tone on hover. Reduced-motion preferences shorten transitions and disable scrolling animation.

**The Surface-First Rule.** Use tonal contrast and hairline borders for persistent hierarchy; reserve shadow for transient overlays.

## Shapes

The form language is compact and restrained: controls and panels use gently rounded corners (6–8px), larger containers may use 12px, and small badges use tight 4–6px corners. Borders stay fine and functional. Selection is a thin edge or underline, not a pill-shaped halo. The mobile navigation uses square-edged slots to preserve a compact rail-like rhythm.

## Components

### Buttons
Buttons are compact and direct, with clear state feedback.
- **Shape:** Gently rounded corners (6–8px).
- **Primary:** Deep teal fill, pale text, and compact 8–12px vertical / 12–20px horizontal padding.
- **Hover / Focus:** Shift the surface tone on hover; keyboard focus uses a visible 2px mint outline with offset.
- **Secondary / Ghost:** Slate or transparent surfaces with a thin border or quiet hover fill; retain legible text.

### Chips
Status chips pair their state color with a short label and, where needed, a border. Use green for Verified, amber for Inferred, violet for Assumed, and coral for Blocked. Mono text is appropriate for compact uppercase operational tags.

### Cards / Containers
- **Corner Style:** Small, consistent rounds (8px typical; 12px for larger grouped surfaces).
- **Background:** Slate panel on the night canvas; use a raised slate only to show hover or hierarchy.
- **Shadow Strategy:** Flat at rest, as described in Elevation & Depth.
- **Border:** 1px structural slate border; internal divisions use quieter rules.
- **Internal Padding:** 16–24px for major panels; 8–12px for compact controls and rows.

### Inputs / Fields
- **Style:** Dark field on a contained surface with a fine slate border and 8px corners; use 12px horizontal and 8px vertical padding where space allows.
- **Focus:** Teal border and a restrained teal ring, plus the global high-contrast visible outline for keyboard focus.
- **Error / Disabled:** Keep error state explicit with blocker coral; disabled controls remain visibly inactive and retain a not-allowed cursor.

### Navigation
The wide-screen sidebar is a compact icon rail; the current item is identified with a teal icon and pale text. On mobile it becomes a fixed bottom bar, with a 1px teal top edge on the current destination. Keep labels short and state visible without relying on color alone.

### Evidence Audit Row
A claim row keeps its evidence state, timestamp, claim, and source attribution together. The selected row receives a quiet slate highlight and a 1px teal edge. The adjacent decision and readiness areas retain the source quote and explain why publishing is paused or allowed.

### Operational Values
Telemetry and resource identifiers use JetBrains Mono with tabular figures and explicit signs where values can be positive or negative. State colors communicate health or risk, while proposals and infrastructure actions remain visually distinct from committed state.

## Do's and Don'ts

### Do:
- **Do** preserve source attribution and exact evidence status wherever a requirement is summarized.
- **Do** make blocked and unresolved states explicit; they must not look ready for external sync.
- **Do** keep teal as the selection and primary-action accent, using a 1px line for selected rows.
- **Do** provide keyboard navigation and a visible high-contrast focus indicator; honor reduced-motion preferences.
- **Do** use tabular numerals for metrics and JetBrains Mono for identifiers, timestamps, and hashes.

### Don't:
- **Don't** treat verified, inferred, assumed, and blocked as interchangeable states.
- **Don't** use teal as a broad decorative fill or introduce a second selection color.
- **Don't** use gradients, fuzzy decorative glows, or floating particle effects as interface decoration.
- **Don't** permit publishing or syncing while a requirement remains Blocked without explicit human sign-off.
- **Don't** sacrifice legibility of evidence, provenance, or operational risk for visual density.
