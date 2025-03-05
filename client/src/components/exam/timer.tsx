import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";

interface TimerProps {
  startTime: Date;
  duration: number;
  onTimeUp: () => void;
}

export default function Timer({ startTime, duration, onTimeUp }: TimerProps) {
  const calculateTimeLeft = () => {
    const now = new Date().getTime();
    const start = new Date(startTime).getTime();
    return Math.max(0, duration - (now - start));
  };

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);

      if (remaining === 0) {
        clearInterval(timer);
        onTimeUp();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [startTime, duration, onTimeUp]);

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