import { useState } from 'react';
import { AlertTriangle, Flag, UserX } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'user' | 'post';
  targetName: string;
  onReport: (reason: string, details: string) => void;
  onBlock?: () => void;
}

export function ReportDialog({
  open,
  onOpenChange,
  type,
  targetName,
  onReport,
  onBlock,
}: ReportDialogProps) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');

  const reportReasons =
    type === 'user'
      ? [
          'Harassment or bullying',
          'Spam or scam',
          'Inappropriate content',
          'Fake profile',
          'Other',
        ]
      : [
          'Harassment or hate speech',
          'Spam or misleading',
          'Inappropriate content',
          'False information',
          'Other',
        ];

  const handleSubmit = () => {
    if (!reason) {
      toast.error('Please select a reason');
      return;
    }
    onReport(reason, details);
    toast.success('Report submitted. Our team will review it shortly.');
    setReason('');
    setDetails('');
    onOpenChange(false);
  };

  const handleBlock = () => {
    if (onBlock) {
      onBlock();
      toast.success(`${targetName} has been blocked`);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="w-5 h-5" />
            Report {type === 'user' ? 'User' : 'Post'}
          </DialogTitle>
          <DialogDescription>
            Help us understand what's wrong with {type === 'user' ? 'this user' : 'this post'}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Reason Selection */}
          <div>
            <Label>Why are you reporting {targetName}?</Label>
            <RadioGroup value={reason} onValueChange={setReason} className="mt-3 space-y-2">
              {reportReasons.map((r) => (
                <div key={r} className="flex items-center space-x-2">
                  <RadioGroupItem value={r} id={r} />
                  <Label htmlFor={r} className="cursor-pointer">
                    {r}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Additional Details */}
          <div>
            <Label htmlFor="details">Additional details (optional)</Label>
            <Textarea
              id="details"
              placeholder="Provide more information about your report..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
              className="mt-2"
            />
          </div>

          {/* Block Option for Users */}
          {type === 'user' && onBlock && (
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-start gap-3">
                <UserX className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p>Block this user</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    They won't be able to see your profile or contact you
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={handleBlock}
                  >
                    Block {targetName}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
            <p className="text-sm text-amber-900 dark:text-amber-100">
              False reports may result in action against your account. Please report
              responsibly.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!reason}>
            Submit Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
