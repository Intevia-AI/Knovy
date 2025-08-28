# Application Color Scheme

This document defines the color palette and styles for the application's light theme, which is based on a "frosted glass" aesthetic.

## Core Styles

These are the foundational styles applied to windows and popovers.

| Element | Style | Tailwind CSS Class / Value |
| :--- | :--- | :--- |
| **Main Background** | Frosted Glass | `.glass-popover` (`bg-muted/80 backdrop-blur-md`) |
| **Borders** | Subtle Black | `border-black/10` |
| **Rounding** | Extra Large | `rounded-3xl` |

## Typography

| Element | Style | Tailwind CSS Class |
| :--- | :--- | :--- |
| **Default Text** | Black | `text-black` |
| **Muted Text** | Gray | `placeholder:text-gray-500` |

## Component Color States

### General Icon Buttons (Features, Settings, etc.)

| State | Background | Icon/Text Color | Tailwind Classes |
| :--- | :--- | :--- | :--- |
| **Default** | Transparent | Black | `variant="ghost"`, `text-black` |
| **Hover** | Muted Gray | Black | `hover:bg-muted`, `hover:text-black` |
| **Active/Open**| Muted Gray | Black | `variant="secondary"` |

### Listen/Recording Button

| State | Background | Icon/Text Color | Tailwind Classes |
| :--- | :--- | :--- | :--- |
| **Default** | Muted Gray | Black | `bg-muted`, `text-black` |
| **Default (Hover)** | Destructive (Red) | White | `hover:bg-destructive/80`, `hover:text-white` |
| **Listening** | Destructive (Red) | White | `bg-destructive/80`, `text-white` |
| **Animation** | Pulsing Shadow | - | `.breathing-light` |

### Chat Panel

| Element | Background | Border | Text Color | Tailwind Classes |
| :--- | :--- | :--- | :--- | :--- |
| **Assistant Message** | Faint Black | Subtle Black | Black | `bg-black/5`, `border-black/10`, `text-black` |
| **User Message** | Faint Blue | Subtle Blue | Black | `bg-blue-500/20`, `border-blue-500/30`, `text-black` |
| **Input Field** | Faint Black | Subtle Black | Black | `bg-black/5`, `border-black/20`, `text-black` |

## CSS Variables

These are the base variables from `globals.css` that define the theme palette.

```css
:root {
    --background: 255 100% 100%; /* White */
    --foreground: 0 0% 0%; /* Black */
    --card: 255 100% 100%;
    --card-foreground: 0 0% 0%;
    --popover: 255 100% 100%;
    --popover-foreground: 0 0% 0%;
    --primary: 0 0% 0%;
    --primary-foreground: 255 100% 100%;
    --secondary: 0 0% 96.1%;
    --secondary-foreground: 0 0% 9%;
    --muted: 0 0% 96.1%;
    --muted-foreground: 0 0% 45.1%;
    --accent: 0 0% 96.1%;
    --accent-foreground: 0 0% 9%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 0% / 0.1;
    --input: 0 0% 89.8%;
    --ring: 0 0% 0%;
    --radius: 1rem;
}
```
