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