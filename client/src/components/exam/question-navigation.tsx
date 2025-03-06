import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface QuestionNavigationProps {
  totalQuestions: number;
  currentQuestion: number;
  answers: number[];
  onQuestionSelect: (index: number) => void;
}

export default function QuestionNavigation({
  totalQuestions,
  currentQuestion,
  answers,
  onQuestionSelect,
}: QuestionNavigationProps) {
  const getQuestionStatus = (index: number) => {
    if (answers[index] === -1) return "Not answered";
    return "Question answered";
  };

  const getButtonVariant = (index: number) => {
    if (currentQuestion === index) return "default";
    if (answers[index] === -1) return "outline";
    return "secondary";
  };

  return (
    <TooltipProvider>
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: totalQuestions }).map((_, index) => (
          <Tooltip key={index}>
            <TooltipTrigger asChild>
              <Button
                variant={getButtonVariant(index)}
                className={cn(
                  "w-full h-10 p-0",
                  currentQuestion === index && "ring-2 ring-primary",
                  answers[index] !== -1 && "bg-primary/10 hover:bg-primary/20",
                )}
                onClick={() => onQuestionSelect(index)}
              >
                {index + 1}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Question {index + 1}: {getQuestionStatus(index)}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}