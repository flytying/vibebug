import { useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface CopyButtonProps {
  getText: () => string;
  label?: string;
  className?: string;
}

export function CopyButton({ getText, label = 'Copy summary', className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(getText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: ignore clipboard errors silently
    }
  }, [getText]);

  return (
    <div className="relative group">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        className={cn('gap-1.5 no-print', className)}
        aria-label={label}
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-success" />
            <span className="text-success">Copied</span>
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            <span>Copy</span>
          </>
        )}
      </Button>
    </div>
  );
}
