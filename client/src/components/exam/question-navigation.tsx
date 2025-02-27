import { Button } from "@/components/ui/button";

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
  return (
    <div className="grid grid-cols-5 gap-2">
      {Array.from({ length: totalQuestions }).map((_, index) => (
        <Button
          key={index}
          variant={answers[index] === -1 ? "outline" : "default"}
          className={currentQuestion === index ? "ring-2 ring-primary" : ""}
          onClick={() => onQuestionSelect(index)}
        >
          {index + 1}
        </Button>
      ))}
    </div>
  );
}
