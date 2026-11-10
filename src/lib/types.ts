export type TxType = 'income' | 'expense';
export type NeedKind = 'need' | 'want';
export type Pocket = 'subsistence' | 'assets' | 'protection';
export type Recurrence = 'none' | 'weekly' | 'monthly';
export type TipCategory = 'Épargner' | 'Investir' | 'Protéger' | 'Mentalité';
export type TipLevel = 'Débutant' | 'Intermédiaire' | 'Avancé';

export interface Profile {
  id: string;
  first_name: string | null;
  currency: string;
  locale: string;
  life_goal: string | null;
  avg_income: number;
  avg_needs: number;
  savings_rate_goal: number;
  emergency_months: number;
  onboarded: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  user_id: string | null;
  name: string;
  type: TxType;
  kind: NeedKind | null;
  icon: string | null;
  is_default: boolean;
}

export interface Transaction {
  id: string;
  user_id: string;
  category_id: string | null;
  type: TxType;
  amount: number;
  occurred_on: string;
  note: string | null;
  recurrence: Recurrence;
  parent_tx_id: string | null;
  created_at: string;
}

export interface Allocation {
  user_id: string;
  pct_subsistence: number;
  pct_assets: number;
  pct_protection: number;
  updated_at: string;
}

export interface EmergencyFund {
  user_id: string;
  amount_saved: number;
  updated_at: string;
}

export interface ProtectionItem {
  id: string;
  user_id: string;
  item_key: string;
  done: boolean;
}

export interface Asset {
  id: string;
  user_id: string;
  name: string;
  asset_type: string;
  value: number;
  monthly_income: number;
  acquired_on: string | null;
  created_at: string;
}

export interface Simulation {
  id: string;
  user_id: string;
  label: string | null;
  monthly_needs: number;
  monthly_contribution: number;
  annual_return: number;
  horizon_years: number;
  start_capital: number;
  created_at: string;
}

export interface Tip {
  id: string;
  category: TipCategory;
  level: TipLevel;
  title: string;
  body: string;
  locale: string;
  published: boolean;
}

export interface TipProgress {
  user_id: string;
  tip_id: string;
  read_at: string | null;
  favorite: boolean;
}

export interface Challenge {
  id: string;
  title: string;
  description: string | null;
  duration_days: number;
}

export interface UserChallenge {
  id: string;
  user_id: string;
  challenge_id: string | null;
  started_on: string;
  completed: boolean;
}

export interface NotificationSettings {
  user_id: string;
  daily_reminder: boolean;
  payday_reminder: boolean;
  budget_alert: boolean;
  monthly_summary: boolean;
  push_subscription: unknown | null;
}

export interface Workspace {
  profile: Profile;
  allocation: Allocation;
  emergency: EmergencyFund;
  categories: Category[];
  transactions: Transaction[];
  protection: ProtectionItem[];
  assets: Asset[];
  simulations: Simulation[];
  tips: Tip[];
  progress: TipProgress[];
  challenges: Challenge[];
  userChallenges: UserChallenge[];
  notifications: NotificationSettings;
}

export interface MonthSummary {
  month: string;
  income: number;
  needs: number;
  wants: number;
  savings: number;
}
