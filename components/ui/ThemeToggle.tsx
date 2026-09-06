import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import { ICONS } from '../../constants';

interface ThemeToggleProps {
  className?: string;
  /** Variante visual para fondos claros u oscuros de marca */
  tone?: 'default' | 'onBrand';
}

/**
 * Interruptor claro/oscuro — accesible y persistente vía useTheme.
 */
const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = '',
  tone = 'default',
}) => {
  const { isDark, toggleTheme } = useTheme();

  const toneClasses =
    tone === 'onBrand'
      ? 'text-white/90 hover:bg-white/15 hover:text-white'
      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`p-2 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center ${toneClasses} ${className}`}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={isDark ? 'Modo claro' : 'Modo oscuro'}
    >
      {isDark ? ICONS.sun : ICONS.moon}
    </button>
  );
};

export default ThemeToggle;
