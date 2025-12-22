# Project Conventions & Design System

This document outlines the coding patterns, design system conventions, and best practices used in this project.

---

## Table of Contents

1. [Technology Stack](#technology-stack)
2. [Design System](#design-system)
3. [Color Tokens](#color-tokens)
4. [Typography](#typography)
5. [Spacing & Density](#spacing--density)
6. [Component Patterns](#component-patterns)
7. [Animation Guidelines](#animation-guidelines)
8. [Admin UI Patterns](#admin-ui-patterns)
9. [Form Design](#form-design)
10. [Accessibility](#accessibility)
11. [File Organization](#file-organization)
12. [Code Style](#code-style)

---

## Technology Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with CSS variables
- **UI Components**: shadcn/ui (Radix primitives)
- **Backend**: Supabase (Lovable Cloud)
- **State Management**: React Query (@tanstack/react-query)
- **Routing**: React Router DOM
- **Icons**: Lucide React

---

## Design System

### Core Principles

1. **Use semantic tokens** - Never use direct colors like `text-white`, `bg-black`. Always use design system tokens.
2. **HSL color format** - All colors must be defined in HSL format.
3. **Theme-aware** - All components must work in both light and dark modes.
4. **Responsive first** - Design for mobile, enhance for desktop.

### Color Token Usage

```tsx
// ✅ CORRECT - Use semantic tokens
<div className="bg-background text-foreground" />
<button className="bg-primary text-primary-foreground" />
<p className="text-muted-foreground" />

// ❌ WRONG - Direct colors
<div className="bg-white text-black" />
<button className="bg-blue-500 text-white" />
```

---

## Color Tokens

### Base Colors

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `--background` | Soft blush cream | Dark slate | Page backgrounds |
| `--foreground` | Deep indigo | Light cream | Primary text |
| `--card` | White | Dark card | Card surfaces |
| `--muted` | Muted cream | Dark muted | Subtle backgrounds |
| `--muted-foreground` | Muted text | Light muted | Secondary text |

### Brand Colors

| Token | Usage |
|-------|-------|
| `--primary` | Primary actions, links, focus rings |
| `--primary-foreground` | Text on primary backgrounds |
| `--secondary` | Secondary actions, subtle highlights |
| `--accent` | Accent elements, hover states |
| `--destructive` | Error states, delete actions |

### Sparkly Brand Colors

| Token | Usage |
|-------|-------|
| `--sparkly-blush` | Soft pink accents |
| `--sparkly-cream` | Warm cream backgrounds |
| `--sparkly-indigo` | Brand primary (indigo blue) |
| `--sparkly-indigo-light` | Lighter indigo variant |

### Quiz-Specific Colors

| Token | Usage |
|-------|-------|
| `--quiz-primary` | Quiz primary actions |
| `--quiz-primary-light` | Lighter quiz accent |
| `--quiz-glow` | Glow effects on quiz elements |

---

## Typography

### Font Families

```css
--font-heading: 'Playfair Display', serif;  /* Headings */
--font-body: 'DM Sans', sans-serif;         /* Body text */
```

### Usage

```tsx
// Headings automatically use Playfair Display
<h1>This uses heading font</h1>

// Body text uses DM Sans
<p>This uses body font</p>

// Explicit usage via Tailwind
<span className="font-heading">Heading style</span>
<span className="font-body">Body style</span>
```

---

## Spacing & Density

### UI Density Modes

The project supports three density modes:

| Mode | Base Font | Padding | Gap |
|------|-----------|---------|-----|
| `compact` | 14px | 0.75rem | 0.5rem |
| `default` | 16px | 1rem | 0.75rem |
| `comfortable` | 18px | 1.25rem | 1rem |

### Density-Aware Classes

```tsx
// Use density variables for consistent spacing
<div className="density-padding" />      // Adapts to density mode
<div className="density-padding-sm" />   // Smaller padding
<div className="density-padding-lg" />   // Larger padding
<div className="density-gap" />          // Gap between items
```

### Border Radius

```css
--radius: 0.75rem;  /* Base radius */
```

| Class | Size |
|-------|------|
| `rounded-sm` | `calc(var(--radius) - 4px)` |
| `rounded-md` | `calc(var(--radius) - 2px)` |
| `rounded-lg` | `var(--radius)` |

---

## Component Patterns

### Button Variants

```tsx
// Available variants
<Button variant="default" />      // Primary action
<Button variant="secondary" />    // Secondary action
<Button variant="outline" />      // Outlined style
<Button variant="ghost" />        // Minimal style
<Button variant="destructive" />  // Dangerous action
<Button variant="link" />         // Link style

// Sizes
<Button size="sm" />      // Small
<Button size="default" /> // Default
<Button size="lg" />      // Large
<Button size="icon" />    // Icon only
```

### Card Pattern

```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>Content</CardContent>
  <CardFooter>Footer</CardFooter>
</Card>
```

### Status Badges

```tsx
// Status badge classes
<Badge className="admin-status-active">Active</Badge>
<Badge className="admin-status-inactive">Inactive</Badge>
<Badge className="admin-status-pending">Pending</Badge>
<Badge className="admin-status-error">Error</Badge>
```

---

## Animation Guidelines

### Available Animations

| Animation | Duration | Usage |
|-----------|----------|-------|
| `animate-fade-in` | 0.5s | General fade entrances |
| `animate-fade-in-up` | 0.4s | Content reveal |
| `animate-scale-in` | 0.3s | Modal/popup entrances |
| `animate-slide-in-left` | 0.35s | Slide from right |
| `animate-slide-in-right` | 0.35s | Slide from left |
| `animate-slide-up` | 0.3s | Bottom-up reveal |
| `animate-pulse-glow` | 2s infinite | Attention-grabbing glow |
| `animate-bounce-subtle` | 0.6s | Subtle bounce effect |

### Usage Examples

```tsx
// Entrance animation
<div className="animate-fade-in">Fading in content</div>

// Staggered animations with delay
<div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>First</div>
<div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>Second</div>

// Interactive glow
<button className="animate-pulse-glow">Glowing button</button>
```

### Custom Keyframes

```tsx
// In tailwind.config.ts, keyframes are defined for:
// accordion-down, accordion-up, fade-in, fade-in-up,
// scale-in, pulse-glow, slide-in-left, slide-in-right,
// slide-up, bounce-subtle
```

---

## Admin UI Patterns

### Page Layout

```tsx
<div className="admin-page">
  <div className="admin-page-header">
    <div>
      <h1 className="admin-page-title">Page Title</h1>
      <p className="admin-page-description">Description text</p>
    </div>
    <div className="admin-actions">
      <Button>Action</Button>
    </div>
  </div>
  {/* Content */}
</div>
```

### Card Layout

```tsx
<div className="admin-card">
  <div className="admin-card-header">
    <h2 className="admin-card-title">Card Title</h2>
  </div>
  <div className="admin-card-content">
    {/* Content */}
  </div>
</div>
```

### Table Pattern

```tsx
<table className="admin-table">
  <thead className="admin-table-header">
    <tr>
      <th className="admin-table-th">Column</th>
    </tr>
  </thead>
  <tbody>
    <tr className="admin-table-row">
      <td className="admin-table-td">Data</td>
    </tr>
  </tbody>
</table>
```

### List Design (Zebra Striping)

```tsx
// Use zebra striping for better scannability
{items.map((item, index) => (
  <div 
    key={item.id}
    className={index % 2 === 0 ? "bg-white dark:bg-card" : "bg-secondary/20"}
  >
    {item.content}
  </div>
))}

// Or use utility classes
<div className="list-row">Auto-zebra with :nth-child</div>
<div className="list-row-alt">Manual alternate style</div>
```

### Empty State

```tsx
<div className="admin-empty-state">
  <Icon className="admin-empty-icon" />
  <h3 className="admin-empty-title">No items found</h3>
  <p className="admin-empty-description">Create your first item</p>
</div>
```

### Stats Card

```tsx
<div className="admin-stat-card">
  <div className="admin-stat-icon bg-primary/10">
    <Icon className="text-primary" />
  </div>
  <div className="admin-stat-value">42</div>
  <div className="admin-stat-label">Total Items</div>
</div>
```

---

## Form Design

### Input Standards

- Minimum height: 2.5rem (40px)
- Consistent padding and border radius
- Clear focus states with ring

### Checkbox & Radio

```css
/* Checkboxes are always square */
[type="checkbox"] { border-radius: 0 !important; }

/* Radio buttons are always circular */
[type="radio"] { border-radius: 9999px !important; }
```

### Form Labels

- Font weight: 500 (medium)
- Clear association with inputs

### Disabled States

- Opacity: 0.5
- Cursor: not-allowed

---

## Accessibility

### Focus Indicators

```tsx
// Default focus ring
className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

// Utility class
className="focus-ring"

// Interactive with scale
className="interactive-focus"
```

### Skip Links

```tsx
<a href="#main" className="sr-only focus:not-sr-only">
  Skip to main content
</a>
```

### Color Contrast

- Ensure sufficient contrast in both light and dark modes
- Avoid white text on white backgrounds
- Avoid dark text on dark backgrounds

---

## File Organization

### Directory Structure

```
src/
├── components/
│   ├── admin/          # Admin-specific components
│   ├── quiz/           # Quiz-related components
│   └── ui/             # shadcn/ui components
├── hooks/              # Custom React hooks
├── pages/              # Route page components
├── integrations/
│   └── supabase/       # Supabase client & types
├── lib/                # Utility functions
└── assets/             # Static assets
```

### Component Naming

- PascalCase for component files: `QuizManager.tsx`
- camelCase for hooks: `useQuizData.ts`
- kebab-case for utility files: `utils.ts`

### Index Exports

Use index.ts files for clean imports:

```tsx
// src/components/admin/index.ts
export * from './QuizManager';
export * from './AdminCard';
```

---

## Code Style

### TypeScript

- Use explicit types for function parameters
- Prefer interfaces over types for objects
- Use `type` for unions and primitives

```tsx
interface QuizProps {
  id: string;
  title: string;
  isActive: boolean;
}

type Status = 'active' | 'inactive' | 'pending';
```

### React Patterns

```tsx
// Prefer function declarations for components
function MyComponent({ prop }: MyComponentProps) {
  return <div>{prop}</div>;
}

// Use forwardRef for ref forwarding
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, ...props }, ref) => {
    return <button ref={ref} className={className} {...props} />;
  }
);
```

### Imports Order

1. React and external libraries
2. Internal components
3. Hooks
4. Utilities and types
5. Styles

```tsx
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { QuizCard } from "@/components/quiz/QuizCard";

import { useQuizData } from "@/hooks/useQuizData";

import { cn } from "@/lib/utils";
import type { Quiz } from "@/types";
```

### Supabase Patterns

```tsx
// Always import from the integration
import { supabase } from "@/integrations/supabase/client";

// Use typed queries
const { data, error } = await supabase
  .from("quizzes")
  .select("*")
  .eq("is_active", true);
```

---

## Quick Reference

### Must Do ✅

- Use semantic color tokens (`bg-background`, `text-foreground`)
- Use HSL format for all colors
- Support both light and dark modes
- Use density-aware spacing utilities
- Apply focus indicators for accessibility
- Use zebra striping for lists/tables

### Must Avoid ❌

- Direct colors (`bg-white`, `text-black`, `bg-blue-500`)
- RGB color format
- Hardcoded spacing values in components
- Missing focus states
- Components that break in dark mode

---

*Last updated: December 2024*
