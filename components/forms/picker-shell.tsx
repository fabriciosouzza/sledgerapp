"use client";

// A trigger that opens a popover on desktop and a bottom sheet on mobile
// (DESIGN.md §10). Pickers render their body once; this decides the container.

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsDesktop } from "@/lib/hooks/use-media-query";

export function PickerShell({
  open,
  onOpenChange,
  trigger,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactElement<Record<string, unknown>>;
  title: string;
  children: React.ReactNode;
}) {
  const desktop = useIsDesktop();
  if (desktop) {
    return (
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger render={trigger} />
        <PopoverContent align="start" className="w-auto p-2">
          {children}
        </PopoverContent>
      </Popover>
    );
  }
  return (
    <Drawer open={open} onOpenChange={onOpenChange} swipeDirection="down" showSwipeHandle>
      <DrawerTrigger render={trigger} />
      <DrawerContent className="pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
        </DrawerHeader>
        <div className="flex justify-center px-4 pt-2">{children}</div>
      </DrawerContent>
    </Drawer>
  );
}
