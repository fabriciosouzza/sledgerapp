import {
  Baby,
  Briefcase,
  Car,
  CreditCard,
  Dog,
  Dumbbell,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  MoreHorizontal,
  PiggyBank,
  Plane,
  ShoppingBag,
  Tv,
  Utensils,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** The icons a category may pick; stored by name in `categories.icon`. */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  home: Home,
  utensils: Utensils,
  car: Car,
  "heart-pulse": HeartPulse,
  "graduation-cap": GraduationCap,
  tv: Tv,
  gift: Gift,
  plane: Plane,
  "shopping-bag": ShoppingBag,
  dumbbell: Dumbbell,
  dog: Dog,
  baby: Baby,
  "credit-card": CreditCard,
  landmark: Landmark,
  briefcase: Briefcase,
  wallet: Wallet,
  "piggy-bank": PiggyBank,
  more: MoreHorizontal,
};

/** Preset colours; stored as-is in `categories.color`. */
export const CATEGORY_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899"];

export function CategoryIcon({
  icon,
  color,
  className,
  size = "md",
}: {
  icon: string | null;
  color: string | null;
  className?: string;
  size?: "sm" | "md";
}) {
  const Icon = (icon && CATEGORY_ICONS[icon]) || MoreHorizontal;
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center rounded-full", size === "sm" ? "size-7" : "size-9", className)}
      style={{ background: color ? `color-mix(in oklab, ${color} 18%, transparent)` : "var(--muted)", color: color ?? "var(--muted-foreground)" }}
      aria-hidden
    >
      <Icon className={size === "sm" ? "size-3.5" : "size-4"} />
    </span>
  );
}
