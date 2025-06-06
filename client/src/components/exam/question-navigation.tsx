import React from 'react';
import { Button } from '../ui/button';
import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';

interface QuestionNavigationProps {
  totalQuestions: number;
  currentQuestion: number;
  answers: number[];
  onQuestionSelect: (index: number) => void;
  className?: string;
}

export function QuestionNavigation({
  totalQuestions,
  currentQuestion,
  answers,
  onQuestionSelect,
  className = '',
}: QuestionNavigationProps) {
  return (
    <div className={cn('p-4 bg-card rounded-lg shadow-sm', className)}>
      <h3 className="text-sm font-medium mb-3">Question Navigation</h3>
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: totalQuestions }).map((_, index) => {
          const isAnswered = answers[index] !== -1;
          const isCurrent = index === currentQuestion;

          return (
            <Button
              key={index}
              variant={isCurrent ? "default" : isAnswered ? "outline" : "ghost"}
              size="sm"
              className={cn(
                'aspect-square flex items-center justify-center p-1 h-9 w-9 relative',
                isCurrent && 'ring-2 ring-primary ring-offset-1'
              )}
              onClick={() => onQuestionSelect(index)}
            >
              <span className="text-xs">{index + 1}</span>
              {isAnswered && !isCurrent && (
                <div className="absolute -top-1 -right-1 bg-green-500 rounded-full w-4 h-4 flex items-center justify-center">
                  <Check className="text-white w-3 h-3" />
                </div>
              )}
              {!isAnswered && !isCurrent && (
                <div className="absolute -top-1 -right-1 bg-orange-400 rounded-full w-4 h-4 flex items-center justify-center">
                  <span className="text-white text-[8px]">?</span>
                </div>
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
}