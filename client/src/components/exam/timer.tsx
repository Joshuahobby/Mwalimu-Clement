import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TimerProps {
  startTime: Date;
  duration: number;
  onTimeUp: () => void;
}

export default function Timer({ startTime, duration, onTimeUp }: TimerProps) {
  const timerRef = useRef<NodeJS.Timeout>();
  const [timeLeft, setTimeLeft] = useState(duration);
  const [warningShown, setWarningShown] = useState(false);

  const calculateTimeLeft = () => {
    const now = new Date().getTime();
    const start = startTime.getTime();
    const elapsed = now - start;
    return Math.max(0, duration - elapsed);
  };

  useEffect(() => {
    // Initial calculation
    setTimeLeft(calculateTimeLeft());

    // Clear any existing interval
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // Set up new interval
    timerRef.current = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);

      // Show warning when 5 minutes remaining
      if (remaining <= 300000 && !warningShown) {
        setWarningShown(true);
      }

      if (remaining <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        onTimeUp();
      }
    }, 1000);

    // Cleanup function
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [startTime, duration]); // Only re-run if startTime or duration changes

  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);

  // If less than 5 minutes remaining, show warning
  if (timeLeft <= 300000) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Time remaining: {minutes}:{seconds.toString().padStart(2, "0")}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 flex items-center space-x-2">
        <Clock className="h-5 w-5" />
        <span className="font-mono text-xl font-bold">
          {minutes}:{seconds.toString().padStart(2, "0")}
        </span>
      </CardContent>
    </Card>
  );
}