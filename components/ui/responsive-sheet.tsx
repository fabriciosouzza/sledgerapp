"use client";

// One API for short, contextual actions (DESIGN.md §11): a bottom sheet with a
// grab handle below `md`, a centred dialog at `md` and up. The pieces mirror
// the dialog's so a screen can swap one for the other without restructuring.

import { createContext, useContext } from "react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { useIsDesktop } from "@/lib/hooks/use-media-query";
import { cn } from "@/lib/utils";

const DesktopContext = createContext(false);

export function Sheet({ open, onOpenChange, children }: { open?: boolean; onOpenChange?: (open: boolean) => void; children: React.ReactNode }) {
  const desktop = useIsDesktop();
  return (
    <DesktopContext.Provider value={desktop}>
      {desktop ? (
        <Dialog open={open} onOpenChange={onOpenChange}>
          {children}
        </Dialog>
      ) : (
        <Drawer open={open} onOpenChange={onOpenChange} swipeDirection="down" showSwipeHandle>
          {children}
        </Drawer>
      )}
    </DesktopContext.Provider>
  );
}

type Renderable = React.ReactElement<Record<string, unknown>>;

export function SheetTrigger({ render, children }: { render: Renderable; children?: React.ReactNode }) {
  const desktop = useContext(DesktopContext);
  return desktop ? <DialogTrigger render={render}>{children}</DialogTrigger> : <DrawerTrigger render={render}>{children}</DrawerTrigger>;
}

export function SheetClose({ render, children }: { render: Renderable; children?: React.ReactNode }) {
  const desktop = useContext(DesktopContext);
  return desktop ? <DialogClose render={render}>{children}</DialogClose> : <DrawerClose render={render}>{children}</DrawerClose>;
}

export function SheetContent({ className, children }: { className?: string; children: React.ReactNode }) {
  const desktop = useContext(DesktopContext);
  if (desktop) return <DialogContent className={className}>{children}</DialogContent>;
  return <DrawerContent className={cn("pb-[env(safe-area-inset-bottom)]", className)}>{children}</DrawerContent>;
}

export function SheetHeader({ children }: { children: React.ReactNode }) {
  const desktop = useContext(DesktopContext);
  return desktop ? <DialogHeader>{children}</DialogHeader> : <DrawerHeader>{children}</DrawerHeader>;
}

export function SheetTitle({ children }: { children: React.ReactNode }) {
  const desktop = useContext(DesktopContext);
  return desktop ? <DialogTitle>{children}</DialogTitle> : <DrawerTitle>{children}</DrawerTitle>;
}

export function SheetDescription({ children }: { children: React.ReactNode }) {
  const desktop = useContext(DesktopContext);
  return desktop ? <DialogDescription>{children}</DialogDescription> : <DrawerDescription>{children}</DrawerDescription>;
}

/** The sheet's body: padded on mobile, plain inside the dialog. */
export function SheetBody({ className, children }: { className?: string; children: React.ReactNode }) {
  const desktop = useContext(DesktopContext);
  return <div className={cn(!desktop && "px-4", className)}>{children}</div>;
}

/** Actions: stacked full-width on mobile (primary first), a row on desktop. */
export function SheetFooter({ children }: { children: React.ReactNode }) {
  const desktop = useContext(DesktopContext);
  return desktop ? <DialogFooter>{children}</DialogFooter> : <DrawerFooter className="pt-4">{children}</DrawerFooter>;
}

export function useSheetIsDesktop(): boolean {
  return useContext(DesktopContext);
}
