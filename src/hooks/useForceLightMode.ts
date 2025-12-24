import { useEffect } from 'react';
import { usePublicTheme } from './usePublicTheme';

/**
 * Forces light mode on the page and applies the configured public theme.
 * This is used for public-facing quiz pages that should always
 * match the sparkly.hr website design (light theme from app_settings).
 */
export function useForceLightMode() {
  // usePublicTheme handles fetching settings from DB, applying colors,
  // and guarding against "dark" class being re-added.
  usePublicTheme();
}
