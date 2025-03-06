import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "./button";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

  useEffect(() => {
    // Check system preference
    const systemPreference = window.matchMedia("(prefers-color-scheme: dark)");
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | "system";

    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme === "system") {
        document.documentElement.classList.toggle("dark", systemPreference.matches);
      } else {
        document.documentElement.classList.toggle("dark", savedTheme === "dark");
      }
    }

    // Listen for system theme changes
    const handleChange = (e: MediaQueryListEvent) => {
      if (theme === "system") {
        document.documentElement.classList.toggle("dark", e.matches);
      }
    };

    systemPreference.addEventListener("change", handleChange);
    return () => systemPreference.removeEventListener("change", handleChange);
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);

    if (nextTheme === "system") {
      const systemPreference = window.matchMedia("(prefers-color-scheme: dark)");
      document.documentElement.classList.toggle("dark", systemPreference.matches);
    } else {
      document.documentElement.classList.toggle("dark", nextTheme === "dark");
    }
  };

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Toggle theme"
      className={`rounded-full ${className}`}
      onClick={toggleTheme}
    >
      {theme === "dark" ? (
        <Moon className="h-[1.2rem] w-[1.2rem]" />
      ) : theme === "light" ? (
        <Sun className="h-[1.2rem] w-[1.2rem]" />
      ) : (
        <Sun className="h-[1.2rem] w-[1.2rem] opacity-75" />
      )}
      <span className="sr-only">
        {theme === "dark" ? "Dark mode" : theme === "light" ? "Light mode" : "System theme"}
      </span>
    </Button>
  );
}