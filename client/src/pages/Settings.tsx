import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Upload, Trash2, Users, FileSpreadsheet } from "lucide-react";

export default function Settings() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: countData, isLoading: countLoading } = useQuery<{ count: number }>({
    queryKey: ['/api/attendees/count'],
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('DELETE', '/api/attendees');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/attendees/count'] });
      toast({ title: "List cleared", description: "All attendees have been removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to clear attendee list.", variant: "destructive" });
    },
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/attendees/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Upload failed');
      }

      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ['/api/attendees/count'] });
      toast({ title: "Upload successful", description: result.message });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between bg-gradient-to-r from-primary/10 via-accent/50 to-transparent p-8 rounded-3xl border border-primary/10">
        <div>
          <Badge className="mb-4 bg-primary/15 text-primary hover:bg-primary/20 transition-colors border-0">
            <SettingsIcon className="w-3 h-3 mr-1" />
            Configuration
          </Badge>
          <h1 className="text-4xl font-display font-bold text-foreground tracking-tight">
            Settings
          </h1>
          <p className="text-muted-foreground mt-2 text-lg max-w-2xl">
            Manage your conference attendee list for name autocomplete.
          </p>
        </div>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Attendee List
          </CardTitle>
          <CardDescription>
            Upload a CSV file with attendee information (Name, Email, Company columns). Uploading a new file replaces the existing list.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4 p-4 bg-secondary/50 rounded-xl border border-border">
            <div className="bg-primary/10 p-3 rounded-xl">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current attendees loaded</p>
              <p className="text-2xl font-bold text-foreground" data-testid="text-attendee-count">
                {countLoading ? "..." : (countData?.count ?? 0)}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleUpload}
              className="hidden"
              data-testid="input-csv-upload"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex-1 h-12"
              data-testid="button-upload-csv"
            >
              {uploading ? (
                "Uploading..."
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload CSV
                </>
              )}
            </Button>
            <Button
              variant="destructive"
              onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending || (countData?.count === 0)}
              className="h-12"
              data-testid="button-clear-attendees"
            >
              {clearMutation.isPending ? (
                "Clearing..."
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear List
                </>
              )}
            </Button>
          </div>

          <div className="p-4 bg-secondary/30 rounded-xl border border-border">
            <div className="flex items-start gap-2">
              <FileSpreadsheet className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">CSV Format</p>
                <p>Your CSV should include columns for <strong>Name</strong>, <strong>Email</strong>, and <strong>Company</strong>. Title and Country columns will be ignored. The first row with Name and Email headers is auto-detected.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}