import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Loader2, Search, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ImportLessonsDialog } from '@/components/admin/ImportLessonsDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useSentenceManagement, Sentence } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';

const CATEGORIES = ['greeting', 'daily', 'business', 'expression', 'question', 'vocab', 'slang'] as const;

interface ParsedSentence {
  vietnamese: string;
  english: string;
  category: string;
  difficulty: number;
}

export const LessonsTab = () => {
  const { sentences, isLoading, fetchSentences, addSentence, updateSentence, deleteSentence } = useSentenceManagement();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingSentence, setEditingSentence] = useState<Sentence | null>(null);
  const [deletingSentence, setDeletingSentence] = useState<Sentence | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  // Form state
  const [formVietnamese, setFormVietnamese] = useState('');
  const [formEnglish, setFormEnglish] = useState('');
  const [formCategory, setFormCategory] = useState<string>('vocab');
  const [formDifficulty, setFormDifficulty] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchSentences();
  }, [fetchSentences]);

  const resetForm = () => {
    setFormVietnamese('');
    setFormEnglish('');
    setFormCategory('vocab');
    setFormDifficulty(1);
  };

  const openEditDialog = (sentence: Sentence) => {
    setEditingSentence(sentence);
    setFormVietnamese(sentence.vietnamese);
    setFormEnglish(sentence.english);
    setFormCategory(sentence.category);
    setFormDifficulty(sentence.difficulty || 1);
  };

  const handleAddSentence = async () => {
    if (!formVietnamese.trim() || !formEnglish.trim()) {
      toast({ title: 'Missing fields', description: 'Please fill in both Vietnamese and English.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    const { error } = await addSentence({
      vietnamese: formVietnamese.trim(),
      english: formEnglish.trim(),
      category: formCategory,
      difficulty: formDifficulty,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Sentence added successfully.' });
      setIsAddDialogOpen(false);
      resetForm();
    }
    setIsSubmitting(false);
  };

  const handleUpdateSentence = async () => {
    if (!editingSentence) return;

    setIsSubmitting(true);
    const { error } = await updateSentence(editingSentence.id, {
      vietnamese: formVietnamese.trim(),
      english: formEnglish.trim(),
      category: formCategory,
      difficulty: formDifficulty,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Sentence updated successfully.' });
      setEditingSentence(null);
      resetForm();
    }
    setIsSubmitting(false);
  };

  const handleDeleteSentence = async () => {
    if (!deletingSentence) return;

    const { error } = await deleteSentence(deletingSentence.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Sentence deleted successfully.' });
    }
    setDeletingSentence(null);
  };

  const handleBulkImport = async (parsedSentences: ParsedSentence[]) => {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    const batchSize = 50;
    for (let i = 0; i < parsedSentences.length; i += batchSize) {
      const batch = parsedSentences.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('sentences')
        .insert(batch);

      if (error) {
        failed += batch.length;
        errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
      } else {
        success += batch.length;
      }
    }

    await fetchSentences();

    return { success, failed, errors };
  };

  const filteredSentences = sentences.filter(s => {
    const matchesSearch = searchQuery === '' ||
      s.vietnamese.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.english.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || s.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
          <Upload className="w-4 h-4 mr-2" />
          Import CSV
        </Button>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              Add Sentence
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Sentence</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="vietnamese">Vietnamese</Label>
                <Input
                  id="vietnamese"
                  value={formVietnamese}
                  onChange={(e) => setFormVietnamese(e.target.value)}
                  placeholder="Xin chào"
                />
              </div>
              <div>
                <Label htmlFor="english">English</Label>
                <Input
                  id="english"
                  value={formEnglish}
                  onChange={(e) => setFormEnglish(e.target.value)}
                  placeholder="Hello"
                />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Difficulty (1-5)</Label>
                <Select value={String(formDifficulty)} onValueChange={(v) => setFormDifficulty(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map(d => (
                      <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddSentence} disabled={isSubmitting} className="w-full">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Sentence'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search sentences..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(cat => (
              <SelectItem key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Sentences List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sentences ({filteredSentences.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredSentences.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No sentences found.</p>
          ) : (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {filteredSentences.map((sentence) => (
                <div
                  key={sentence.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{sentence.vietnamese}</p>
                    <p className="text-sm text-muted-foreground truncate">{sentence.english}</p>
                    <div className="flex gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {sentence.category}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Difficulty: {sentence.difficulty || 1}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(sentence)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeletingSentence(sentence)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingSentence} onOpenChange={(open) => !open && setEditingSentence(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Sentence</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="edit-vietnamese">Vietnamese</Label>
              <Input
                id="edit-vietnamese"
                value={formVietnamese}
                onChange={(e) => setFormVietnamese(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="edit-english">English</Label>
              <Input
                id="edit-english"
                value={formEnglish}
                onChange={(e) => setFormEnglish(e.target.value)}
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Difficulty (1-5)</Label>
              <Select value={String(formDifficulty)} onValueChange={(v) => setFormDifficulty(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map(d => (
                    <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleUpdateSentence} disabled={isSubmitting} className="w-full">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingSentence} onOpenChange={(open) => !open && setDeletingSentence(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sentence</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingSentence?.vietnamese}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSentence} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Dialog */}
      <ImportLessonsDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        onImport={handleBulkImport}
      />
    </div>
  );
};
