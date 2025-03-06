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
import { Settings, Volume2, Type, Palette } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ui/theme-toggle";

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
        <Button 
          variant="outline" 
          size="icon"
          className="relative rounded-full hover:bg-accent hover:text-accent-foreground"
        >
          <Settings className="h-5 w-5" />
          <span className="sr-only">Open accessibility menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 md:w-96">
        <DropdownMenuLabel className="text-lg font-semibold">
          Accessibility Options
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <div className="p-2 space-y-4">
          <DropdownMenuItem className="flex items-center justify-between cursor-default focus:bg-transparent">
            <div className="flex items-center gap-2">
              <Volume2 className="h-5 w-5" />
              <Label htmlFor="read-aloud" className="text-sm font-medium">
                Read Aloud
              </Label>
            </div>
            <Switch 
              id="read-aloud"
              checked={readAloud} 
              onCheckedChange={toggleReadAloud} 
            />
          </DropdownMenuItem>

          <DropdownMenuItem className="flex items-center justify-between cursor-default focus:bg-transparent">
            <div className="flex items-center gap-2">
              <Type className="h-5 w-5" />
              <Label htmlFor="dyslexic-font" className="text-sm font-medium">
                Dyslexic Font
              </Label>
            </div>
            <Switch 
              id="dyslexic-font"
              checked={dyslexicFont} 
              onCheckedChange={toggleDyslexicFont} 
            />
          </DropdownMenuItem>

          <DropdownMenuItem className="flex items-center justify-between cursor-default focus:bg-transparent">
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              <Label htmlFor="high-contrast" className="text-sm font-medium">
                High Contrast
              </Label>
            </div>
            <Switch 
              id="high-contrast"
              checked={highContrast} 
              onCheckedChange={toggleHighContrast} 
            />
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem className="flex items-center justify-between cursor-default focus:bg-transparent">
            <Label className="text-sm font-medium">Theme</Label>
            <ThemeToggle />
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}