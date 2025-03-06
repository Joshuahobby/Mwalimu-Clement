import React, { useState, useEffect, useRef } from 'react';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CircleOff, Clock } from 'lucide-react';

interface TimerProps {
  // Basic timer props
  initialTimeInMinutes?: number;
  // Advanced timer props
  startTime?: string;
  duration?: number; // in milliseconds
  onTimeUp?: () => void;
  isPaused?: boolean;
  className?: string;
  // Simulation props
  simulationId?: number;
  recoveryToken?: string;
  onRecoveryTokenUpdate?: (token: string) => void;
}

const TWENTY_MINUTES = 20 * 60 * 1000; // 20 minutes in milliseconds
const HEARTBEAT_INTERVAL = 30 * 1000; // Send heartbeat every 30 seconds

const Timer = ({
  initialTimeInMinutes,
  startTime,
  duration = TWENTY_MINUTES,
  onTimeUp,
  isPaused = false,
  className = '',
  simulationId,
  recoveryToken,
  onRecoveryTokenUpdate
}: TimerProps) => {
  // Calculate initial time based on props
  const initialTime = initialTimeInMinutes 
    ? initialTimeInMinutes * 60 * 1000 
    : startTime 
      ? Math.max(0, duration - (new Date().getTime() - new Date(startTime).getTime()))
      : duration;

  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [warningShown, setWarningShown] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const timerRef = useRef<NodeJS.Timeout>();
  const heartbeatRef = useRef<NodeJS.Timeout>();
  const { toast } = useToast();

  // Send heartbeat to server for simulation mode
  const sendHeartbeat = async () => {
    if (!simulationId) return;

    try {
      const response = await apiRequest("POST", `/api/simulations/${simulationId}/heartbeat`, {
        timeRemaining: timeLeft,
        recoveryToken,
      });

      if (!response.ok) throw new Error('Failed to update session heartbeat');

      const data = await response.json();
      if (onRecoveryTokenUpdate) {
        onRecoveryTokenUpdate(data.recoveryToken);
      }
    } catch (error) {
      console.error('Heartbeat error:', error);
      toast({
        title: "Warning",
        description: "Having trouble maintaining connection. Your progress is saved.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    // Clear any existing intervals
    if (timerRef.current) clearInterval(timerRef.current);
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);

    if (!isPaused && timeLeft > 0 && isActive) {
      // Set up timer interval
      timerRef.current = setInterval(() => {
        setTimeLeft((prevTime) => {
          const newTime = prevTime - 1000;

          // Show warning when 5 minutes remaining
          if (!warningShown && newTime <= 5 * 60 * 1000) {
            setWarningShown(true);
            toast({
              title: "Time Warning",
              description: "5 minutes remaining!",
              variant: "destructive",
            });
          }

          // Handle time up
          if (newTime <= 0) {
            if (onTimeUp) onTimeUp();
            if (timerRef.current) clearInterval(timerRef.current);
            if (heartbeatRef.current) clearInterval(heartbeatRef.current);
            setIsActive(false);
            return 0;
          }

          return newTime;
        });
      }, 1000);

      // Set up heartbeat interval if simulation mode
      if (simulationId) {
        sendHeartbeat(); // Initial heartbeat
        heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [onTimeUp, isPaused, timeLeft, warningShown, simulationId, isActive]);

  // Format time display
  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  // Calculate color based on time remaining
  const getTimerColor = () => {
    const percentage = timeLeft / initialTime * 100;
    if (percentage <= 20) return 'text-red-500';
    if (percentage <= 50) return 'text-amber-500';
    return 'text-green-500';
  };

  return (
    <div className={`flex items-center gap-2 font-mono ${className}`}>
      {isActive ? (
        <Clock className={`${getTimerColor()} ${timeLeft <= 60000 ? 'animate-pulse' : ''}`} size={20} />
      ) : (
        <CircleOff className="text-red-500" size={20} />
      )}
      <span className={`text-xl font-bold ${getTimerColor()}`}>
        {formattedTime}
      </span>
    </div>
  );
};

export default Timer;