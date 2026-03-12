"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Verhindert Hydration Mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Platzhalter während des Ladens
    return (
      <button
        className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 w-10 h-10"
        aria-label="Theme wird geladen"
      >
        <span className="sr-only">Laden...</span>
      </button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="relative p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 
                 transition-all duration-300 ease-in-out group focus:outline-none focus:ring-2 focus:ring-primary-500"
      aria-label={isDark ? "Zu hellem Theme wechseln" : "Zu dunklem Theme wechseln"}
      title={isDark ? "Helles Theme" : "Dunkles Theme"}
    >
      <div className="relative w-6 h-6">
        {/* Sonne - erscheint im Light Mode */}
        <Sun
          className={`absolute inset-0 w-6 h-6 text-amber-500 transition-all duration-500 ease-spring
            ${isDark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"}`}
        />
        
        {/* Mond - erscheint im Dark Mode */}
        <Moon
          className={`absolute inset-0 w-6 h-6 text-primary-400 transition-all duration-500 ease-spring
            ${isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"}`}
        />
      </div>
      
      {/* Tooltip / Beschriftung */}
      <span className="sr-only">
        {isDark ? "Dunkles Theme aktiv" : "Helles Theme aktiv"}
      </span>
    </button>
  );
}
