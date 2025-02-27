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
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Accessibility Options</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            <Label>Read Aloud</Label>
          </div>
          <Switch checked={readAloud} onCheckedChange={toggleReadAloud} />
        </DropdownMenuItem>

        <DropdownMenuItem className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Type className="h-4 w-4" />
            <Label>Dyslexic Font</Label>
          </div>
          <Switch checked={dyslexicFont} onCheckedChange={toggleDyslexicFont} />
        </DropdownMenuItem>

        <DropdownMenuItem className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            <Label>High Contrast</Label>
          </div>
          <Switch checked={highContrast} onCheckedChange={toggleHighContrast} />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
