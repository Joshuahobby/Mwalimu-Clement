import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings, Volume2, Type, Palette, Moon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// Simple ThemeToggle component -  replace with your actual implementation
const ThemeToggle = () => <Switch />;


export default function AccessibilitySettings() {
  const [readAloud, setReadAloud] = useState(false);
  const [dyslexicFont, setDyslexicFont] = useState(false);
  const [highContrast, setHighContrast] = useState(false);

  const toggleReadAloud = () => {
    setReadAloud(!readAloud);
    // Implementation for text-to-speech would go here
  };

  const toggleDyslexicFont = () => {
    setDyslexicFont(!dyslexicFont);
    document.documentElement.style.fontFamily = dyslexicFont
      ? ""
      : "OpenDyslexic, sans-serif";
  };

  const toggleHighContrast = () => {
    setHighContrast(!highContrast);
    document.documentElement.classList.toggle("high-contrast");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Settings className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Accessibility Options</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="flex justify-between cursor-default">
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            <span>Read Aloud</span>
          </div>
          <Switch checked={readAloud} onCheckedChange={toggleReadAloud} />
        </DropdownMenuItem>
        <DropdownMenuItem className="flex justify-between cursor-default">
          <div className="flex items-center gap-2">
            <Type className="h-4 w-4" />
            <span>Dyslexic Font</span>
          </div>
          <Switch checked={dyslexicFont} onCheckedChange={toggleDyslexicFont} />
        </DropdownMenuItem>
        <DropdownMenuItem className="flex justify-between cursor-default">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            <span>High Contrast</span>
          </div>
          <Switch checked={highContrast} onCheckedChange={toggleHighContrast} />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="flex justify-between cursor-default">
          <div className="flex items-center gap-2">
            <Moon className="h-4 w-4" />
            <span>Dark Mode</span>
          </div>
          <ThemeToggle />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}