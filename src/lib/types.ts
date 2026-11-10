export type TxType = 'income' | 'expense';
export type NeedKind = 'need' | 'want';
export type Pocket = 'subsistence' | 'assets' | 'protection';
export type Recurrence = 'none' | 'weekly' | 'monthly';
export type TipCategory = 'Épargner' | 'Investir' | 'Protéger' | 'Mentalité';
export type TipLevel = 'Débutant' | 'Intermédiaire' | 'Avancé';

export type NeedBasis = 'day' | 'month';
export type IncomeKind = 'fixed' | 'variable' | 'one_off';

/** Un besoin récurrent saisi au jour ou au mois. */
export interface RecurringNeed {
  basis: NeedBasis;
  unitAmount: number;
  days: number;
}

/** Détail des besoins courants recueilli pendant l'onboarding. */
export interface NeedsBreakdown {
  transport: RecurringNeed;
  food: RecurringNeed;
  housing: {
    rent: number;
    bills: number;
    other: number;
  };
}

export interface Profile {
  id: string;
  first_name: string | null;
  currency: string;
  locale: string;
  life_goal: string | null;
  avg_income: number;
  avg_needs: number;
  needs_breakdown: NeedsBreakdown | null;
  savings_rate_goal: number;
  emergency_months: number;
  onboarded: boolean;
  tour_done: boolean;
  is_admin: boolean;
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
  income_kind: IncomeKind | null;
  goal_id: string | null;
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

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  pocket: Pocket | null;
  monthly_contribution: number;
  archived: boolean;
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
  check_ins: number;
  completed_at: string | null;
}

export interface NotificationSettings {
  user_id: string;
  daily_reminder: boolean;
  payday_reminder: boolean;
  budget_alert: boolean;
  monthly_summary: boolean;
  weekly_review: boolean;
  reminder_hour: number;
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
  goals: Goal[];
  simulations: Simulation[];
  tips: Tip[];
  progress: TipProgress[];
  challenges: Challenge[];
  userChallenges: UserChallenge[];
  notifications: NotificationSettings;
}

export interface WeeklyReview {
  from: string;
  to: string;
  income: number;
  expenses: number;
  saved: number;
  previousSaved: number;
  change: number | null;
  topCategory: { name: string; amount: number } | null;
}

export interface NextAction {
  key: string;
  tone: 'danger' | 'warning' | 'neutral' | 'positive';
  title: string;
  body: string;
  cta: { label: string; to: string };
}

export interface MonthSummary {
  month: string;
  income: number;
  needs: number;
  wants: number;
  savings: number;
  /** Argent mis de côté pour des objectifs (versements), déduit de l'épargne du mois. */
  savingsOut: number;
  /** Part du revenu qui vient des moyennes d'inscription (0 si mois réel). */
  incomeEstimated: number;
  /** Part des besoins qui vient des moyennes d'inscription (plancher déclaré). */
  needsEstimated: number;
}

/** Agrégats du panel administrateur (aucune donnée financière individuelle). */
export interface AdminOverview {
  accounts: number;
  onboarded: number;
  admins: number;
  new7: number;
  new30: number;
  active30: number;
  confirmed: number;
  transactions: number;
  transactions30: number;
  assets: number;
  pushDevices: number;
  maintenance: boolean;
}

export interface AdminAccount {
  id: string;
  email: string | null;
  first_name: string | null;
  currency: string;
  onboarded: boolean;
  is_admin: boolean;
  email_confirmed: boolean;
  created_at: string;
  transactions: number;
  last_activity: string | null;
}

export interface AdminHealth {
  profilesWithoutAllocation: number;
  profilesWithoutEmergencyFund: number;
  profilesWithoutNotifications: number;
  profilesNotOnboarded: number;
  transactionsWithoutCategory: number;
  orphanTransactions: number;
  tipsPublished: number;
  challenges: number;
}
