import { Question } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

interface QuestionCardProps {
  question: Question;
  currentIndex?: number;
  totalQuestions?: number;
  selectedAnswer: number | null;
  onAnswer: (value: number) => void;
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
  onAnswer,
  showFeedback = false,
  isReviewMode = false,
  correctAnswer,
  className = '',
}: QuestionCardProps) {
  // Default to '-1' if selectedAnswer is null or undefined
  const selectedValue = selectedAnswer?.toString() ?? '-1';

  return (
    <Card className={cn('w-full transition-all duration-300', className)}>
      {(currentIndex !== undefined && totalQuestions) && (
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
      )}
      <CardContent>
        <div className="text-xl font-semibold leading-7 text-foreground mb-6">
          {!currentIndex && question.question}
        </div>
        <RadioGroup
          value={selectedValue}
          onValueChange={(value) => onAnswer(parseInt(value))}
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
                  id={`option-${currentIndex ?? ''}-${i}`}
                  className={cn(
                    isCorrect && showFeedback && 'text-green-500 border-green-500',
                    isIncorrect && 'text-red-500 border-red-500'
                  )}
                />
                <Label
                  htmlFor={`option-${currentIndex ?? ''}-${i}`}
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

export default QuestionCard;