import {
  Briefcase,
  Bus,
  Circle,
  Gamepad2,
  GraduationCap,
  HandHeart,
  HeartPulse,
  Home,
  Laptop,
  PartyPopper,
  Plus,
  Receipt,
  ShoppingBag,
  ShoppingBasket,
  Store,
  type LucideIcon,
} from 'lucide-react';

const MAP: Record<string, LucideIcon> = {
  home: Home,
  'shopping-basket': ShoppingBasket,
  bus: Bus,
  'heart-pulse': HeartPulse,
  receipt: Receipt,
  'graduation-cap': GraduationCap,
  'party-popper': PartyPopper,
  'gamepad-2': Gamepad2,
  'shopping-bag': ShoppingBag,
  briefcase: Briefcase,
  store: Store,
  laptop: Laptop,
  'hand-heart': HandHeart,
  plus: Plus,
};

const BY_NAME: Record<string, LucideIcon> = {
  Loyer: Home,
  Nourriture: ShoppingBasket,
  Transport: Bus,
  Santé: HeartPulse,
  Factures: Receipt,
  Scolarité: GraduationCap,
  Sorties: PartyPopper,
  Loisirs: Gamepad2,
  Shopping: ShoppingBag,
  Salaire: Briefcase,
  Business: Store,
  Freelance: Laptop,
  'Aide familiale': HandHeart,
  'Autre revenu': Plus,
};

export const categoryIcon = (key: string | null | undefined, name?: string): LucideIcon => {
  if (key && MAP[key]) return MAP[key];
  if (name && BY_NAME[name]) return BY_NAME[name];
  return Circle;
};
