// ImportWizard: Sheet-based wizard shell for future provider onboarding flows.
// Currently unused — Coinbase uses inline form via ProviderCard.
// Reserved for Phase 2+ providers that benefit from a stepped wizard UX.

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';

interface ImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}

export function ImportWizard({ open, onOpenChange, title, children }: ImportWizardProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-2xl bg-[#0F0F0F] border-white/[0.08] overflow-y-auto"
      >
        <SheetHeader className="mb-6">
          <SheetTitle className="text-content-primary font-heading">{title}</SheetTitle>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}
