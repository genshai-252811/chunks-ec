import { useState, useRef } from 'react';
import { Upload, FileText, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

interface ParsedSentence {
  vietnamese: string;
  english: string;
  category: string;
  difficulty: number;
}

interface ImportLessonsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (sentences: ParsedSentence[]) => Promise<ImportResult>;
}

const VALID_CATEGORIES = ['greeting', 'daily', 'business', 'expression', 'question', 'vocab', 'slang'];

export function ImportLessonsDialog({ open, onOpenChange, onImport }: ImportLessonsDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedSentence[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [progress, setProgress] = useState(0);

  const resetState = () => {
    setFile(null);
    setParsedData([]);
    setParseErrors([]);
    setImportResult(null);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setImportResult(null);
    setParseErrors([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseCSV(text);
    };
    reader.readAsText(selectedFile);
  };

  const parseCSV = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    const sentences: ParsedSentence[] = [];
    const errors: string[] = [];

    // Check for header row
    const firstLine = lines[0]?.toLowerCase() || '';
    const hasHeader = firstLine.includes('vietnamese') || firstLine.includes('english');
    const dataLines = hasHeader ? lines.slice(1) : lines;

    dataLines.forEach((line, index) => {
      const lineNum = hasHeader ? index + 2 : index + 1;
      
      // Handle quoted CSV values
      const values = parseCSVLine(line);
      
      if (values.length < 2) {
        errors.push(`Line ${lineNum}: Missing required fields (vietnamese, english)`);
        return;
      }

      const vietnamese = values[0]?.trim();
      const english = values[1]?.trim();
      const category = values[2]?.trim()?.toLowerCase() || 'vocab';
      const difficultyStr = values[3]?.trim();
      const difficulty = difficultyStr ? parseInt(difficultyStr, 10) : 1;

      if (!vietnamese || !english) {
        errors.push(`Line ${lineNum}: Vietnamese and English are required`);
        return;
      }

      if (!VALID_CATEGORIES.includes(category)) {
        errors.push(`Line ${lineNum}: Invalid category "${category}". Using "vocab".`);
      }

      if (isNaN(difficulty) || difficulty < 1 || difficulty > 5) {
        errors.push(`Line ${lineNum}: Invalid difficulty. Using 1.`);
      }

      sentences.push({
        vietnamese,
        english,
        category: VALID_CATEGORIES.includes(category) ? category : 'vocab',
        difficulty: isNaN(difficulty) || difficulty < 1 || difficulty > 5 ? 1 : difficulty,
      });
    });

    setParsedData(sentences);
    setParseErrors(errors);
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);

    return result;
  };

  const handleImport = async () => {
    if (parsedData.length === 0) return;

    setIsImporting(true);
    setProgress(0);

    try {
      const result = await onImport(parsedData);
      setImportResult(result);
      setProgress(100);
    } catch (error) {
      setImportResult({
        success: 0,
        failed: parsedData.length,
        errors: ['Import failed. Please try again.'],
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Lessons</DialogTitle>
          <DialogDescription>
            Upload a CSV file with columns: vietnamese, english, category (optional), difficulty (optional)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* File Upload */}
          <div
            className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileSelect}
              className="hidden"
            />
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <span className="font-medium">{file.name}</span>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-muted-foreground">
                  CSV or TXT file
                </p>
              </div>
            )}
          </div>

          {/* Parse Results */}
          {file && parsedData.length > 0 && (
            <Alert>
              <CheckCircle2 className="w-4 h-4" />
              <AlertDescription>
                Found {parsedData.length} valid sentence{parsedData.length !== 1 ? 's' : ''} to import
              </AlertDescription>
            </Alert>
          )}

          {/* Parse Errors */}
          {parseErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">Warnings ({parseErrors.length}):</p>
                  <ul className="text-xs max-h-24 overflow-y-auto space-y-0.5">
                    {parseErrors.slice(0, 5).map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                    {parseErrors.length > 5 && (
                      <li>...and {parseErrors.length - 5} more</li>
                    )}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Import Progress */}
          {isImporting && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-center text-muted-foreground">Importing...</p>
            </div>
          )}

          {/* Import Result */}
          {importResult && (
            <Alert variant={importResult.failed > 0 ? 'destructive' : 'default'}>
              <CheckCircle2 className="w-4 h-4" />
              <AlertDescription>
                Successfully imported {importResult.success} sentence{importResult.success !== 1 ? 's' : ''}.
                {importResult.failed > 0 && ` ${importResult.failed} failed.`}
              </AlertDescription>
            </Alert>
          )}

          {/* Example Format */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs font-medium mb-2">Example CSV format:</p>
            <code className="text-xs text-muted-foreground block whitespace-pre">
{`vietnamese,english,category,difficulty
Xin chào,Hello,greeting,1
Cảm ơn,Thank you,daily,1`}
            </code>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              {importResult?.success ? 'Done' : 'Cancel'}
            </Button>
            <Button
              onClick={handleImport}
              disabled={parsedData.length === 0 || isImporting || !!importResult?.success}
              className="flex-1"
            >
              {isImporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                `Import ${parsedData.length} Sentence${parsedData.length !== 1 ? 's' : ''}`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
