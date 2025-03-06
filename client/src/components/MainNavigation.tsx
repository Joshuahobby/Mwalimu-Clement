import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth.tsx";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Book, Trophy, ChevronDown, LogIn } from "lucide-react";

export function MainNavigation() {
  const { user } = useAuth();

  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <Link href="/">
                <a className="flex items-center space-x-2 font-bold">
                  <Book className="h-6 w-6" />
                  <span>MWALIMU Clement</span>
                </a>
              </Link>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuTrigger>Features</NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid gap-3 p-6 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
                  <li className="row-span-3">
                    <NavigationMenuLink asChild>
                      <a
                        className="flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b from-muted/50 to-muted p-6 no-underline outline-none focus:shadow-md"
                        href="/"
                      >
                        <Trophy className="h-6 w-6" />
                        <div className="mb-2 mt-4 text-lg font-medium">
                          Practice Tests
                        </div>
                        <p className="text-sm leading-tight text-muted-foreground">
                          Take real RNP-style theory tests with instant feedback
                        </p>
                      </a>
                    </NavigationMenuLink>
                  </li>
                  <li>
                    <NavigationMenuLink asChild>
                      <a
                        className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                        href="/progress"
                      >
                        <div className="text-sm font-medium leading-none">Progress Tracking</div>
                        <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                          Monitor your learning progress and identify areas for improvement
                        </p>
                      </a>
                    </NavigationMenuLink>
                  </li>
                  <li>
                    <NavigationMenuLink asChild>
                      <a
                        className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                        href="/exam-simulation"
                      >
                        <div className="text-sm font-medium leading-none">Exam Simulation</div>
                        <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                          Experience the real exam environment with timed tests
                        </p>
                      </a>
                    </NavigationMenuLink>
                  </li>
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <Link href="/pricing">
                <a className={navigationMenuTriggerStyle()}>Pricing</a>
              </Link>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <Link href="/about">
                <a className={navigationMenuTriggerStyle()}>About</a>
              </Link>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

        <div className="flex flex-1 items-center justify-end space-x-4">
          {!user ? (
            <Button variant="default" size="sm" asChild>
              <Link href="/auth">
                <a className="flex items-center">
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign In
                </a>
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard">
                <a>Dashboard</a>
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
