
import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, Trophy, XCircle } from "lucide-react";
import { jsPDF } from "jspdf";

const ExamResultsPage = () => {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [pdfGenerating, setPdfGenerating] = useState(false);

  const { data: exam, isLoading } = useQuery({
    queryKey: ["/api/exams", id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/exams/${id}`);
      if (!res.ok) {
        throw new Error("Failed to fetch exam data");
      }
      return res.json();
    },
    enabled: !!id && !!user,
  });

  useEffect(() => {
    if (!user) {
      setLocation("/login");
    }
  }, [user, setLocation]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <h2 className="text-xl font-bold">Exam not found</h2>
              <p className="mt-2">The exam you're looking for doesn't exist or you don't have permission to view it.</p>
              <Button className="mt-4" onClick={() => setLocation("/")}>
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const correctAnswers = exam.score ? Math.round((exam.score / 100) * 20) : 0;
  const passed = exam.score >= 70; // 70% is 14/20
  const examDate = new Date(exam.endTime || exam.startTime);

  const generatePDF = async () => {
    try {
      setPdfGenerating(true);
      
      // Create new PDF document
      const doc = new jsPDF();
      
      // Add header
      doc.setFontSize(20);
      doc.setTextColor(0, 0, 0);
      doc.text("DRIVING THEORY EXAM RESULTS", 105, 20, { align: "center" });

      // Add logo or image
      // If you have a logo, you can add it like this:
      // doc.addImage("logo-url", "PNG", 10, 10, 30, 30);

      // Add user info
      doc.setFontSize(12);
      doc.text(`Candidate: ${user?.displayName || user?.username}`, 20, 40);
      doc.text(`Exam Date: ${examDate.toLocaleDateString()}`, 20, 50);
      doc.text(`Exam ID: ${exam.id}`, 20, 60);

      // Add results
      doc.setFontSize(14);
      doc.text("EXAM RESULTS", 105, 80, { align: "center" });
      
      doc.setFontSize(12);
      doc.text(`Score: ${exam.score}%`, 20, 90);
      doc.text(`Correct Answers: ${correctAnswers}/20`, 20, 100);
      
      // Add pass/fail status with color
      if (passed) {
        doc.setTextColor(0, 128, 0); // Green
        doc.text("Status: PASSED", 20, 110);
      } else {
        doc.setTextColor(255, 0, 0); // Red
        doc.text("Status: FAILED", 20, 110);
        doc.text("Required to pass: 12/20 correct answers", 20, 120);
      }
      
      // Reset text color
      doc.setTextColor(0, 0, 0);
      
      // Add certification section if passed
      if (passed) {
        doc.setFontSize(14);
        doc.text("CERTIFICATION", 105, 140, { align: "center" });
        
        doc.setFontSize(12);
        doc.text("This document certifies that the candidate has successfully", 105, 150, { align: "center" });
        doc.text("passed the Driving Theory Examination.", 105, 160, { align: "center" });
      }
      
      // Add footer
      doc.setFontSize(10);
      doc.text("This is an official document from the Driving Theory Test System.", 105, 270, { align: "center" });
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 105, 280, { align: "center" });
      
      // Save the PDF
      doc.save(`driving-exam-results-${exam.id}.pdf`);
      
      toast({
        title: "PDF Generated",
        description: "Your results have been downloaded as a PDF.",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Error",
        description: "Failed to generate PDF results.",
        variant: "destructive",
      });
    } finally {
      setPdfGenerating(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <Card className="max-w-3xl mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Exam Results</CardTitle>
          <CardDescription>Your driving theory test results</CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="flex flex-col items-center mb-8">
            {passed ? (
              <div className="flex flex-col items-center text-center">
                <Trophy size={80} className="text-green-500 mb-4" />
                <h2 className="text-2xl font-bold text-green-600">Congratulations! You Passed</h2>
                <p className="text-gray-600 mt-2">You've successfully passed the driving theory exam.</p>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center">
                <XCircle size={80} className="text-red-500 mb-4" />
                <h2 className="text-2xl font-bold text-red-600">Exam Not Passed</h2>
                <p className="text-gray-600 mt-2">You need at least 12 correct answers to pass.</p>
              </div>
            )}
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <h3 className="font-medium mb-2">Score</h3>
              <p className="text-3xl font-bold">{exam.score}%</p>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <h3 className="font-medium mb-2">Correct Answers</h3>
              <p className="text-3xl font-bold">{correctAnswers}/20</p>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <h3 className="font-medium mb-2">Status</h3>
              <p className={`text-lg font-bold ${passed ? 'text-green-600' : 'text-red-600'}`}>
                {passed ? 'PASSED' : 'FAILED'}
              </p>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <h3 className="font-medium mb-2">Date</h3>
              <p className="text-lg">{examDate.toLocaleDateString()}</p>
            </div>
          </div>
          
          <div className="mt-8 flex justify-center space-x-4">
            <Button 
              variant="default" 
              size="lg"
              onClick={() => {
                setPdfGenerating(true);
                try {
                  const doc = generateResultPDF(exam, correctAnswers, passed, examDate);
                  doc.save(`driving-theory-results-${examDate.toISOString().split('T')[0]}.pdf`);
                } catch (error) {
                  console.error('Error generating PDF:', error);
                  toast({
                    title: "Error",
                    description: "Failed to generate PDF. Please try again.",
                    variant: "destructive",
                  });
                } finally {
                  setPdfGenerating(false);
                }
              }}
              disabled={pdfGenerating}
              className="flex items-center"
            >
              <Download className="mr-2 h-4 w-4" />
              {pdfGenerating ? "Generating PDF..." : "Download Results PDF"}
            </Button>
            
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => setLocation("/")}
            >
              Return to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

import { jsPDF } from 'jspdf';

// Helper function to generate PDF
const generateResultPDF = (exam: any, correctAnswers: number, passed: boolean, examDate: Date) => {
  const doc = new jsPDF();
  
  // Add header
  doc.setFontSize(22);
  doc.setTextColor(0, 0, 255);
  doc.text("DRIVING THEORY TEST RESULTS", 105, 20, { align: 'center' });
  
  // Add logo or image if needed
  // doc.addImage(logoBase64, 'PNG', 10, 10, 30, 30);
  
  // Add status
  doc.setFontSize(16);
  doc.setTextColor(passed ? [0, 128, 0] : [255, 0, 0]);
  doc.text(passed ? "PASSED" : "FAILED", 105, 40, { align: 'center' });
  
  // Add info table
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  
  const startY = 60;
  const lineHeight = 10;
  
  doc.text("Exam Results Summary", 20, startY);
  doc.line(20, startY + 2, 190, startY + 2);
  
  doc.text(`Date: ${examDate.toLocaleDateString()}`, 20, startY + lineHeight * 2);
  doc.text(`Score: ${exam.score}%`, 20, startY + lineHeight * 3);
  doc.text(`Correct Answers: ${correctAnswers}/20`, 20, startY + lineHeight * 4);
  doc.text(`Status: ${passed ? "PASSED" : "FAILED"}`, 20, startY + lineHeight * 5);
  
  if (passed) {
    doc.text("Congratulations! You have successfully passed the driving theory exam.", 20, startY + lineHeight * 7);
    doc.text("You may proceed to the next step in your driving license process.", 20, startY + lineHeight * 8);
  } else {
    doc.text("You did not pass the driving theory exam this time.", 20, startY + lineHeight * 7);
    doc.text("You need at least 12 correct answers to pass. Please try again.", 20, startY + lineHeight * 8);
  }
  
  // Add footer
  doc.setFontSize(10);
  doc.text("This is an official result slip from the Driving Theory Test System", 105, 280, { align: 'center' });
  
  return doc;
};

export default ExamResultsPage;
