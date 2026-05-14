"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function AssetNoteDialog({
  selectedNote,
  onOpenChange,
}: {
  selectedNote: { title: string; note: string } | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog
      open={Boolean(selectedNote)}
      onOpenChange={(open) => {
        onOpenChange(open);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{selectedNote?.title ?? "Note"}</DialogTitle>
          <DialogDescription>Asset note details</DialogDescription>
        </DialogHeader>
        <div className="whitespace-pre-wrap text-sm leading-7 text-(--text-secondary)">
          {selectedNote?.note ?? ""}
        </div>
      </DialogContent>
    </Dialog>
  );
}
