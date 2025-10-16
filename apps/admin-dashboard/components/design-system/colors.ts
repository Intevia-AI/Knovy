// Modern Color System for Admin Dashboard
export const colors = {
  // Primary colors - Deep Blue theme
  primary: {
    50: '#E8F1FF',
    100: '#D5E5FF',
    200: '#B3D0FF',
    300: '#85B5FF',
    400: '#5793FF',
    500: '#2B6FFF', // Main primary
    600: '#0047FF',
    700: '#0039D6',
    800: '#002AA3',
    900: '#001D70',
  },

  // Neutral colors
  neutral: {
    50: '#FAFBFC',
    100: '#F5F7FA',
    200: '#E4E9EF',
    300: '#CBD4E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
  },

  // Semantic colors
  semantic: {
    success: {
      light: '#10B981',
      main: '#059669',
      dark: '#047857',
    },
    warning: {
      light: '#F59E0B',
      main: '#D97706',
      dark: '#B45309',
    },
    error: {
      light: '#EF4444',
      main: '#DC2626',
      dark: '#B91C1C',
    },
    info: {
      light: '#3B82F6',
      main: '#2563EB',
      dark: '#1D4ED8',
    },
  },

  // Chart colors - vibrant and modern
  chart: {
    primary: '#2B6FFF',
    secondary: '#10B981',
    tertiary: '#F59E0B',
    quaternary: '#8B5CF6',
    quinary: '#EC4899',
    senary: '#06B6D4',
  },

  // Background colors
  background: {
    primary: '#FFFFFF',
    secondary: '#FAFBFC',
    tertiary: '#F5F7FA',
    hover: '#E8F1FF',
    selected: '#D5E5FF',
  },

  // Border colors
  border: {
    default: '#E4E9EF',
    hover: '#CBD4E1',
    focus: '#2B6FFF',
  },
} as const;

// Tailwind CSS class mappings
export const colorClasses = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white',
  primaryLight: 'bg-blue-50 hover:bg-blue-100 text-blue-700',
  success: 'bg-green-600 hover:bg-green-700 text-white',
  successLight: 'bg-green-50 hover:bg-green-100 text-green-700',
  warning: 'bg-amber-600 hover:bg-amber-700 text-white',
  warningLight: 'bg-amber-50 hover:bg-amber-100 text-amber-700',
  error: 'bg-red-600 hover:bg-red-700 text-white',
  errorLight: 'bg-red-50 hover:bg-red-100 text-red-700',
};