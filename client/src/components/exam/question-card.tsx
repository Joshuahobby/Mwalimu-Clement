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
    <Card>
      <CardHeader>
        <CardTitle>{question.question}</CardTitle>
      </CardHeader>
      <CardContent>
        <RadioGroup value={selectedValue} onValueChange={(value) => onAnswer(parseInt(value))}>
          {question.options.map((option, index) => (
            <div key={index} className="flex items-center space-x-2">
              <RadioGroupItem value={String(index)} id={`option-${index}`} />
              <Label htmlFor={`option-${index}`}>{option}</Label>
            </div>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}