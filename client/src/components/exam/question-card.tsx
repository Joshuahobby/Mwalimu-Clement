import { Question } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface QuestionCardProps {
  question: Question;
  selectedAnswer: number;
  onAnswer: (index: number) => void;
}

export default function QuestionCard({ question, selectedAnswer, onAnswer }: QuestionCardProps) {
  // Convert selectedAnswer to string safely, defaulting to '-1' if undefined
  const selectedValue = String(selectedAnswer ?? -1);

  return (
    <div className="space-y-4">
      <div className="text-xl font-semibold leading-7 text-foreground mb-6">
        {question.question}
      </div>
      <RadioGroup 
        value={selectedValue} 
        onValueChange={(value) => onAnswer(parseInt(value))}
        className="space-y-3"
      >
        {question.options.map((option, index) => (
          <div
            key={index}
            className={`flex items-center space-x-3 rounded-lg border p-4 transition-all duration-200 hover:bg-accent hover:text-accent-foreground
              ${selectedValue === String(index) ? 'bg-primary/5 border-primary' : 'border-input'}`}
          >
            <RadioGroupItem 
              value={String(index)} 
              id={`option-${index}`}
              className="data-[state=checked]:border-primary data-[state=checked]:text-primary"
            />
            <Label 
              htmlFor={`option-${index}`}
              className="flex-grow cursor-pointer text-base"
            >
              {option}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';
import { cn } from '../../lib/utils';
import { Question } from '../../types';
import { AlertCircle } from 'lucide-react';

interface QuestionCardProps {
  question: Question;
  currentIndex: number;
  totalQuestions: number;
  selectedAnswer: number;
  onAnswerSelect: (value: number) => void;
  showFeedback?: boolean;
  isReviewMode?: boolean;
  correctAnswer?: number;
  className?: string;
}

export function QuestionCard({
  question,
  currentIndex,
  totalQuestions,
  selectedAnswer,
  onAnswerSelect,
  showFeedback = false,
  isReviewMode = false,
  correctAnswer,
  className = '',
}: QuestionCardProps) {
  return (
    <Card className={cn('w-full transition-all duration-300', className)}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <span className="text-sm text-muted-foreground">
              Question {currentIndex + 1} of {totalQuestions}
            </span>
            <span className="ml-2 text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
              {question.category}
            </span>
          </div>
        </div>
        <CardTitle className="text-xl">{question.question}</CardTitle>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={selectedAnswer.toString()}
          onValueChange={(value) => onAnswerSelect(parseInt(value))}
          className="space-y-3"
          disabled={isReviewMode}
        >
          {question.options.map((option, i) => {
            const isSelected = selectedAnswer === i;
            const isCorrect = correctAnswer !== undefined && i === correctAnswer;
            const isIncorrect = showFeedback && isSelected && correctAnswer !== undefined && i !== correctAnswer;
            
            return (
              <div
                key={i}
                className={cn(
                  'flex items-center space-x-2 rounded-md border p-3 transition-all',
                  isSelected && !isIncorrect && 'border-primary bg-primary/5',
                  isCorrect && showFeedback && 'border-green-500 bg-green-50',
                  isIncorrect && 'border-red-500 bg-red-50'
                )}
              >
                <RadioGroupItem
                  value={i.toString()}
                  id={`option-${currentIndex}-${i}`}
                  className={cn(
                    isCorrect && showFeedback && 'text-green-500 border-green-500',
                    isIncorrect && 'text-red-500 border-red-500'
                  )}
                />
                <Label
                  htmlFor={`option-${currentIndex}-${i}`}
                  className={cn(
                    'cursor-pointer flex-grow',
                    isCorrect && showFeedback && 'text-green-700 font-medium',
                    isIncorrect && 'text-red-700'
                  )}
                >
                  {option}
                </Label>
                
                {showFeedback && isIncorrect && (
                  <AlertCircle className="text-red-500 h-5 w-5" />
                )}
              </div>
            );
          })}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
