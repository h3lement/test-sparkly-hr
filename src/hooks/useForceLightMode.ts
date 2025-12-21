import { useEffect } from 'react';

/**
 * Forces light mode on the page, removing dark class and preventing
 * any theme changes while the component is mounted.
 * 
 * This is used for public-facing quiz pages that should always
 * match the sparkly.hr website design (light theme).
 */
export function useForceLightMode() {
  useEffect(() => {
    const root = document.documentElement;
    
    // Force remove dark mode immediately
    root.classList.remove('dark');
    
    // Create a MutationObserver to prevent any external code from adding dark mode
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          if (root.classList.contains('dark')) {
            root.classList.remove('dark');
          }
        }
      });
    });
    
    // Observe class changes on the root element
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    // Also override any CSS variables that might have been set by admin preferences
    // Reset to light mode values
    const lightModeOverrides: Record<string, string> = {
      '--background': '20 40% 97%',
      '--foreground': '230 25% 15%',
      '--card': '0 0% 100%',
      '--card-foreground': '230 25% 15%',
      '--popover': '0 0% 100%',
      '--popover-foreground': '230 25% 15%',
      '--primary': '235 55% 52%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '20 25% 93%',
      '--secondary-foreground': '230 25% 20%',
      '--muted': '20 20% 90%',
      '--muted-foreground': '230 15% 45%',
      '--accent': '235 45% 60%',
      '--accent-foreground': '0 0% 100%',
      '--destructive': '0 84% 60%',
      '--destructive-foreground': '0 0% 100%',
      '--border': '20 15% 88%',
      '--input': '20 15% 88%',
      '--ring': '235 55% 52%',
      '--quiz-primary': '235 55% 52%',
      '--quiz-primary-light': '235 45% 60%',
      '--quiz-glow': '235 55% 65%',
      '--sparkly-blush': '15 60% 95%',
      '--sparkly-cream': '40 30% 96%',
      '--sparkly-indigo': '235 55% 52%',
      '--sparkly-indigo-light': '235 45% 60%',
    };
    
    // Apply light mode CSS variables
    Object.entries(lightModeOverrides).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    
    return () => {
      observer.disconnect();
      // Clear the inline styles we set (let the normal theme take over again)
      Object.keys(lightModeOverrides).forEach((key) => {
        root.style.removeProperty(key);
      });
    };
  }, []);
}
