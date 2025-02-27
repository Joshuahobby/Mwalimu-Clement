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
  return (
    <Card>
      <CardHeader>
        <CardTitle>{question.question}</CardTitle>
      </CardHeader>
      <CardContent>
        <RadioGroup value={selectedAnswer.toString()} onValueChange={(value) => onAnswer(parseInt(value))}>
          {question.options.map((option, index) => (
            <div key={index} className="flex items-center space-x-2">
              <RadioGroupItem value={index.toString()} id={`option-${index}`} />
              <Label htmlFor={`option-${index}`}>{option}</Label>
            </div>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
