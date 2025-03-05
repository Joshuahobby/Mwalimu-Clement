import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";

interface TimerProps {
  startTime: Date;
  duration: number;
  onTimeUp: () => void;
}

export default function Timer({ startTime, duration, onTimeUp }: TimerProps) {
  const timerRef = useRef<NodeJS.Timeout>();

  const calculateTimeLeft = () => {
    const now = new Date().getTime();
    const start = new Date(startTime).getTime();
    const elapsed = now - start;
    return Math.max(0, duration - elapsed);
  };

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  useEffect(() => {
    // Clear any existing interval
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // Set up new interval
    timerRef.current = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);

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
  }, [startTime, duration]);

  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);

  return (
    <Card>
      <CardContent className="p-4 flex items-center space-x-2">
        <Clock className="h-5 w-5" />
        <span className="font-mono text-xl">
          {minutes.toString().padStart(2, "0")}:{seconds.toString().padStart(2, "0")}
        </span>
      </CardContent>
    </Card>
  );
}