# GamerClip AI - Design System

## Brand Identity

### Logo
The GamerClip AI logo combines a gamepad with a play button overlay and film strip, representing gaming and video creation. The logo is coral red (#ff5757) on a dark navy background.

### Core Values
- **Gaming-First**: Bold, energetic design that resonates with gamers
- **Professional**: Clean, modern UI that feels polished
- **AI-Powered**: Futuristic elements with smart interactions

---

## Color Palette

### Brand Colors
```typescript
brand: {
  primary: '#ff5757',      // Coral Red - Main brand color
  primaryDark: '#e64545',  // Darker red for hover states
  primaryLight: '#ff7676', // Lighter red for accents
}
```

### Background Colors
```typescript
background: {
  primary: '#1a1f3a',      // Deep Navy - Main background
  secondary: '#252b4a',    // Medium Navy - Cards & surfaces
  tertiary: '#2f3554',     // Light Navy - Elevated elements
  overlay: 'rgba(26, 31, 58, 0.95)', // Overlay backgrounds
}
```

### Text Colors
```typescript
text: {
  primary: '#ffffff',      // White - Headlines & primary text
  secondary: '#b4b9d6',    // Light blue-gray - Body text
  tertiary: '#8a8fb0',     // Medium blue-gray - Captions
  muted: '#5e6380',        // Dark blue-gray - Disabled text
}
```

### Accent Colors
```typescript
accent: {
  green: '#10b981',        // Success/Completed
  blue: '#3b82f6',         // Info/Processing
  purple: '#8b5cf6',       // Premium/Special
  yellow: '#fbbf24',       // Warning/Premium badge
}
```

### Status Colors
```typescript
status: {
  success: '#10b981',      // Completed clips, success messages
  error: '#ef4444',        // Failed, errors
  warning: '#f59e0b',      // Warnings
  info: '#3b82f6',         // Processing, info messages
}
```

### Border Colors
```typescript
border: {
  light: '#3a4063',        // Standard borders
  medium: '#4a5073',       // Elevated borders
  dark: '#2a2f4a',         // Subtle borders
}
```

---

## Typography

### Font Weights
- **Regular**: 400 (avoid using, prefer semi-bold+)
- **Medium**: 500 - Secondary text
- **Semi-Bold**: 600 - Labels, metadata
- **Bold**: 700 - Headings, buttons, important text
- **Extra Bold**: 800 - Large titles, hero text

### Font Sizes
```typescript
// Headings
hero: 36px           // Landing page titles
h1: 28px             // Screen titles
h2: 24px             // Section titles
h3: 20px             // Subsection titles
h4: 18px             // Card titles

// Body
large: 16px          // Emphasized body text
body: 14px           // Standard body text
small: 12px          // Captions, metadata
tiny: 10px           // Badges, micro text
```

### Letter Spacing
- Headlines (24px+): 0.5px
- Titles (18-20px): 0.3px
- Body text: 0px (default)
- Badges/Labels: 0.5px (uppercase)

---

## Component Styles

### Cards
```typescript
{
  backgroundColor: Colors.background.secondary,
  borderRadius: 16,
  borderWidth: 1.5,
  borderColor: Colors.border.light,
  shadowColor: Colors.shadow.dark,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.15,
  shadowRadius: 8,
  elevation: 3,
}
```

### Buttons (Primary)
```typescript
{
  backgroundColor: Colors.brand.primary,
  borderRadius: 12,
  padding: 18,
  shadowColor: Colors.shadow.primary,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.4,
  shadowRadius: 8,
  elevation: 4,
}
```

### Buttons (Secondary)
```typescript
{
  backgroundColor: Colors.background.tertiary,
  borderRadius: 12,
  padding: 16,
  borderWidth: 1.5,
  borderColor: Colors.border.medium,
}
```

### Input Fields
```typescript
{
  backgroundColor: Colors.background.secondary,
  borderWidth: 1.5,
  borderColor: Colors.border.light,
  borderRadius: 12,
  padding: 16,
  fontSize: 16,
  color: Colors.text.primary,
}
```

### Modals
```typescript
{
  backgroundColor: Colors.background.secondary,
  borderRadius: 20,
  padding: 24,
  borderWidth: 1.5,
  borderColor: Colors.border.light,
  shadowColor: Colors.shadow.dark,
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.3,
  shadowRadius: 16,
  elevation: 8,
}
```

### Status Badges
```typescript
{
  paddingHorizontal: 10,
  paddingVertical: 5,
  borderRadius: 8,
  backgroundColor: Colors.status.success, // or .error, .info
  shadowColor: Colors.shadow.dark,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 3,
}
```

---

## Spacing System

Use an 8px grid system for consistent spacing:

```typescript
spacing: {
  xs: 4,    // Tight spacing within components
  sm: 8,    // Small gaps
  md: 12,   // Medium gaps
  lg: 16,   // Standard gaps between elements
  xl: 24,   // Large gaps between sections
  xxl: 32,  // Extra large gaps
  xxxl: 40, // Hero spacing
}
```

---

## Iconography

### Icons Library
- **Primary**: lucide-react-native
- **Size Scale**: 16, 20, 24, 32, 48, 64
- **Stroke Width**: 2 (standard), 2.5 (emphasized)

### Icon Colors
- Active: `Colors.brand.primary`
- Inactive: `Colors.text.muted`
- In Cards: `Colors.text.secondary`
- On Dark Backgrounds: `Colors.text.primary`

---

## Elevation & Shadows

### Levels
1. **Flat** (0): Background elements
2. **Low** (1-2): Cards on background
3. **Medium** (3-4): Raised cards, buttons
4. **High** (5-8): Modals, overlays
5. **Floating** (8+): Dropdowns, tooltips

### Shadow Configuration
```typescript
// Low elevation
{
  shadowColor: Colors.shadow.dark,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.15,
  shadowRadius: 8,
  elevation: 3,
}

// High elevation
{
  shadowColor: Colors.shadow.dark,
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.3,
  shadowRadius: 16,
  elevation: 8,
}

// Brand shadow (for primary buttons/elements)
{
  shadowColor: Colors.shadow.primary, // #ff5757 with opacity
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.4,
  shadowRadius: 8,
  elevation: 4,
}
```

---

## Border Radius

### Size Scale
- **Small**: 8px - Badges, small buttons
- **Medium**: 12px - Buttons, inputs
- **Large**: 16px - Cards
- **XL**: 20px - Modals
- **Circular**: 50% - Avatars, icon buttons

---

## Animation & Transitions

### Durations
- **Fast**: 150ms - Micro-interactions
- **Normal**: 250ms - Standard transitions
- **Slow**: 400ms - Page transitions

### Easing
- **Standard**: ease-in-out
- **Enter**: ease-out
- **Exit**: ease-in

---

## Interactive States

### Buttons
- **Default**: Full color
- **Hover**: N/A (mobile)
- **Active**: `opacity: 0.8` (via activeOpacity prop)
- **Disabled**: `opacity: 0.6`

### Cards
- **Default**: Full color
- **Active**: `opacity: 0.7` (via activeOpacity prop)
- **Selected**: Border color changes to `Colors.brand.primary`, border width 2.5px

---

## Accessibility

### Contrast Ratios
- Primary text on dark: 21:1 (AAA)
- Secondary text on dark: 7:1 (AA)
- Brand primary on dark: 4.5:1 (AA)

### Touch Targets
- Minimum: 44x44pt (iOS HIG)
- Recommended: 48x48pt
- Buttons: 50-60pt height

### Color Independence
- Never rely on color alone
- Use icons + text
- Include status text with status colors

---

## Component Library

### Logo Component
```tsx
<Logo size="small" | "medium" | "large" showText={boolean} />
```

**Sizes:**
- Small: 40px container, 24px icon
- Medium: 56px container, 32px icon
- Large: 80px container, 48px icon

### Usage
- Landing/Auth screens: Large with text
- Navigation headers: Medium with text
- Tab bars: Small without text

---

## Implementation Notes

### Color Constants
All colors are centralized in `/constants/colors.ts`

### Usage
```typescript
import { Colors } from '@/constants/colors';

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background.primary,
  },
  text: {
    color: Colors.text.primary,
  },
  button: {
    backgroundColor: Colors.brand.primary,
  },
});
```

### Never Use
❌ Hard-coded hex values
❌ Inline color strings
❌ Magic numbers

### Always Use
✅ Color constants from `Colors` object
✅ Spacing from 8px grid
✅ Typography scale

---

## Screen-Specific Guidelines

### Home Screen
- Large logo at top center
- 3 action cards with distinct colored icons
- Stats cards at bottom
- Modal overlays for interactions

### Library Screen
- Grid layout (2 columns)
- Status badges in top right
- Pull-to-refresh enabled
- Empty state with large icon

### Profile Screen
- Avatar with brand-colored border
- Tier badge below avatar
- Menu items with icon containers
- Sign out button at bottom (destructive style)

### Export Screen
- Style pack grid (2 columns)
- Selected state with brand border
- Feature toggles with checkmarks
- Export button fixed at bottom

### Authentication Screens
- Centered logo
- Full-width inputs
- Primary button for submit
- Link to alternate auth action

---

## Best Practices

### DO
✅ Use consistent spacing (8px grid)
✅ Apply shadows to elevated elements
✅ Use bold font weights (700+) for emphasis
✅ Include letter-spacing on headlines
✅ Test on both light and dark status bars

### DON'T
❌ Mix border widths (use 1.5px or 2.5px)
❌ Use default system fonts
❌ Forget hover/active states
❌ Ignore accessibility guidelines
❌ Use pure black (#000000)

---

## Future Considerations

### Dark Mode
Currently using dark theme by default. If light mode is added:
- Invert background hierarchy
- Adjust text colors
- Update shadow opacity
- Test all status colors

### Theming
To add game-specific themes:
1. Extend `Colors` object with theme variants
2. Create theme context provider
3. Add theme switcher in settings
4. Store user preference

---

## Design Tools

### Figma Integration
- Export colors as styles
- Create component library
- Share with designers

### Testing
- Test on iOS and Android
- Verify shadows render correctly
- Check text legibility
- Validate touch targets

---

**Version**: 1.0
**Last Updated**: 2025-01-23
**Maintained By**: Development Team
