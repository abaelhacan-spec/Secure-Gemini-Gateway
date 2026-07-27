/**
 * Nabih Design Tokens — based on the official Nabih brand identity docs.
 * Primary: Deep Teal | Fonts: IBM Plex Sans (Inter used as fallback in Expo Go)
 */

const colors = {
  light: {
    // Brand
    primary: '#2B8B7A',
    primarySoft: '#E6F4F1',
    primaryDark: '#1F6B5E',

    // Surfaces
    background: '#F5FAF8',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    cardBorder: '#E2EDE9',

    // Text
    text: '#1B2B27',
    foreground: '#1B2B27',
    textSecondary: '#5B7B73',
    muted: '#8FA89E',

    // Interactive
    tint: '#2B8B7A',
    border: '#DCE8E4',
    input: '#E2EDE9',

    // Semantic
    success: '#27AE60',
    successSoft: '#E8F8EE',
    warning: '#E67E22',
    warningSoft: '#FEF4E8',
    danger: '#E74C3C',
    dangerSoft: '#FEE8E6',

    // Word lifecycle stages
    stageNew: '#8FA89E',
    stageLearned: '#2196F3',
    stageReviewed: '#9C27B0',
    stageMastered: '#27AE60',
    stageNeedsReview: '#E67E22',

    // Legacy aliases
    secondary: '#E6F4F1',
    secondaryForeground: '#1B2B27',
    mutedForeground: '#8FA89E',
    accentForeground: '#1B2B27',
    accent: '#E6F4F1',
    destructive: '#E74C3C',
    destructiveForeground: '#FFFFFF',
    cardForeground: '#1B2B27',
    primaryForeground: '#FFFFFF',
  },

  dark: {
    primary: '#4DB6A3',
    primarySoft: '#1D2D2A',
    primaryDark: '#38A090',

    background: '#1A1E22',
    surface: '#1E2429',
    card: '#1E2429',
    cardBorder: '#2A3530',

    text: '#E5F0EC',
    foreground: '#E5F0EC',
    textSecondary: '#8FA89E',
    muted: '#617B73',

    tint: '#4DB6A3',
    border: '#2A3530',
    input: '#2A3530',

    success: '#2ECC71',
    successSoft: '#1A2D22',
    warning: '#F39C12',
    warningSoft: '#2D2318',
    danger: '#E74C3C',
    dangerSoft: '#2D1A18',

    stageNew: '#617B73',
    stageLearned: '#42A5F5',
    stageReviewed: '#CE93D8',
    stageMastered: '#66BB6A',
    stageNeedsReview: '#FFA726',

    secondary: '#1D2D2A',
    secondaryForeground: '#E5F0EC',
    mutedForeground: '#617B73',
    accentForeground: '#E5F0EC',
    accent: '#1D2D2A',
    destructive: '#E74C3C',
    destructiveForeground: '#FFFFFF',
    cardForeground: '#E5F0EC',
    primaryForeground: '#FFFFFF',
  },

  radius: 12,
};

export default colors;
