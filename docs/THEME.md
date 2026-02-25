# Sleeper Fantasy Assistant - Design System & Theme

> **Reference Document**: Developers should consult this file for all styling, colors, and design decisions.

## Brand Identity

**App Name**: Sleeper Fantasy Assistant  
**Tagline**: AI-Powered Fantasy Football Intelligence

---

## Color System

### Light Theme

```css
:root[data-theme="light"] {
  /* Primary Colors */
  --primary-50: #E6F0FF;
  --primary-100: #CCE0FF;
  --primary-200: #99C2FF;
  --primary-300: #66A3FF;
  --primary-400: #3385FF;
  --primary-500: #0066FF;  /* Main Brand Color */
  --primary-600: #0052CC;
  --primary-700: #003D99;
  --primary-800: #002966;
  --primary-900: #001433;

  /* Accent Colors */
  --accent-success: #10B981;    /* Positive trends, wins */
  --accent-warning: #F59E0B;    /* Caution, bye weeks */
  --accent-danger: #EF4444;     /* Negative trends, losses */
  --accent-info: #3B82F6;       /* Information highlights */

  /* Neutral Colors */
  --neutral-50: #FAFAFA;
  --neutral-100: #F4F4F5;
  --neutral-200: #E4E4E7;
  --neutral-300: #D4D4D8;
  --neutral-400: #A1A1AA;
  --neutral-500: #71717A;
  --neutral-600: #52525B;
  --neutral-700: #3F3F46;
  --neutral-800: #27272A;
  --neutral-900: #18181B;

  /* Background Colors */
  --bg-primary: #FFFFFF;
  --bg-secondary: #F4F4F5;
  --bg-tertiary: #E4E4E7;
  --bg-card: #FFFFFF;
  --bg-elevated: #FFFFFF;

  /* Text Colors */
  --text-primary: #18181B;
  --text-secondary: #52525B;
  --text-tertiary: #71717A;
  --text-inverse: #FFFFFF;

  /* Border Colors */
  --border-primary: #E4E4E7;
  --border-secondary: #D4D4D8;

  /* Shadow */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}
```

### Dark Theme

```css
:root[data-theme="dark"] {
  /* Primary Colors */
  --primary-50: #001433;
  --primary-100: #002966;
  --primary-200: #003D99;
  --primary-300: #0052CC;
  --primary-400: #0066FF;
  --primary-500: #3385FF;  /* Main Brand Color (brighter in dark) */
  --primary-600: #66A3FF;
  --primary-700: #99C2FF;
  --primary-800: #CCE0FF;
  --primary-900: #E6F0FF;

  /* Accent Colors */
  --accent-success: #34D399;
  --accent-warning: #FBBF24;
  --accent-danger: #F87171;
  --accent-info: #60A5FA;

  /* Neutral Colors */
  --neutral-50: #18181B;
  --neutral-100: #27272A;
  --neutral-200: #3F3F46;
  --neutral-300: #52525B;
  --neutral-400: #71717A;
  --neutral-500: #A1A1AA;
  --neutral-600: #D4D4D8;
  --neutral-700: #E4E4E7;
  --neutral-800: #F4F4F5;
  --neutral-900: #FAFAFA;

  /* Background Colors */
  --bg-primary: #0F0F10;
  --bg-secondary: #18181B;
  --bg-tertiary: #27272A;
  --bg-card: #1F1F23;
  --bg-elevated: #27272A;

  /* Text Colors */
  --text-primary: #FAFAFA;
  --text-secondary: #A1A1AA;
  --text-tertiary: #71717A;
  --text-inverse: #18181B;

  /* Border Colors */
  --border-primary: #3F3F46;
  --border-secondary: #52525B;

  /* Shadow */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
}
```

---

## Typography

```css
:root {
  /* Font Families */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* Font Sizes */
  --text-xs: 0.75rem;     /* 12px */
  --text-sm: 0.875rem;    /* 14px */
  --text-base: 1rem;      /* 16px */
  --text-lg: 1.125rem;    /* 18px */
  --text-xl: 1.25rem;     /* 20px */
  --text-2xl: 1.5rem;     /* 24px */
  --text-3xl: 1.875rem;   /* 30px */
  --text-4xl: 2.25rem;    /* 36px */

  /* Font Weights */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;

  /* Line Heights */
  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;
}
```

---

## Spacing System

```css
:root {
  --space-0: 0;
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-5: 1.25rem;   /* 20px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
  --space-10: 2.5rem;   /* 40px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */
}
```

---

## Border Radius

```css
:root {
  --radius-sm: 0.25rem;   /* 4px */
  --radius-md: 0.5rem;    /* 8px */
  --radius-lg: 0.75rem;   /* 12px */
  --radius-xl: 1rem;      /* 16px */
  --radius-2xl: 1.5rem;   /* 24px */
  --radius-full: 9999px;
}
```

---

## Component Guidelines

### Cards

```css
.card {
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
}

.card:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--border-secondary);
}
```

### Buttons

```css
.btn-primary {
  background: var(--primary-500);
  color: var(--text-inverse);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-weight: var(--font-medium);
  transition: all 0.2s ease;
}

.btn-primary:hover {
  background: var(--primary-600);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
}
```

### Position Badges

```css
.badge-qb { background: #EF4444; color: white; }
.badge-rb { background: #22C55E; color: white; }
.badge-wr { background: #3B82F6; color: white; }
.badge-te { background: #F59E0B; color: white; }
.badge-k  { background: #8B5CF6; color: white; }
.badge-def { background: #6B7280; color: white; }
```

---

## Animation Guidelines

```css
:root {
  --transition-fast: 150ms ease;
  --transition-base: 200ms ease;
  --transition-slow: 300ms ease;
}

/* Micro-interactions */
.hover-lift:hover {
  transform: translateY(-2px);
  transition: transform var(--transition-fast);
}

.hover-glow:hover {
  box-shadow: 0 0 20px var(--primary-500);
}

/* Loading States */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.skeleton {
  background: var(--neutral-200);
  animation: pulse 2s infinite;
}

[data-theme="dark"] .skeleton {
  background: var(--neutral-200);
}
```

---

## Responsive Breakpoints

```css
/* Mobile First Approach */
--screen-sm: 640px;    /* Small devices */
--screen-md: 768px;    /* Tablets */
--screen-lg: 1024px;   /* Small laptops */
--screen-xl: 1280px;   /* Desktops */
--screen-2xl: 1536px;  /* Large screens */
```

---

## Usage Examples

### Theme Toggle Implementation

```typescript
// Theme toggle hook
export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const preferred = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(stored || (preferred ? 'dark' : 'light'));
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  return { theme, toggleTheme };
}
```

---

## Icon Set

Use **Lucide React** icons for consistency:
- Dashboard: `LayoutDashboard`
- Players: `Users`
- Trades: `ArrowLeftRight`
- Waiver: `Plus`
- Settings: `Settings`
- Refresh: `RefreshCw`
- Theme Toggle: `Sun` / `Moon`
- AI Suggestions: `Sparkles`
