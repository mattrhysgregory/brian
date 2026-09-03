import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogClose = DialogPrimitive.Close;
const DialogTitle = DialogPrimitive.Title;
const DialogDescription = DialogPrimitive.Description;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/25" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/3 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/3 rounded-lg border border-border bg-panel p-4 shadow-xl outline-none",
        className,
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

export { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle };
