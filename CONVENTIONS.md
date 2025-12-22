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
13. [Supabase Integration](#supabase-integration)
14. [Edge Functions](#edge-functions)
15. [AI Integration](#ai-integration)

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

## Supabase Integration

### Client Usage

Always import the Supabase client from the integration folder:

```tsx
// ✅ CORRECT
import { supabase } from "@/integrations/supabase/client";

// ❌ NEVER edit or create new client files
// The client.ts file is auto-generated
```

### Query Patterns

```tsx
// Fetching data
const { data, error } = await supabase
  .from("table_name")
  .select("*")
  .eq("column", value);

// Single row (use maybeSingle to avoid errors when no data)
const { data, error } = await supabase
  .from("table_name")
  .select("*")
  .eq("id", id)
  .maybeSingle();  // ✅ Not .single() - avoids errors when no data

// Insert
const { data, error } = await supabase
  .from("table_name")
  .insert({ column: value })
  .select();

// Update
const { data, error } = await supabase
  .from("table_name")
  .update({ column: newValue })
  .eq("id", id);

// Delete
const { error } = await supabase
  .from("table_name")
  .delete()
  .eq("id", id);
```

### Row Level Security (RLS)

- **Always enable RLS** on tables containing user data
- Use `auth.uid()` in policies for user-specific access
- Use security definer functions to avoid infinite recursion

```sql
-- ✅ CORRECT - Use security definer function
CREATE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Use in policy
CREATE POLICY "Admins can manage"
ON public.table_name
USING (public.has_role(auth.uid(), 'admin'));
```

### Realtime Subscriptions

```tsx
useEffect(() => {
  const channel = supabase
    .channel('schema-db-changes')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',  // or 'UPDATE', 'DELETE', '*'
        schema: 'public',
        table: 'table_name'
      },
      (payload) => {
        console.log('Change received:', payload);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

### Important Limits

- Default query limit: 1000 rows
- Always handle errors gracefully
- Use `.maybeSingle()` instead of `.single()` when data might not exist

---

## Edge Functions

### File Structure

```
supabase/
├── config.toml           # Only config file, never create others
└── functions/
    └── function-name/
        └── index.ts      # All code in index.ts, no subfolders
```

### Standard Template

```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers - ALWAYS include for web app calls
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight - ALWAYS include
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { someParam } = await req.json();
    
    // Your logic here
    console.log('Processing:', someParam);  // Good logging

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error:', error);  // Always log errors
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
```

### Calling Edge Functions

```tsx
// ✅ CORRECT - Use supabase.functions.invoke
const { data, error } = await supabase.functions.invoke('function-name', {
  body: { param: value }
});

// ❌ NEVER use raw fetch with env variables
// fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/...`)
```

### Making Functions Public

Add to `supabase/config.toml`:

```toml
[functions.function-name]
verify_jwt = false
```

### Must Do ✅

- Always include CORS headers
- Always handle OPTIONS preflight
- Add comprehensive logging
- Use `SUPABASE_SERVICE_ROLE_KEY` for admin operations
- Keep all code in `index.ts` (no subfolders)

### Must Avoid ❌

- Raw SQL execution in edge functions
- Direct HTTP calls to Supabase API (use client methods)
- Importing from `src/` directory (not in function context)
- Creating multiple config.toml files

---

## AI Integration

### Lovable AI Gateway

This project uses the Lovable AI gateway for AI features. No API key required.

```typescript
const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'google/gemini-2.5-flash',  // or other supported models
    messages: [
      { role: 'system', content: 'System prompt' },
      { role: 'user', content: userInput }
    ],
  }),
});
```

### Supported Models

| Model | Use Case |
|-------|----------|
| `google/gemini-2.5-flash` | Balanced speed/quality, default choice |
| `google/gemini-2.5-pro` | Complex reasoning, multimodal |
| `google/gemini-2.5-flash-lite` | Fast, cheap, simple tasks |
| `openai/gpt-5` | High accuracy, expensive |
| `openai/gpt-5-mini` | Good balance of cost/quality |
| `openai/gpt-5-nano` | Fastest, cheapest |

### Error Handling

```typescript
if (!response.ok) {
  const errorData = await response.json();
  
  if (response.status === 429) {
    // Rate limited
    throw new Error('Rate limited, try again later');
  }
  
  if (response.status === 402) {
    // Credits exhausted
    throw new Error('AI credits exhausted');
  }
  
  throw new Error(errorData.error?.message || 'AI request failed');
}
```

### Cost Tracking

Track token usage for cost visibility:

```typescript
const data = await response.json();
const usage = data.usage;

// Log or store for analytics
console.log(`Tokens - Input: ${usage.prompt_tokens}, Output: ${usage.completion_tokens}`);
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
- Enable RLS on user data tables
- Include CORS headers in edge functions
- Use `supabase.functions.invoke()` for function calls
- Log errors in edge functions

### Must Avoid ❌

- Direct colors (`bg-white`, `text-black`, `bg-blue-500`)
- RGB color format
- Hardcoded spacing values in components
- Missing focus states
- Components that break in dark mode
- Raw SQL in edge functions
- Direct fetch to Supabase API endpoints
- `.single()` when data might not exist (use `.maybeSingle()`)
- Editing auto-generated files (`client.ts`, `types.ts`)

---

*Last updated: December 2024*
