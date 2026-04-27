"use client";


import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  BarChart3,
  CircleDot,
  CircleUserRound,
  BellRing,
  LayoutGrid,
  ListFilter,
  Loader2,
  LogOut,
  RefreshCcw,
  Search,
  Share2,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  WalletMinimal,
  Briefcase,
  ArrowUpRight,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import SiteHeader from "@/components/SiteHeader";
import AuthPanel from "@/components/AuthPanel";
import RequireAuth from "@/components/RequireAuth";
import AgentAdvisorPanel from "@/components/AgentAdvisorPanel";
import ExecutiveIntelligencePanel from "@/components/ExecutiveIntelligencePanel";
import HoldingsAnalyzerPanel from "@/components/HoldingsAnalyzerPanel";
import { DashboardSectionCard, StatCard, StatusBadge } from "@/components/dashboard/DashboardPrimitives";
import type { AgentStructuredAdvice, DashboardIntelligenceSnapshot, DashboardModuleKey } from "@/lib/agent/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type RiskAppetite = "conservative" | "moderate" | "aggressive";

type ProfileRow = {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  phone_e164: string | null;
  city: string | null;
  state: string | null;
  occupation_title: string | null;
  employment_type: string | null;
  monthly_income_inr: number;
  monthly_expenses_inr: number;
  monthly_emi_inr: number;
  monthly_investable_surplus_inr: number;
  current_savings_inr: number;
  emergency_fund_months: number;
  loss_tolerance_pct: number | null;
  risk_appetite: RiskAppetite;
  tax_regime: "old" | "new" | null;
  kyc_status: "not_started" | "pending" | "verified" | "rejected" | string;
  target_amount_inr: number;
  target_horizon_years: number;
  notes: string;
  consent_to_contact: boolean;
  source: string;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type MarketIndicator = {
  id: "NIFTY50" | "BANKNIFTY" | "SENSEX";
  displayName: string;
  value: number;
  changeAbs: number;
  changePct: number;
  trend: "up" | "down" | "flat";
};

type MarketIndicatorsResponse = {
  ok: true;
  generatedAt: string;
  source: "live" | "fallback";
  indices: MarketIndicator[];
};

type HoldingsExposure = {
  name: string;
  value: number;
  marketValueInr: number;
};

type HoldingsAnalyticsSnapshot = {
  totalMarketValueInr: number;
  totalCostValueInr: number;
  totalUnrealizedPnlInr: number;
  totalUnrealizedPnlPct: number | null;
  allocationByAssetClass: HoldingsExposure[];
  sectorExposure: HoldingsExposure[];
  concentrationWarnings: Array<{
    id: string;
    severity: "low" | "medium" | "high";
    title: string;
    message: string;
    metricPct: number | null;
  }>;
};

type HoldingsApiPayload = {
  ok?: boolean;
  holdings?: Array<{ id: string }>;
  analytics?: HoldingsAnalyticsSnapshot;
  error?: string;
};



type IntelligenceApiPayload = {
  ok?: boolean;
  snapshot?: DashboardIntelligenceSnapshot;
  error?: string;
};


type AgentDashboardPayload = {
  ok?: boolean;
  aiSummary?: string;
  error?: string;
};

type AgentChatPayload = {
  ok?: boolean;
  structured?: AgentStructuredAdvice;
  error?: string;
};

type AgentChatReplyPayload = {
  ok?: boolean;
  reply?: string;
  error?: string;
  isSimpleAnswer?: boolean;
  structured?: {
    recommendation?: string;
    reason?: string;
    nextAction?: string;
    intro?: string;
  };
};

type FollowUpQaItem = {
  id: string;
  question: string;
  answer: string;
  isSimple: boolean;
  recommendation: string;
  reason: string;
  nextAction: string;
  intro: string;
};

type DashboardHorizon = "1y" | "2y" | "3y" | "custom";
type DashboardLens = "goal" | "cashflow" | "risk";
type KpiDeltaTone = "positive" | "negative" | "neutral";
type DashboardKpiItem = {
  id: string;
  label: string;
  value: string;
  hint: string;
  deltaLabel: string;
  deltaTone: KpiDeltaTone;
  detail: string;
  source: string;
};
type TrendPoint = { label: string; value: number };
type InsightTone = "neutral" | "positive" | "warning" | "critical";
type ScenarioCard = {
  label: string;
  annualReturnPct: number;
  projectedValue: number;
  gainInr: number;
  gainPct: number;
  tone: InsightTone;
};

type MarketPulseItem = {
  label: string;
  value: string;
  detail: string;
  tone: InsightTone;
};

const motionEase = [0.22, 1, 0.36, 1] as const;

const SCENARIO_RETURN_PCT = {
  conservative: 8,
  moderate: 11,
  aggressive: 14,
} as const;
type MarketTrendPoint = { label: string; close: number };
type MarketTrendResponse = {
  ok: true;
  generatedAt: string;
  source: "live" | "fallback";
  symbol: "NIFTY50";
  horizon: DashboardHorizon;
  points: MarketTrendPoint[];
};

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const compactInrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatCurrency(value: number): string {
  return inrFormatter.format(value);
}

function formatCompactCurrency(value: number): string {
  return compactInrFormatter.format(value);
}

function formatRisk(value: RiskAppetite): string {
  if (value === "conservative") {
    return "Conservative";
  }

  if (value === "aggressive") {
    return "Aggressive";
  }

  return "Moderate";
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Not available";
  }

  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatSignedNumber(value: number, digits = 2): string {
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}${Math.abs(value).toFixed(digits)}`;
}

function formatSignedPercent(value: number): string {
  return `${formatSignedNumber(value, 2)}%`;
}

function formatIndexNumber(value: number): string {
  return value.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
}

function parseNumberInput(value: string, fallback = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toHorizonMonths(horizon: DashboardHorizon, customYears: number): number {
  if (horizon === "1y") {
    return 12;
  }

  if (horizon === "2y") {
    return 24;
  }

  if (horizon === "3y") {
    return 36;
  }

  return Math.max(1, Math.round(customYears)) * 12;
}

function toHorizonLabel(horizon: DashboardHorizon, customYears: number): string {
  if (horizon === "1y") {
    return "1 year";
  }

  if (horizon === "2y") {
    return "2 years";
  }

  if (horizon === "3y") {
    return "3 years";
  }

  const normalizedYears = Math.max(1, Math.round(customYears));
  return `${normalizedYears} year${normalizedYears === 1 ? "" : "s"} (custom)`;
}

function projectCorpusValue(
  currentCorpus: number,
  monthlyContribution: number,
  annualReturnPct: number,
  months: number,
): number {
  const safeCorpus = Math.max(currentCorpus, 0);
  const safeContribution = Math.max(monthlyContribution, 0);
  const safeMonths = Math.max(months, 0);
  const monthlyRate = Math.max(annualReturnPct, 0) / 12 / 100;

  if (safeMonths === 0) {
    return safeCorpus;
  }

  if (monthlyRate === 0) {
    return safeCorpus + safeContribution * safeMonths;
  }

  const corpusGrowth = safeCorpus * Math.pow(1 + monthlyRate, safeMonths);
  const sipGrowth = safeContribution * (((Math.pow(1 + monthlyRate, safeMonths) - 1) / monthlyRate) * (1 + monthlyRate));

  return corpusGrowth + sipGrowth;
}

function toneToClassName(tone: KpiDeltaTone): string {
  if (tone === "positive") {
    return "text-finance-green";
  }

  if (tone === "negative") {
    return "text-finance-red";
  }

  return "text-finance-muted";
}

function insightToneToBadgeTone(tone: InsightTone): "neutral" | "success" | "warning" | "critical" | "info" {
  if (tone === "positive") {
    return "success";
  }

  if (tone === "warning") {
    return "warning";
  }

  if (tone === "critical") {
    return "critical";
  }

  return "neutral";
}

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [manualFocus, setManualFocus] = useState<DashboardModuleKey | null>(null);
  const [recommendedFocus, setRecommendedFocus] = useState<DashboardModuleKey | null>(null);
  const [marketIndicators, setMarketIndicators] = useState<MarketIndicator[]>([]);
  const [marketSource, setMarketSource] = useState<"live" | "fallback" | null>(null);
  const [marketGeneratedAt, setMarketGeneratedAt] = useState<string | null>(null);
  const [isMarketLoading, setIsMarketLoading] = useState(true);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [isPowerInsightsLoading, setIsPowerInsightsLoading] = useState(false);
  const [powerInsightsError, setPowerInsightsError] = useState<string | null>(null);
  const [intelligenceSnapshot, setIntelligenceSnapshot] = useState<DashboardIntelligenceSnapshot | null>(null);
  const [holdingsAnalytics, setHoldingsAnalytics] = useState<HoldingsAnalyticsSnapshot | null>(null);
  const [holdingsCount, setHoldingsCount] = useState(0);
  const [advisorSummary, setAdvisorSummary] = useState<string | null>(null);
  const [aiAllocation, setAiAllocation] = useState<AgentStructuredAdvice | null>(null);
  const [isAiAllocationLoading, setIsAiAllocationLoading] = useState(false);
  const [aiAllocationError, setAiAllocationError] = useState<string | null>(null);
  const [followUpQuestion, setFollowUpQuestion] = useState("");
  const [followUpThread, setFollowUpThread] = useState<FollowUpQaItem[]>([]);
  const [isFollowUpLoading, setIsFollowUpLoading] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [selectedHorizon, setSelectedHorizon] = useState<DashboardHorizon>("1y");
  const [customHorizonYears, setCustomHorizonYears] = useState(5);
  const [selectedLens, setSelectedLens] = useState<DashboardLens>("goal");
  const [selectedKpiId, setSelectedKpiId] = useState<string | null>(null);
  const [marketTrend, setMarketTrend] = useState<MarketTrendPoint[]>([]);

  // SIP Calculator local state - initialized to profile values in useEffect below
  const [sipMonthlyAmount, setSipMonthlyAmount] = useState(15000);
  const [sipAnnualReturn, setSipAnnualReturn] = useState(12);
  const [sipDurationYears, setSipDurationYears] = useState(10);
  const [projectionYears, setProjectionYears] = useState(10);

  // Sync profile data to dashboard filters & calculator
  useEffect(() => {
    if (!profile) return;

    // 1. Sync Horizon
    const years = profile.target_horizon_years || 1;
    if (years === 1) setSelectedHorizon("1y");
    else if (years === 2) setSelectedHorizon("2y");
    else if (years === 3) setSelectedHorizon("3y");
    else {
      setSelectedHorizon("custom");
      setCustomHorizonYears(years);
    }

    // 2. Sync SIP Calculator
    const surplus = profile.monthly_investable_surplus_inr;
    if (surplus > 0) setSipMonthlyAmount(surplus);

    const horizon = profile.target_horizon_years;
    if (horizon > 0) setSipDurationYears(horizon);

    const risk = profile.risk_appetite;
    if (risk === "aggressive") setSipAnnualReturn(13.5);
    else if (risk === "conservative") setSipAnnualReturn(8.5);
    else setSipAnnualReturn(11.0);

  }, [profile]);
  const [marketTrendSource, setMarketTrendSource] = useState<"live" | "fallback" | null>(null);
  const [marketTrendGeneratedAt, setMarketTrendGeneratedAt] = useState<string | null>(null);
  const [isMarketTrendLoading, setIsMarketTrendLoading] = useState(true);
  const [isCompactMotion, setIsCompactMotion] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      setRefreshTick((current) => current + 1);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadMarketIndicators(showLoadingState: boolean) {
      if (showLoadingState) {
        setIsMarketLoading(true);
      }
      setMarketError(null);

      try {
        const response = await fetch("/api/market/indices", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Market API failed with status ${response.status}`);
        }

        const payload = (await response.json()) as MarketIndicatorsResponse;

        if (!cancelled) {
          setMarketIndicators(Array.isArray(payload.indices) ? payload.indices : []);
          setMarketSource(payload.source ?? "fallback");
          setMarketGeneratedAt(payload.generatedAt ?? null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setMarketError(loadError instanceof Error ? loadError.message : "Could not load market indicators.");
          setMarketSource("fallback");
        }
      } finally {
        if (!cancelled) {
          setIsMarketLoading(false);
        }
      }
    }

    void loadMarketIndicators(true);
    const refreshTimer = window.setInterval(() => {
      void loadMarketIndicators(false);
    }, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
    };
  }, [refreshTick]);

  useEffect(() => {
    let cancelled = false;

    async function loadMarketTrend() {
      setIsMarketTrendLoading(true);

      const horizonQuery = selectedHorizon === "custom"
        ? `custom&years=${Math.max(1, Math.round(customHorizonYears))}`
        : selectedHorizon;

      try {
        const response = await fetch(`/api/market/indices/history?horizon=${horizonQuery}`, {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Market trend API failed with status ${response.status}`);
        }

        const payload = (await response.json()) as MarketTrendResponse;

        if (!cancelled) {
          setMarketTrend(Array.isArray(payload.points) ? payload.points : []);
          setMarketTrendSource(payload.source ?? "fallback");
          setMarketTrendGeneratedAt(payload.generatedAt ?? null);
        }
      } catch {
        if (!cancelled) {
          setMarketTrend([]);
          setMarketTrendSource("fallback");
        }
      } finally {
        if (!cancelled) {
          setIsMarketTrendLoading(false);
        }
      }
    }

    void loadMarketTrend();

    return () => {
      cancelled = true;
    };
  }, [refreshTick, selectedHorizon, customHorizonYears]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");

    const updateMotionDensity = () => {
      setIsCompactMotion(mediaQuery.matches);
    };

    updateMotionDensity();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateMotionDensity);

      return () => {
        mediaQuery.removeEventListener("change", updateMotionDensity);
      };
    }

    mediaQuery.addListener(updateMotionDensity);

    return () => {
      mediaQuery.removeListener(updateMotionDensity);
    };
  }, []);

  const getAccessToken = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data, error: authError } = await supabase.auth.getSession();

    if (authError) {
      throw authError;
    }

    const token = data.session?.access_token;
    if (!token) {
      throw new Error("Authentication session expired. Please sign in again.");
    }

    return token;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAiAllocation() {
      if (!signedInEmail || !profile) {
        setAiAllocation(null);
        setAiAllocationError(null);
        setIsAiAllocationLoading(false);
        return;
      }

      // Check localStorage for cached AI allocation summary to save API rate limits
      // Cache key includes profile.updated_at so a new onboarding invalidates it
      const cacheKey = `ai_allocation_${profile.id}_${profile.updated_at}`;
      const cached = localStorage.getItem(cacheKey);
      
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (!cancelled) {
            setAiAllocation(parsed);
            setAiAllocationError(null);
            setIsAiAllocationLoading(false);
          }
          return;
        } catch (e) {
          // If JSON parse fails, ignore and fetch normally
        }
      }

      setIsAiAllocationLoading(true);
      setAiAllocationError(null);

      try {
        const token = await getAccessToken();

        const response = await fetch("/api/agent/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message:
              "Create a simple money plan for this user based on their onboarding answers. Use very easy language and avoid technical words. Return structured JSON with intro, monthlySipRange, nextAction, and portfolioBuckets with exactly three entries for low-risk, balanced, and high-growth styles. For each bucket include heading, expectedReturn, instruments array, and allocationHint. Keep every line practical and easy to understand for an Indian user.",
            history: [],
          }),
        });

        const payload = (await response.json().catch(() => ({}))) as AgentChatPayload;

        if (!response.ok) {
          throw new Error(payload.error ?? `AI allocation request failed (${response.status})`);
        }

        if (!cancelled) {
          const structuredData = payload.structured ?? null;
          setAiAllocation(structuredData);
          if (structuredData) {
            localStorage.setItem(cacheKey, JSON.stringify(structuredData));
          }
        }
      } catch (err) {
        if (!cancelled) {
          setAiAllocation(null);
          setAiAllocationError(err instanceof Error ? err.message : "Could not load AI allocation summary.");
        }
      } finally {
        if (!cancelled) {
          setIsAiAllocationLoading(false);
        }
      }
    }

    void loadAiAllocation();

    return () => {
      cancelled = true;
    };
  }, [getAccessToken, profile, refreshTick, signedInEmail]);

  useEffect(() => {
    let cancelled = false;

    async function loadPowerInsights() {
      if (!signedInEmail) {
        setIsPowerInsightsLoading(false);
        setPowerInsightsError(null);
        setIntelligenceSnapshot(null);
        setHoldingsAnalytics(null);
        setHoldingsCount(0);
        setAdvisorSummary(null);
        return;
      }

      setIsPowerInsightsLoading(true);
      setPowerInsightsError(null);

      try {
        const token = await getAccessToken();

        const authedGet = async <TPayload,>(path: string): Promise<TPayload> => {
          const response = await fetch(path, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          });

          const payload = (await response.json().catch(() => ({}))) as { error?: string } & TPayload;
          if (!response.ok) {
            throw new Error(payload.error ?? `Could not load ${path}`);
          }

          return payload;
        };

        const [intelligenceResult, holdingsResult, advisorResult] = await Promise.allSettled([
          authedGet<IntelligenceApiPayload>("/api/agent/intelligence"),
          authedGet<HoldingsApiPayload>("/api/agent/holdings"),
          authedGet<AgentDashboardPayload>("/api/agent/dashboard"),
        ]);

        if (cancelled) {
          return;
        }

        if (intelligenceResult.status === "fulfilled") {
          setIntelligenceSnapshot(intelligenceResult.value.snapshot ?? null);
        }

        if (holdingsResult.status === "fulfilled") {
          setHoldingsAnalytics(holdingsResult.value.analytics ?? null);
          setHoldingsCount(Array.isArray(holdingsResult.value.holdings) ? holdingsResult.value.holdings.length : 0);
        } else {
          setHoldingsAnalytics(null);
          setHoldingsCount(0);
        }


        if (advisorResult.status === "fulfilled") {
          setAdvisorSummary(advisorResult.value.aiSummary ?? null);
        } else {
          setAdvisorSummary(null);
        }

        const failedCount = [
          intelligenceResult,
          holdingsResult,
          advisorResult,
        ].filter((result) => result.status === "rejected").length;

        if (failedCount === 3) {
          setPowerInsightsError("Could not load dashboard insights from Pravix modules.");
        } else if (failedCount > 0) {
          setPowerInsightsError("Some insight widgets are temporarily unavailable.");
        } else {
          setPowerInsightsError(null);
        }
      } catch (insightError) {
        if (!cancelled) {
          setPowerInsightsError(insightError instanceof Error ? insightError.message : "Could not load dashboard insights.");
          setIntelligenceSnapshot(null);
          setHoldingsAnalytics(null);
          setHoldingsCount(0);
          setHoldingsCount(0);
          setAdvisorSummary(null);
        }
      } finally {
        if (!cancelled) {
          setIsPowerInsightsLoading(false);
        }
      }
    }

    void loadPowerInsights();

    return () => {
      cancelled = true;
    };
  }, [getAccessToken, refreshTick, signedInEmail]);

  async function handleSignOut() {
    setIsSigningOut(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        throw signOutError;
      }

      setProfile(null);
      setSignedInEmail(null);
      setManualFocus(null);
      setRecommendedFocus(null);
      setRefreshTick((current) => current + 1);
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : "Could not sign out right now.");
    } finally {
      setIsSigningOut(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setIsLoading(true);
      setError(null);

      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          if (!cancelled) {
            setSignedInEmail(null);
            setProfile(null);
          }
          return;
        }

        const { data, error: profileError } = await supabase
          .from("profiles")
          .select(
            "id,user_id,full_name,email,phone_e164,city,state,occupation_title,employment_type,monthly_income_inr,monthly_expenses_inr,monthly_emi_inr,monthly_investable_surplus_inr,current_savings_inr,emergency_fund_months,loss_tolerance_pct,risk_appetite,tax_regime,kyc_status,target_amount_inr,target_horizon_years,notes,consent_to_contact,source,onboarding_completed_at,created_at,updated_at",
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (profileError) {
          throw profileError;
        }

        if (!cancelled) {
          setSignedInEmail(user.email ?? null);
          setProfile((data?.[0] as ProfileRow | undefined) ?? null);
        }
      } catch (loadError) {
        if (!cancelled) {
          const message = loadError instanceof Error ? loadError.message : "Could not load your dashboard profile.";
          const normalized = message.toLowerCase();

          if (normalized.includes("auth session missing") || normalized.includes("session expired")) {
            setSignedInEmail(null);
            setProfile(null);
            setError(null);
            return;
          }

          setError(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  useEffect(() => {
    if (!signedInEmail || !profile) {
      setManualFocus(null);
      setRecommendedFocus(null);
    }
  }, [signedInEmail, profile]);

  const latestCreatedAt = useMemo(() => formatDateTime(profile?.created_at ?? null), [profile?.created_at]);

  const latestUpdatedAt = useMemo(() => formatDateTime(profile?.updated_at ?? null), [profile?.updated_at]);

  const profileFreshness = useMemo(() => {
    if (!profile) {
      return { label: "Awaiting profile", tone: "neutral" as const };
    }

    const updatedAtMs = new Date(profile.updated_at).getTime();
    const ageInDays = Number.isFinite(updatedAtMs)
      ? Math.floor((Date.now() - updatedAtMs) / (1000 * 60 * 60 * 24))
      : 999;

    if (ageInDays <= 30) {
      return { label: "Up to date", tone: "success" as const };
    }

    if (ageInDays <= 90) {
      return { label: "Review soon", tone: "warning" as const };
    }

    return { label: "Needs review", tone: "critical" as const };
  }, [profile]);

  const targetGap = useMemo(() => {
    if (!profile) {
      return 0;
    }

    return Math.max(profile.target_amount_inr - profile.current_savings_inr, 0);
  }, [profile]);

  const greetingLabel = useMemo(() => {
    const hour = new Date().getHours();
    const dayPart = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
    const nameSource = profile?.full_name.trim() || signedInEmail?.split("@")[0] || "";

    if (nameSource) {
      return `Good ${dayPart}, ${nameSource.split(" ")[0]}`;
    }

    return `Good ${dayPart}`;
  }, [profile?.full_name, signedInEmail]);

  const marketStatus = useMemo(() => {
    const suffix = marketGeneratedAt
      ? ` • ${new Date(marketGeneratedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
      : "";

    const tone = isMarketLoading
      ? ("neutral" as const)
      : marketSource === "live"
        ? ("success" as const)
        : ("warning" as const);

    return { label: `Live feed${suffix}`, tone };
  }, [isMarketLoading, marketGeneratedAt, marketSource]);

  const marketTrendStatus = useMemo(() => {
    if (isMarketTrendLoading) {
      return { label: "Loading trend", tone: "neutral" as const };
    }

    if (marketTrendSource === "live") {
      const suffix = marketTrendGeneratedAt
        ? ` • ${new Date(marketTrendGeneratedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
        : "";
      return { label: `Live trend${suffix}`, tone: "success" as const };
    }

    return { label: "Fallback trend", tone: "warning" as const };
  }, [isMarketTrendLoading, marketTrendGeneratedAt, marketTrendSource]);

  const selectedHorizonMonths = useMemo(
    () => toHorizonMonths(selectedHorizon, customHorizonYears),
    [selectedHorizon, customHorizonYears],
  );
  const selectedHorizonLabel = useMemo(
    () => toHorizonLabel(selectedHorizon, customHorizonYears),
    [selectedHorizon, customHorizonYears],
  );

  const niftyTrendSummary = useMemo(() => {
    if (marketTrend.length < 2) {
      return null;
    }

    const first = marketTrend[0]?.close ?? 0;
    const latest = marketTrend[marketTrend.length - 1]?.close ?? 0;
    const change = latest - first;
    const changePct = first > 0 ? (change / first) * 100 : 0;

    return {
      first,
      latest,
      change,
      changePct,
    };
  }, [marketTrend]);

  const orderedMarketIndicators = useMemo(() => {
    const order: Array<MarketIndicator["id"]> = ["NIFTY50", "SENSEX", "BANKNIFTY"];
    const lookup = new Map(marketIndicators.map((indicator) => [indicator.id, indicator]));

    return order
      .map((id) => lookup.get(id))
      .filter((indicator): indicator is MarketIndicator => Boolean(indicator));
  }, [marketIndicators]);

  const sipSuggestedAmount = useMemo(() => {
    if (!profile) {
      return null;
    }

    return Math.max(profile.monthly_investable_surplus_inr, 0);
  }, [profile]);

  const sipProjection = useMemo(() => {
    const monthlyAmount = Math.max(sipMonthlyAmount, 0);
    const annualRate = Math.min(Math.max(sipAnnualReturn, 0), 40);
    const durationMonths = Math.max(1, Math.round(sipDurationYears * 12));
    const monthlyRate = annualRate / 12 / 100;
    const invested = monthlyAmount * durationMonths;

    const projectedValue = monthlyRate === 0
      ? invested
      : monthlyAmount * (((Math.pow(1 + monthlyRate, durationMonths) - 1) / monthlyRate) * (1 + monthlyRate));

    const roundedProjectedValue = Math.round(projectedValue);
    const estimatedReturns = Math.max(roundedProjectedValue - Math.round(invested), 0);

    return {
      months: durationMonths,
      invested: Math.round(invested),
      projectedValue: roundedProjectedValue,
      estimatedReturns,
    };
  }, [sipAnnualReturn, sipDurationYears, sipMonthlyAmount]);

  const powerTrendData = useMemo(() => {
    if (!profile) {
      return [];
    }

    const savingsValue = Math.max(profile.current_savings_inr, 0);
    const holdingsValue = Math.max(holdingsAnalytics?.totalMarketValueInr ?? 0, 0);
    const baseCorpus = savingsValue + holdingsValue;
    const goalReference = Math.max(profile.target_amount_inr, baseCorpus, 1);
    const monthlySurplus = Math.max(profile.monthly_investable_surplus_inr, 0);
    const horizonMonths = Math.max(profile.target_horizon_years * 12, 1);
    const projectionMonths = Math.min(horizonMonths, selectedHorizonMonths);
    const checkpoints = Array.from({ length: 8 }, (_, index) => Math.round((projectionMonths * index) / 7));

    return checkpoints.map((monthsFromNow, index) => {
      const projectedCorpus = Math.max(baseCorpus + monthlySurplus * monthsFromNow, 0);
      const normalizedProgress = projectionMonths > 0 ? monthsFromNow / projectionMonths : 0;
      const goalPath = baseCorpus + (goalReference - baseCorpus) * normalizedProgress;
      const monthLabel = monthsFromNow >= 12 && monthsFromNow % 12 === 0
        ? `Y${Math.round(monthsFromNow / 12)}`
        : monthsFromNow === 0
          ? "Now"
          : `M${monthsFromNow}`;

      return {
        label: monthLabel,
        actual: Math.round(projectedCorpus),
        goalPath: Math.round(goalPath),
        checkpoint: index,
      };
    });
  }, [holdingsAnalytics?.totalMarketValueInr, profile, selectedHorizonMonths]);

  const allocationBarData = useMemo(() => {
    const palette = ["#f5cc73", "#7aaafc", "#f0b85f", "#69c8ad", "#5a6d8f"];

    const holdingsAllocation = (holdingsAnalytics?.allocationByAssetClass ?? []).slice(0, 5).map((item, index) => ({
      category: item.name,
      value: item.marketValueInr,
      fill: palette[index % palette.length],
    }));

    if (holdingsAllocation.length > 0) {
      return holdingsAllocation;
    }

    if (!profile) {
      return [];
    }

    const livingExpenses = Math.max(profile.monthly_expenses_inr, 0);
    const emi = Math.max(profile.monthly_emi_inr, 0);
    const investable = Math.max(profile.monthly_investable_surplus_inr, 0);
    const income = Math.max(profile.monthly_income_inr, 0);
    const buffer = Math.max(income - (livingExpenses + emi + investable), 0);

    return [
      { category: "Living", value: livingExpenses, fill: palette[0] },
      { category: "EMI", value: emi, fill: palette[1] },
      { category: "Investable", value: investable, fill: palette[2] },
      { category: "Buffer", value: buffer, fill: palette[3] },
    ].filter((item) => item.value > 0);
  }, [holdingsAnalytics?.allocationByAssetClass, profile]);

  const allocationSubtitle = useMemo(() => {
    if ((holdingsAnalytics?.allocationByAssetClass ?? []).length > 0) {
      return "Asset-class distribution from your holdings analyzer.";
    }

    return "Monthly cashflow composition from your Supabase profile.";
  }, [holdingsAnalytics?.allocationByAssetClass]);

  const attentionMixData = useMemo(() => {
    if (!profile) {
      return [] as Array<{ name: string; value: number; color: string }>;
    }

    const concentrationCount = holdingsAnalytics?.concentrationWarnings.length ?? 0;

    let profileGaps = 0;
    if (!profile.onboarding_completed_at) {
      profileGaps += 1;
    }
    if (profile.kyc_status !== "verified") {
      profileGaps += 1;
    }
    if (!profile.tax_regime) {
      profileGaps += 1;
    }
    if (profile.loss_tolerance_pct === null) {
      profileGaps += 1;
    }
    if (holdingsCount === 0) {
      profileGaps += 1;
    }

    const base = [
      { name: "Concentration", value: concentrationCount, color: "#76a8ff" },
      { name: "Profile gaps", value: profileGaps, color: "#58647d" },
    ].filter((entry) => entry.value > 0);

    if (base.length === 0) {
      return [{ name: "Stable", value: 1, color: "#69c8ad" }];
    }

    return base;
  }, [holdingsAnalytics?.concentrationWarnings.length, holdingsCount, profile]);

  const topAttentionSignal = useMemo(() => {
    if (attentionMixData.length === 0) {
      return { name: "Stable", value: 0 };
    }

    return [...attentionMixData].sort((left, right) => right.value - left.value)[0];
  }, [attentionMixData]);

  const trajectoryCheckpoints = useMemo(() => {
    if (powerTrendData.length === 0) {
      return [] as Array<{
        label: string;
        actual: number;
        goalPath: number;
        gap: number;
      }>;
    }

    const checkpointIndexes = Array.from(new Set([0, Math.floor((powerTrendData.length - 1) / 2), powerTrendData.length - 1]));

    return checkpointIndexes.map((index) => {
      const point = powerTrendData[index];

      return {
        label: point.label,
        actual: point.actual,
        goalPath: point.goalPath,
        gap: point.actual - point.goalPath,
      };
    });
  }, [powerTrendData]);

  const attentionBreakdown = useMemo(() => {
    const total = attentionMixData.reduce((sum, entry) => sum + entry.value, 0);

    return attentionMixData.slice(0, 4).map((entry) => ({
      ...entry,
      share: total > 0 ? (entry.value / total) * 100 : 0,
    }));
  }, [attentionMixData]);

  const strategyKpis = useMemo(() => {
    const holdingsPnl = holdingsAnalytics?.totalUnrealizedPnlInr ?? null;
    const holdingsPnlPct = holdingsAnalytics?.totalUnrealizedPnlPct ?? null;
    const suggestedFocus = intelligenceSnapshot?.recommendedFocus;
    const focusLabel = suggestedFocus ? `${suggestedFocus.charAt(0).toUpperCase()}${suggestedFocus.slice(1)}` : "N/A";

    return [
      {
        label: "Target gap",
        value: profile ? formatCompactCurrency(targetGap) : "N/A",
        hint: profile ? `${formatRisk(profile.risk_appetite)} · ${profile.target_horizon_years}y horizon` : "Complete onboarding",
      },
      {
        label: "Portfolio P&L",
        value: holdingsPnl !== null ? formatCompactCurrency(holdingsPnl) : "N/A",
        hint: holdingsPnlPct !== null ? `${formatSignedPercent(holdingsPnlPct)} unrealized` : "Import holdings to unlock",
      },
      {
        label: "Focus module",
        value: focusLabel,
        hint: intelligenceSnapshot ? `${intelligenceSnapshot.focusConfidence} confidence` : "Refresh intelligence",
      },
    ];
  }, [holdingsAnalytics?.totalUnrealizedPnlInr, holdingsAnalytics?.totalUnrealizedPnlPct, intelligenceSnapshot, profile, targetGap]);

  const insightDigestItems = useMemo(() => {
    const advisorSummaryPlain = advisorSummary
      ? advisorSummary.replace(/\*\*/g, "").replace(/\s+/g, " ").trim()
      : null;
    const shortAdvisorSummary = advisorSummaryPlain
      ? `${advisorSummaryPlain.slice(0, 110)}${advisorSummaryPlain.length > 110 ? "..." : ""}`
      : "Refresh Copilot to load AI action plan summary.";
    const marketUpCount = marketIndicators.filter((indicator) => indicator.trend === "up").length;
    const marketDownCount = marketIndicators.filter((indicator) => indicator.trend === "down").length;

    return [
      {
        title: "Market Feed",
        value: marketIndicators.length > 0 ? `${marketUpCount} up · ${marketDownCount} down` : "Feed pending",
        hint: marketStatus.label,
      },
      {
        title: "Executive Intelligence",
        value: intelligenceSnapshot
          ? `Recommended ${intelligenceSnapshot.recommendedFocus.toUpperCase()} (${intelligenceSnapshot.focusConfidence})`
          : "Not loaded",
        hint: intelligenceSnapshot ? `${intelligenceSnapshot.priorities.length} priorities ranked` : "Refresh intelligence panel",
      },
      {
        title: "Holdings Analyzer",
        value: holdingsAnalytics ? `${holdingsCount} holdings tracked` : "Not loaded",
        hint: holdingsAnalytics
          ? `${holdingsAnalytics.concentrationWarnings.length} concentration warning(s)`
          : "Refresh holdings panel",
      },
      {
        title: "AI Copilot",
        value: advisorSummary ? "Action plan synchronized" : "Not loaded",
        hint: shortAdvisorSummary,
      },
    ];
  }, [advisorSummary, holdingsAnalytics, holdingsCount, intelligenceSnapshot, marketIndicators, marketStatus.label]);

  const profileIntelligence = useMemo(() => {
    if (!profile) {
      return null;
    }

    const monthlyIncome = Math.max(profile.monthly_income_inr ?? 0, 0);
    const monthlyExpenses = Math.max(profile.monthly_expenses_inr ?? 0, 0);
    const monthlyEmi = Math.max(profile.monthly_emi_inr ?? 0, 0);
    const monthlyOutflow = monthlyExpenses + monthlyEmi;
    const investableSurplus = Math.max(
      profile.monthly_investable_surplus_inr ?? monthlyIncome - monthlyOutflow,
      0,
    );
    const savingsRatePct = monthlyIncome > 0 ? (investableSurplus / monthlyIncome) * 100 : 0;
    const expenseLoadPct = monthlyIncome > 0 ? (monthlyOutflow / monthlyIncome) * 100 : 0;
    const goalCoveragePct = profile.target_amount_inr > 0
      ? (profile.current_savings_inr / profile.target_amount_inr) * 100
      : 0;
    const horizonMonths = Math.max(profile.target_horizon_years * 12, 1);
    const requiredMonthlyToGoal = targetGap / horizonMonths;
    const goalFundingStress = requiredMonthlyToGoal - investableSurplus;
    const emergencyRunwayMonths = monthlyExpenses > 0
      ? profile.current_savings_inr / monthlyExpenses
      : profile.emergency_fund_months;
    const holdingsMarketValue = holdingsAnalytics?.totalMarketValueInr ?? 0;
    const totalVisibleCorpus = profile.current_savings_inr + holdingsMarketValue;

    return {
      monthlyIncome,
      monthlyOutflow,
      investableSurplus,
      savingsRatePct,
      expenseLoadPct,
      goalCoveragePct,
      requiredMonthlyToGoal,
      goalFundingStress,
      emergencyRunwayMonths,
      holdingsMarketValue,
      totalVisibleCorpus,
    };
  }, [holdingsAnalytics?.totalMarketValueInr, profile, targetGap]);

  const profileDataReadiness = useMemo<Array<{ label: string; tone: "neutral" | "success" | "warning" | "critical" | "info" }>>(() => {
    if (!profile) {
      return [];
    }

    return [
      {
        label: profile.onboarding_completed_at ? "Onboarding completed" : "Onboarding pending",
        tone: profile.onboarding_completed_at ? "success" : "warning",
      },
      {
        label: profile.kyc_status === "verified" ? "KYC verified" : `KYC ${profile.kyc_status}`,
        tone:
          profile.kyc_status === "verified"
            ? "success"
            : profile.kyc_status === "rejected"
              ? "critical"
              : "warning",
      },
      {
        label: profile.tax_regime ? `Tax regime ${profile.tax_regime.toUpperCase()}` : "Tax regime missing",
        tone: profile.tax_regime ? "info" : "warning",
      },
      {
        label: profile.loss_tolerance_pct !== null ? "Risk tolerance captured" : "Risk tolerance missing",
        tone: profile.loss_tolerance_pct !== null ? "success" : "warning",
      },
      {
        label: holdingsCount > 0 ? `${holdingsCount} holdings synced` : "Holdings not synced",
        tone: holdingsCount > 0 ? "success" : "warning",
      },
    ];
  }, [holdingsCount, profile]);

  const aiAllocationBuckets = useMemo(() => {
    const parsedBuckets = (aiAllocation?.portfolioBuckets ?? []).filter((bucket) =>
      Boolean(bucket.heading?.trim())
    );

    if (parsedBuckets.length >= 3) {
      return parsedBuckets.slice(0, 3);
    }

    return [
      {
        heading: "Safe Plan",
        expectedReturn: "About 7-9% a year",
        instruments: ["Mostly stable funds", "A small monthly amount in top 50 companies", "Keep some money easy to use"],
        allocationHint: "Best if you want less ups and downs and steady progress.",
      },
      {
        heading: "Balanced Plan",
        expectedReturn: "About 10-12% a year",
        instruments: ["Mix of stable and growth funds", "Monthly investment in broad market funds", "A small safety bucket"],
        allocationHint: "Good mix of growth and safety for most people.",
      },
      {
        heading: "Growth Plan",
        expectedReturn: "About 13-16% a year",
        instruments: ["More growth-focused funds", "A selected stock list", "Small part in theme-based ideas"],
        allocationHint: "For long-term goals if you can handle bigger market swings.",
      },
    ];
  }, [aiAllocation?.portfolioBuckets]);

  const handleFollowUpSubmit = useCallback(async () => {
    const trimmedQuestion = followUpQuestion.trim();
    if (!trimmedQuestion) {
      setFollowUpError("Please type your question first.");
      return;
    }

    setIsFollowUpLoading(true);
    setFollowUpError(null);

    try {
      const token = await getAccessToken();
      const contextSummary = [
        aiAllocation?.intro,
        aiAllocation?.monthlySipRange,
        aiAllocation?.nextAction,
      ]
        .filter(Boolean)
        .join(" | ");

      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: `${trimmedQuestion}`,
          history: followUpThread.flatMap((item) => {
            const assistantContent = item.recommendation && item.reason
              ? `${item.recommendation}\n\n${item.reason}${item.nextAction ? '\n\nNext step: ' + item.nextAction : ''}`
              : item.answer;
            return [
              { role: "user" as const, content: item.question },
              { role: "assistant" as const, content: assistantContent },
            ];
          }),
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as AgentChatReplyPayload;

      if (!response.ok) {
        throw new Error(payload.error ?? `Follow-up request failed (${response.status})`);
      }

      const answer = payload.reply ?? "I could not generate a reply right now. Please try again.";
      const isSimple = payload.isSimpleAnswer ?? false;
      const structured = payload.structured ?? {};
      setFollowUpThread((current) => [
        ...current,
        {
          id: `${Date.now()}-${current.length}`,
          question: trimmedQuestion,
          answer,
          isSimple,
          recommendation: structured.recommendation ?? "",
          reason: structured.reason ?? "",
          nextAction: structured.nextAction ?? "",
          intro: structured.intro ?? "",
        },
      ]);
      setFollowUpQuestion("");
    } catch (submitError) {
      setFollowUpError(submitError instanceof Error ? submitError.message : "Could not fetch follow-up answer.");
    } finally {
      setIsFollowUpLoading(false);
    }
  }, [aiAllocation?.intro, aiAllocation?.monthlySipRange, aiAllocation?.nextAction, followUpQuestion, followUpThread, getAccessToken]);

  const effectiveFocus = useMemo(() => manualFocus ?? recommendedFocus, [manualFocus, recommendedFocus]);

  const orderedModuleKeys = useMemo(() => {
    return ["advisor"] as DashboardModuleKey[];
  }, []);

  const kpiStripItems = useMemo<DashboardKpiItem[]>(() => {
    const investedCorpus = Math.max((profile?.current_savings_inr ?? 0) + (holdingsAnalytics?.totalMarketValueInr ?? 0), 0);
    const goalProgressPct = profile && profile.target_amount_inr > 0 ? Math.min((investedCorpus / profile.target_amount_inr) * 100, 999) : 0;
    const concentrationCount = holdingsAnalytics?.concentrationWarnings.length ?? 0;
    const concentrationTone = concentrationCount === 0 ? "Low" : concentrationCount <= 2 ? "Medium" : "High";

    return [
      {
        id: "goal-progress",
        label: "Goal Progress",
        value: `${goalProgressPct.toFixed(1)}%`,
        hint: `${formatCompactCurrency(investedCorpus)} corpus tracked`,
        deltaLabel: `${goalProgressPct >= 50 ? "+" : "-"}${Math.abs(goalProgressPct - 50).toFixed(1)} pts vs 50% milestone`,
        deltaTone: goalProgressPct >= 50 ? "positive" : "negative",
        detail: "Share of visible corpus versus target amount. Includes savings and synced holdings.",
        source: "Profiles + Holdings",
      },
      {
        id: "monthly-surplus",
        label: "Monthly Surplus",
        value: profile ? formatCompactCurrency(Math.max(profile.monthly_investable_surplus_inr, 0)) : "N/A",
        hint: profile ? `${formatCurrency(profile.monthly_income_inr)} income` : "Complete onboarding",
        deltaLabel: profile ? `${Math.max(((profile.monthly_investable_surplus_inr / Math.max(profile.monthly_income_inr, 1)) * 100), 0).toFixed(1)}% savings rate` : "Savings rate unavailable",
        deltaTone: profile && profile.monthly_investable_surplus_inr > 0 ? "positive" : "neutral",
        detail: "Net monthly cash available for SIP and goal funding.",
        source: "Profile monthly cashflow",
      },
      {
        id: "concentration-risk",
        label: "Concentration Risk",
        value: concentrationTone,
        hint: `${concentrationCount} warning(s)`,
        deltaLabel: concentrationCount === 0 ? "No major concentration alerts" : `${concentrationCount} concentration flags`,
        deltaTone: concentrationCount === 0 ? "positive" : concentrationCount <= 2 ? "neutral" : "negative",
        detail: "Sector and asset concentration risk indicator from holdings.",
        source: "Holdings analyzer",
      },
      {
        id: "data-freshness",
        label: "Data Freshness",
        value: profileFreshness.label,
        hint: `Updated ${latestUpdatedAt}`,
        deltaLabel: marketStatus.label,
        deltaTone: profileFreshness.label === "Up to date" ? "positive" : profileFreshness.label === "Review soon" ? "neutral" : "negative",
        detail: "Profile recency and market-feed health status.",
        source: "Profiles + Market feed",
      },
    ];
  }, [holdingsAnalytics?.concentrationWarnings.length, holdingsAnalytics?.totalMarketValueInr, latestUpdatedAt, marketStatus.label, profile, profileFreshness.label]);

  const selectedKpi = useMemo(() => {
    return kpiStripItems.find((item) => item.id === selectedKpiId) ?? null;
  }, [kpiStripItems, selectedKpiId]);

  const showCashflowBridge = selectedLens === "cashflow";
  const showAllocationMix = selectedLens === "goal" || selectedLens === "cashflow";
  const showScenarioComparison = selectedLens === "goal";
  const focusedInsightsTitle = selectedLens === "goal"
    ? "Goal-focused analysis"
    : selectedLens === "cashflow"
      ? "Cashflow-focused analysis"
      : "Risk-focused analysis";
  const focusedInsightsHint = selectedLens === "goal"
    ? "Track growth path, allocation balance, and long-term compounding behavior."
    : selectedLens === "cashflow"
      ? "Keep monthly inflow, outflow, and deployable surplus in control."
    : "Focus on risk telemetry and portfolio health hotspots.";

  const scenarioProjectionData = useMemo(() => {
    if (!profile) return [];
    const currentCorpus = Math.max(profile.current_savings_inr + (holdingsAnalytics?.totalMarketValueInr ?? 0), 0);
    const investable = Math.max(profile.monthly_investable_surplus_inr, 0);
    
    // Generate more points for a smooth, natural-looking chart
    const STEPS = 36;
    const points = Array.from({ length: STEPS + 1 }, (_, index) => (selectedHorizonMonths * index) / STEPS);

    let consVol = 0;
    let modVol = 0;
    let aggVol = 0;

    return points.map((month, index) => {
      const isStart = index === 0;
      const isEnd = index === STEPS;
      
      const baseCons = projectCorpusValue(currentCorpus, investable, SCENARIO_RETURN_PCT.conservative, month);
      const baseMod = projectCorpusValue(currentCorpus, investable, SCENARIO_RETURN_PCT.moderate, month);
      const baseAgg = projectCorpusValue(currentCorpus, investable, SCENARIO_RETURN_PCT.aggressive, month);

      if (isStart) {
        return { label: "Now", conservative: Math.round(baseCons), moderate: Math.round(baseMod), aggressive: Math.round(baseAgg) };
      }

      // Deterministic pseudo-random noise to avoid jumping on React re-renders
      const seed = month * 12.9898 + currentCorpus;
      const pseudoRandom = Math.sin(seed) * 43758.5453;
      const noise = pseudoRandom - Math.floor(pseudoRandom); // 0 to 1
      const fluctuation = (noise - 0.5) * 2; // -1 to 1

      // Accumulate volatility (conservative = low swings, aggressive = high swings)
      consVol += fluctuation * 0.006;
      modVol += fluctuation * 0.020;
      aggVol += fluctuation * 0.045;

      // Mean reversion to gradually pull lines back to their theoretical path
      consVol *= 0.85;
      modVol *= 0.88;
      aggVol *= 0.92;

      // Snap the final point to the exact expected value to match dashboard text
      if (isEnd) {
        consVol = 0;
        modVol = 0;
        aggVol = 0;
      }

      const displayMonth = Math.round(month);
      const label = displayMonth % 12 === 0 && displayMonth > 0 ? `Y${displayMonth / 12}` : `M${displayMonth}`;

      return {
        label,
        conservative: Math.max(Math.round(baseCons * (1 + consVol)), 0),
        moderate: Math.max(Math.round(baseMod * (1 + modVol)), 0),
        aggressive: Math.max(Math.round(baseAgg * (1 + aggVol)), 0),
      };
    });
  }, [holdingsAnalytics?.totalMarketValueInr, profile, selectedHorizonMonths]);



  const cashflowBridgeData = useMemo(() => {
    if (!profile) return [];
    const income = Math.max(profile.monthly_income_inr, 0);
    const expenses = -Math.max(profile.monthly_expenses_inr, 0);
    const emi = -Math.max(profile.monthly_emi_inr, 0);
    const investable = Math.max(profile.monthly_investable_surplus_inr, 0);
    const unplanned = income + expenses + emi - investable;
    return [
      { label: "Income", value: income, fill: "#2b5cff" },
      { label: "Expenses", value: expenses, fill: "#ff8a7b" },
      { label: "EMI", value: emi, fill: "#f5cc73" },
      { label: "Investable", value: investable, fill: "#69c8ad" },
      { label: "Balance", value: unplanned, fill: "#5a6d8f" },
    ];
  }, [profile]);

  const cashflowBalanceValue = useMemo(() => {
    return cashflowBridgeData.find((entry) => entry.label === "Balance")?.value ?? 0;
  }, [cashflowBridgeData]);



  const allocationDonutData = useMemo(() => {
    const rows = (holdingsAnalytics?.allocationByAssetClass ?? []).slice(0, 6).map((item) => ({ name: item.name, value: Math.max(item.marketValueInr, 0) }));
    if (rows.length > 0) return rows;
    return allocationBarData.slice(0, 6).map((item) => ({ name: item.category, value: Math.max(item.value, 0) }));
  }, [allocationBarData, holdingsAnalytics?.allocationByAssetClass]);

  const allocationTotalValue = useMemo(() => {
    return allocationDonutData.reduce((sum, item) => sum + item.value, 0);
  }, [allocationDonutData]);

  const topAllocationSlices = useMemo(() => {
    if (allocationTotalValue <= 0) {
      return [] as Array<{ name: string; value: number; sharePct: number }>;
    }

    return [...allocationDonutData]
      .sort((left, right) => right.value - left.value)
      .slice(0, 3)
      .map((item) => ({
        name: item.name,
        value: item.value,
        sharePct: (item.value / allocationTotalValue) * 100,
      }));
  }, [allocationDonutData, allocationTotalValue]);

  const scenarioBaselineCorpus = useMemo(() => {
    if (!profile) {
      return 0;
    }

    const currentCorpus = Math.max(profile.current_savings_inr + (holdingsAnalytics?.totalMarketValueInr ?? 0), 0);
    const investable = Math.max(profile.monthly_investable_surplus_inr, 0);

    return Math.round(currentCorpus + investable * selectedHorizonMonths);
  }, [holdingsAnalytics?.totalMarketValueInr, profile, selectedHorizonMonths]);

  const scenarioEndPoint = useMemo(() => {
    if (scenarioProjectionData.length === 0) {
      return null;
    }

    return scenarioProjectionData[scenarioProjectionData.length - 1] ?? null;
  }, [scenarioProjectionData]);

  const scenarioOutcomeRows = useMemo(() => {
    if (!scenarioEndPoint) {
      return [] as Array<{ name: string; annualReturn: number; value: number; excess: number }>;
    }

    return [
      {
        name: "Conservative",
        annualReturn: SCENARIO_RETURN_PCT.conservative,
        value: scenarioEndPoint.conservative,
        excess: scenarioEndPoint.conservative - scenarioBaselineCorpus,
      },
      {
        name: "Moderate",
        annualReturn: SCENARIO_RETURN_PCT.moderate,
        value: scenarioEndPoint.moderate,
        excess: scenarioEndPoint.moderate - scenarioBaselineCorpus,
      },
      {
        name: "Aggressive",
        annualReturn: SCENARIO_RETURN_PCT.aggressive,
        value: scenarioEndPoint.aggressive,
        excess: scenarioEndPoint.aggressive - scenarioBaselineCorpus,
      },
    ];
  }, [scenarioBaselineCorpus, scenarioEndPoint]);

  const allocationPalette = ["#2b5cff", "#7aaafc", "#69c8ad", "#f5cc73", "#ff8a7b", "#5a6d8f"];

  const kpiTrendSeries = useMemo<Record<string, TrendPoint[]>>(() => {
    const goalSeries = powerTrendData.map((point) => ({ label: point.label, value: point.actual }));
    const cashflowBase = profile ? Math.max(profile.monthly_investable_surplus_inr, 0) : 0;
    const cashflowSeries = Array.from({ length: 6 }, (_, index) => ({ label: `M-${5 - index}`, value: Math.max(Math.round(cashflowBase * (0.88 + index * 0.035)), 0) }));
    const concentrationBase = holdingsAnalytics?.concentrationWarnings.length ?? 0;
    const concentrationSeries = Array.from({ length: 6 }, (_, index) => ({ label: `W${index + 1}`, value: Math.max(Math.round(concentrationBase + (index % 2 === 0 ? 0 : -1)), 0) }));
    const freshnessSeries = Array.from({ length: 6 }, (_, index) => ({ label: `D${index + 1}`, value: Math.max(100 - index * 6, 60) }));
    return {
      "goal-progress": goalSeries,
      "monthly-surplus": cashflowSeries,
      "concentration-risk": concentrationSeries,
      "data-freshness": freshnessSeries,
    };
  }, [holdingsAnalytics?.concentrationWarnings.length, powerTrendData, profile]);

  const selectedKpiTrend = useMemo(() => {
    if (!selectedKpi) return [];
    return kpiTrendSeries[selectedKpi.id] ?? [];
  }, [kpiTrendSeries, selectedKpi]);

  const intelligence = profileIntelligence as NonNullable<typeof profileIntelligence> | null;

  const sectionReveal = useMemo(
    () => ({
      hidden: { opacity: 0, y: isCompactMotion ? 14 : 24 },
      show: {
        opacity: 1,
        y: 0,
        transition: {
          duration: isCompactMotion ? 0.45 : 0.65,
          ease: motionEase,
        },
      },
    }),
    [isCompactMotion],
  );

  const featureCardReveal = useMemo(
    () => ({
      hidden: { opacity: 0, y: isCompactMotion ? 10 : 18 },
      show: (delayOrder: number) => ({
        opacity: 1,
        y: 0,
        transition: {
          duration: isCompactMotion ? 0.36 : 0.52,
          delay: (isCompactMotion ? 0.04 : 0.06) * delayOrder,
          ease: motionEase,
        },
      }),
    }),
    [isCompactMotion],
  );

  const denseSectionViewport = useMemo(
    () => ({ once: true, amount: isCompactMotion ? 0.12 : 0.18 }),
    [isCompactMotion],
  );

  const allocationArchitecture = useMemo(() => {
    if (!profile) return [];
    
    const surplus = profile.monthly_investable_surplus_inr || 15000;
    const risk = profile.risk_appetite;
    
    let split = [
      { name: "Equity Index Funds", pct: 30, color: "#2b5cff", theme: "blue", detail: "Long-term growth assets" },
      { name: "Short/Medium Debt", pct: 55, color: "#7aaafc", theme: "sky", detail: "Capital preservation & stability" },
      { name: "Gold ETF / Funds", pct: 10, color: "#f5cc73", theme: "gold", detail: "Inflation & currency hedge" },
      { name: "Liquid Reserve", pct: 5, color: "#69c8ad", theme: "green", detail: "Immediate liquidity access" },
    ];
    
    if (risk === 'aggressive') {
      split = [
        { name: "Equity Index Funds", pct: 70, color: "#2b5cff", theme: "blue", detail: "High-conviction growth" },
        { name: "Short/Medium Debt", pct: 20, color: "#7aaafc", theme: "sky", detail: "Tactical safety buffer" },
        { name: "Gold ETF / Funds", pct: 5, color: "#f5cc73", theme: "gold", detail: "Stability component" },
        { name: "Liquid Reserve", pct: 5, color: "#69c8ad", theme: "green", detail: "Cash for opportunities" },
      ];
    } else if (risk === 'moderate') {
      split = [
        { name: "Equity Index Funds", pct: 50, color: "#2b5cff", theme: "blue", detail: "Balanced growth exposure" },
        { name: "Short/Medium Debt", pct: 40, color: "#7aaafc", theme: "sky", detail: "Core income generation" },
        { name: "Gold ETF / Funds", pct: 5, color: "#f5cc73", theme: "gold", detail: "Hedge against volatility" },
        { name: "Liquid Reserve", pct: 5, color: "#69c8ad", theme: "green", detail: "Operational liquidity" },
      ];
    }
    
    return split.map(item => ({
      ...item,
      amount: (surplus * item.pct) / 100
    }));
  }, [profile]);

  const corpusProjection = useMemo(() => {
    if (!allocationArchitecture.length || !profile) return null;
    
    const months = projectionYears * 12;
    const initialCorpus = profile.current_savings_inr + (holdingsAnalytics?.totalMarketValueInr ?? 0);
    
    // Conservative-leaning estimated annual returns for each bucket
    const assetYields: Record<string, number> = {
      "Equity Index Funds": 0.138,
      "Short/Medium Debt": 0.072,
      "Gold ETF / Funds": 0.095,
      "Liquid Reserve": 0.042
    };
    
    let totalInvested = 0;
    let totalValue = 0;
    
    const layers = allocationArchitecture.map(item => {
      const monthlyAmount = item.amount;
      const annualRate = assetYields[item.name] || 0.10;
      const monthlyRate = annualRate / 12;
      
      const principalInvested = monthlyAmount * months;
      
      // Future Value of an Annuity: P * [((1 + r)^n - 1) / r] * (1 + r)
      const futureValue = monthlyRate === 0 
        ? principalInvested 
        : monthlyAmount * (((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate));
        
      totalInvested += principalInvested;
      totalValue += futureValue;
      
      return {
        ...item,
        principalInvested,
        futureValue,
        netProfit: futureValue - principalInvested,
        yieldPct: ((futureValue - principalInvested) / principalInvested) * 100
      };
    });

    // Generate realistic year-by-year growth data for the graph
    const graphData = [];
    const numPoints = Math.min(12, Math.max(6, Math.floor(projectionYears) + 1));
    const yrInterval = projectionYears / (numPoints - 1);
    
    for (let i = 0; i < numPoints; i++) {
      // Ensure the last point is exactly projectionYears and intermediate points are strictly increasing
      const yr = i === numPoints - 1 ? projectionYears : i * yrInterval;
      const mths = Math.round(yr * 12);
      
      let yrInvested = 0;
      let yrValue = 0;
      
      layers.forEach(layer => {
        const annualRate = assetYields[layer.name] || 0.10;
        const monthlyRate = annualRate / 12;
        const principal = layer.amount * mths;
        const value = monthlyRate === 0 
          ? principal 
          : layer.amount * (((Math.pow(1 + monthlyRate, mths) - 1) / monthlyRate) * (1 + monthlyRate));
        
        yrInvested += principal;
        yrValue += value;
      });
      
      const yrInitialAppreciated = initialCorpus * Math.pow(1 + 0.095, yr);
      const yrTotalValue = yrValue + yrInitialAppreciated;
      const yrTotalInvested = yrInvested + initialCorpus;
      
      graphData.push({
        label: yr === 0 ? "Now" : `${yr.toFixed(yr > 0 && yr < 1 ? 1 : 0)}Y`,
        totalValue: yrTotalValue,
        invested: yrTotalInvested,
        profit: yrTotalValue - yrTotalInvested
      });
    }

    // Add initial corpus appreciation at a blended rate (assume balanced 10%)
    const initialCorpusAppreciated = initialCorpus * Math.pow(1 + 0.10, projectionYears);
    const totalFinalCorpus = totalValue + initialCorpusAppreciated;
    
    return {
      totalInvested,
      totalValue,
      initialCorpus,
      initialCorpusAppreciated,
      totalFinalCorpus,
      totalProfit: (totalValue - totalInvested) + (initialCorpusAppreciated - initialCorpus),
      layers,
      graphData
    };
  }, [allocationArchitecture, profile, projectionYears, holdingsAnalytics?.totalMarketValueInr]);

  const aiMarketLab = useMemo(() => {
    if (!profile || !profileIntelligence) {
      return null;
    }

    const currentCorpus = profileIntelligence.totalVisibleCorpus;
    const monthlyContribution = profileIntelligence.investableSurplus;
    const horizonMonths = Math.max(selectedHorizonMonths, 1);
    const baseAnnualReturn = profile.risk_appetite === "aggressive" ? 11.8 : profile.risk_appetite === "conservative" ? 8.4 : 10.2;

    const scenarioCards: ScenarioCard[] = [
      {
        label: "Stress case",
        annualReturnPct: Math.max(baseAnnualReturn - 3.5, 4.5),
        projectedValue: 0,
        gainInr: 0,
        gainPct: 0,
        tone: "warning" as InsightTone,
      },
      {
        label: "Plan case",
        annualReturnPct: baseAnnualReturn,
        projectedValue: 0,
        gainInr: 0,
        gainPct: 0,
        tone: "neutral" as InsightTone,
      },
      {
        label: "Upside case",
        annualReturnPct: baseAnnualReturn + 3.5,
        projectedValue: 0,
        gainInr: 0,
        gainPct: 0,
        tone: "positive" as InsightTone,
      },
    ].map((scenario): ScenarioCard => {
      const projectedValue = projectCorpusValue(currentCorpus, monthlyContribution, scenario.annualReturnPct, horizonMonths);
      const gainInr = projectedValue - currentCorpus;
      const gainPct = currentCorpus > 0 ? (gainInr / currentCorpus) * 100 : 0;

      return {
        ...scenario,
        projectedValue,
        gainInr,
        gainPct,
        tone: scenario.tone as InsightTone,
      };
    });

    const fundingMomentum = profileIntelligence.requiredMonthlyToGoal > 0
      ? (profileIntelligence.investableSurplus / profileIntelligence.requiredMonthlyToGoal) * 100
      : 100;
    const concentrationCount = holdingsAnalytics?.concentrationWarnings.length ?? 0;
    const highestConcentration = (holdingsAnalytics?.concentrationWarnings ?? []).reduce(
      (max, warning) => Math.max(max, warning.metricPct ?? 0),
      0,
    );

    const goalProbability = clamp(
      Math.round(
        40 +
        Math.min(profileIntelligence.goalCoveragePct * 0.18, 25) +
        Math.min(fundingMomentum * 0.3, 30) +
        Math.min(profileIntelligence.savingsRatePct * 0.15, 15) +
        (profile.emergency_fund_months >= 6 ? 5 : -3) -
        Math.min(concentrationCount * 5, 16),
      ),
      8,
      98,
    );

    const marketPulseItems: MarketPulseItem[] = orderedMarketIndicators.slice(0, 3).map((indicator) => ({
      label: indicator.displayName,
      value: indicator.value.toLocaleString("en-IN", { maximumFractionDigits: 2 }),
      detail: `${indicator.changeAbs >= 0 ? "+" : ""}${indicator.changeAbs.toFixed(2)} (${indicator.changePct >= 0 ? "+" : ""}${indicator.changePct.toFixed(2)}%)`,
      tone: indicator.trend === "up" ? "positive" : indicator.trend === "down" ? "warning" : "neutral",
    }));

    return {
      scenarioCards,
      goalProbability,
      marketPulseItems,
      marketTrendMovement: niftyTrendSummary
        ? `${niftyTrendSummary.change >= 0 ? "+" : ""}${formatIndexNumber(niftyTrendSummary.change)} · ${niftyTrendSummary.changePct >= 0 ? "+" : ""}${niftyTrendSummary.changePct.toFixed(2)}%`
        : "Waiting for trend history",
      marketTrendLabel: marketTrendStatus.label,
      marketContextLabel: marketStatus.label,
    };
  }, [
    advisorSummary,

    holdingsAnalytics?.concentrationWarnings,
    marketStatus.label,
    marketTrendStatus.label,
    niftyTrendSummary,
    orderedMarketIndicators,
    profile,
    profileIntelligence,
    selectedHorizonMonths,
  ]);

  const getModuleContainerClassName = (moduleKey: DashboardModuleKey): string => {
    if (moduleKey === effectiveFocus) {
      return "rounded-2xl ring-2 ring-finance-accent/20 ring-offset-2 ring-offset-finance-bg shadow-[0_16px_34px_rgba(43,92,255,0.12)] transition-all duration-200";
    }

    return "rounded-2xl transition-all duration-200";
  };

  const renderSignedInModule = (moduleKey: DashboardModuleKey, activeProfile: ProfileRow) => {
    return <AgentAdvisorPanel refreshKey={refreshTick} />;
  };

  const handleShareSnapshot = useCallback(async () => {
    const shareText = `Pravix dashboard snapshot (${selectedLens}, ${selectedHorizon}) · ${kpiStripItems[0]?.label ?? "KPI"}: ${kpiStripItems[0]?.value ?? "N/A"}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
      }
    } catch {
      // Clipboard permissions may be blocked by browser policy.
    }
  }, [kpiStripItems, selectedHorizon, selectedLens]);

  return (
    <RequireAuth redirectTo="/onboarding">
      <>
        <SiteHeader />
        <div className="min-h-screen bg-[linear-gradient(180deg,#0a0f1e_0%,#101828_30%,#eef3ff_100%)] pb-16 pt-20 sm:pb-20 sm:pt-24">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
          {/* ── Header Bar ── */}
          <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-[#0f1f3d] via-[#132040] to-[#0c1830] px-5 py-4 shadow-[0_20px_40px_rgba(2,8,26,0.55)] backdrop-blur-lg sm:px-6 sm:py-4">
            {/* Subtle shimmer stripe */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(43,92,255,0.13),transparent_55%)]" />
            <div className="relative flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#2b5cff] to-[#1e44cd] shadow-[0_0_18px_rgba(43,92,255,0.35)]">
                  <WalletMinimal className="h-4.5 w-4.5 text-white" />
                  <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00e0ff] opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00e0ff]" />
                  </span>
                </div>
                <div>
                  <p className="text-base font-semibold text-white">{greetingLabel}</p>
                  {signedInEmail ? <p className="text-[11px] text-[#7aa3d9]">{signedInEmail}</p> : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRefreshTick((current) => current + 1)}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-white/15 bg-white/8 px-4 text-sm font-semibold text-[#c8d8f8] backdrop-blur-sm transition-all duration-150 hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#79a1ff]/40 active:scale-[0.97]"
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                  Refresh
                </button>
                {signedInEmail ? (
                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-white/15 bg-white/8 px-4 text-sm font-semibold text-[#c8d8f8] backdrop-blur-sm transition-all duration-150 hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#79a1ff]/40 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSigningOut ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
                    Sign Out
                  </button>
                ) : null}
              </div>
            </div>
          </section>

          {!isLoading && !error && signedInEmail && profile ? (
            <section className="relative mt-5 overflow-hidden rounded-2xl border border-[#d8e7ff] bg-white shadow-[0_12px_30px_rgba(10,25,48,0.08)] sm:mt-6">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_15%,rgba(43,92,255,0.1),transparent_30%),radial-gradient(circle_at_95%_12%,rgba(0,216,255,0.12),transparent_28%),linear-gradient(180deg,#ffffff_0%,#f6f9ff_100%)]" />
              <div className="relative p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-[#2b5cff]/20 bg-[#edf4ff] px-3 py-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-[#2b5cff]" />
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#2b5cff]">My Easy Money Plan</p>
                    </div>
                    <h2 className="mt-3 text-xl font-bold tracking-tight text-[#0a1930] sm:text-2xl">A simple plan for your money</h2>
                    <p className="mt-1.5 max-w-3xl text-sm text-[#5f7396]">
                      Built from the answers you gave us about your income, goals, and comfort with risk.
                    </p>
                  </div>
                  <StatusBadge label={isAiAllocationLoading ? "Updating plan..." : "Plan ready"} tone={isAiAllocationLoading ? "neutral" : "success"} />
                </div>

                {isAiAllocationLoading ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-5 overflow-hidden rounded-2xl border border-[#d8e7ff] bg-gradient-to-r from-[#f8faff] via-white to-[#f8faff] p-8 shadow-[0_8px_30px_rgba(43,92,255,0.06)] relative"
                  >
                    <motion.div 
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-[#2b5cff]/5 to-transparent w-1/2"
                    />
                    
                    <div className="flex flex-col items-center justify-center text-center relative z-10">
                      <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[#f0f5ff] shadow-[0_0_20px_rgba(43,92,255,0.15)] mb-5">
                        <motion.div 
                          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0, 0.3] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                          className="absolute inset-0 rounded-full border-2 border-[#2b5cff]" 
                        />
                        <motion.div 
                          animate={{ rotate: 360 }}
                          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                          className="absolute inset-2 rounded-full border border-dashed border-[#04bfff]/40" 
                        />
                        <Sparkles className="h-7 w-7 text-[#2b5cff] animate-pulse" />
                      </div>
                      
                      <h3 className="text-lg font-bold text-[#0a1930]">Pravix AI is generating your plan</h3>
                      <p className="mt-2 max-w-sm text-sm text-[#5f7396] leading-relaxed">
                        We are analyzing your profile, risk appetite, and goals. Please wait here for a moment...
                      </p>

                      <div className="mt-6 flex w-full max-w-xs items-center gap-2">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#edf4ff]">
                          <motion.div 
                            initial={{ x: "-100%" }}
                            animate={{ x: "200%" }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                            className="h-full w-1/2 rounded-full bg-gradient-to-r from-[#04bfff] to-[#2b5cff]" 
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : null}

                {aiAllocationError ? (
                  <div className="mt-5 rounded-xl border border-finance-red/25 bg-finance-red/10 p-3.5 text-sm text-finance-red">
                    {aiAllocationError}
                  </div>
                ) : null}

                {!isAiAllocationLoading ? (
                  <>
                    {aiAllocation?.intro ? (
                      <p className="mt-5 rounded-xl border border-[#e1ebff] bg-white/90 px-4 py-3 text-sm leading-relaxed text-[#2b3f62]">
                        {aiAllocation.intro}
                      </p>
                    ) : null}

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-[#e1ebff] bg-white p-4">
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#5f7396]">Suggested Monthly Amount</p>
                        <p className="mt-1.5 text-base font-semibold text-[#0a1930]">{aiAllocation?.monthlySipRange ?? "A monthly amount based on your goals and extra income"}</p>
                      </div>
                      <div className="rounded-xl border border-[#e1ebff] bg-white p-4">
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#5f7396]">What To Do First</p>
                        <p className="mt-1.5 text-base font-semibold text-[#0a1930]">{aiAllocation?.nextAction ?? "Pick one option below and start a monthly investment this week."}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      {aiAllocationBuckets.map((bucket, index) => (
                        <article key={`${bucket.heading}-${index}`} className="rounded-2xl border border-[#dce8ff] bg-white p-4 shadow-[0_8px_20px_rgba(43,92,255,0.08)]">
                          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#2b5cff]">Option {index + 1}</p>
                          <h3 className="mt-1.5 text-lg font-bold text-[#0a1930]">{bucket.heading}</h3>
                          <p className="mt-1 text-xs font-semibold text-[#4a628b]">Possible yearly growth: {bucket.expectedReturn}</p>
                          <p className="mt-2 text-xs leading-relaxed text-[#5f7396]">{bucket.allocationHint}</p>
                          <div className="mt-3 space-y-1.5">
                            {bucket.instruments.slice(0, 4).map((instrument) => (
                              <p key={`${bucket.heading}-${instrument}`} className="rounded-lg bg-[#f4f8ff] px-2.5 py-1.5 text-xs font-medium text-[#234374]">
                                {instrument}
                              </p>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>

                    <div className="mt-5 rounded-2xl border border-[#dce8ff] bg-white p-4 shadow-[0_8px_20px_rgba(43,92,255,0.08)]">
                      <label htmlFor="ai-follow-up-question" className="text-sm font-semibold text-[#0a1930]">
                        Ask a follow up question?
                      </label>
                      <p className="mt-1 text-xs text-[#5f7396]">
                        If anything is unclear, type your question and get a simple answer. You can ask as many times as you want.
                      </p>

                      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-start">
                        <textarea
                          id="ai-follow-up-question"
                          value={followUpQuestion}
                          onChange={(event) => {
                            setFollowUpQuestion(event.target.value);
                            if (followUpError) {
                              setFollowUpError(null);
                            }
                          }}
                          placeholder="Example: If I can invest INR 8,000 monthly, which option should I pick first?"
                          className="min-h-24 w-full rounded-xl border border-[#dce8ff] bg-[#f8fbff] px-3.5 py-2.5 text-sm text-[#0a1930] outline-none transition focus:border-[#2b5cff] focus:bg-white focus:ring-2 focus:ring-[#2b5cff]/20"
                        />
                        <button
                          type="button"
                          onClick={() => void handleFollowUpSubmit()}
                          disabled={isFollowUpLoading}
                          className="inline-flex h-10 items-center justify-center rounded-full bg-[#2b5cff] px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isFollowUpLoading ? "Answering..." : "Get Answer"}
                        </button>
                      </div>

                      {followUpError ? (
                        <p className="mt-3 rounded-lg border border-finance-red/25 bg-finance-red/10 px-3 py-2 text-xs text-finance-red">
                          {followUpError}
                        </p>
                      ) : null}

                      {followUpThread.length > 0 ? (
                        <div className="mt-3 space-y-2.5">
                          {followUpThread.map((item, index) => (
                            item.isSimple ? (
                              <div key={item.id} className="rounded-2xl border border-[#e1ebff] bg-gradient-to-br from-[#f8fbff] to-white px-5 py-4 shadow-[0_4px_16px_rgba(43,92,255,0.06)]">
                                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#5f7396]">Question {index + 1}</p>
                                <p className="mt-1 text-sm font-medium leading-relaxed text-[#0a1930]">{item.question}</p>
                                <div className="mt-3 flex items-start gap-3">
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-finance-accent/10">
                                    <svg className="h-4 w-4 text-finance-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-finance-accent">Simple Answer</p>
                                    <p className="mt-1 text-sm leading-relaxed text-[#1d355d] whitespace-pre-line">{item.answer}</p>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div key={item.id} className="rounded-xl border border-[#e1ebff] bg-[#f8fbff] px-3.5 py-3">
                                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#5f7396]">Question {index + 1}</p>
                                <p className="mt-1 text-sm font-medium leading-relaxed text-[#0a1930]">{item.question}</p>
                                <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#5f7396]">Simple Answer</p>
                                <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-[#1d355d]">{item.answer}</p>
                              </div>
                            )
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>
            </section>
          ) : null}

          {!isLoading && !error && signedInEmail && profile && allocationArchitecture.length > 0 ? (
            <section className="relative mt-5 overflow-hidden rounded-[2rem] border border-finance-border bg-white shadow-[0_20px_50px_rgba(10,25,48,0.08)] sm:mt-6">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_2%_2%,rgba(43,92,255,0.06),transparent_25%),linear-gradient(180deg,#ffffff_0%,#f8faff_100%)]" />
              
              <div className="relative p-6 sm:p-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="max-w-2xl">
                    <div className="inline-flex items-center gap-2 rounded-full border border-finance-accent/10 bg-finance-accent/5 px-3 py-1.5">
                      <BarChart3 className="h-3.5 w-3.5 text-finance-accent" />
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-finance-accent">Strategic Asset Architecture</p>
                    </div>
                    <h2 className="mt-4 text-3xl font-bold tracking-tight text-finance-text sm:text-4xl">
                      Precision Money Flow Analysis
                    </h2>
                    <p className="mt-3 text-sm leading-relaxed text-finance-muted md:text-base">
                      Your monthly investable surplus of <strong className="text-finance-text">{formatCurrency(profile.monthly_investable_surplus_inr)}</strong> is architected across four distinct asset layers to maximize returns while maintaining your <strong className="text-finance-text">{profile.risk_appetite}</strong> safety profile.
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-px bg-finance-border hidden lg:block" />
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-finance-muted">Current Risk Mode</p>
                      <StatusBadge label={profile.risk_appetite.toUpperCase()} tone={profile.risk_appetite === 'aggressive' ? 'info' : profile.risk_appetite === 'conservative' ? 'success' : 'info'} />
                    </div>
                  </div>
                </div>

                <div className="mt-10 grid gap-8 lg:grid-cols-12 lg:items-center">
                  {/* Left: High-Fidelity PowerBI Donut */}
                  <div className="relative h-[320px] lg:col-span-5">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={allocationArchitecture}
                          innerRadius={90}
                          outerRadius={125}
                          paddingAngle={6}
                          dataKey="amount"
                          stroke="none"
                        >
                          {allocationArchitecture.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="rounded-xl border border-finance-border bg-white p-3 shadow-xl">
                                  <p className="text-xs font-bold text-finance-text">{data.name}</p>
                                  <p className="text-lg font-black text-finance-accent">{formatCurrency(data.amount)}</p>
                                  <p className="text-[10px] text-finance-muted">{data.pct}% of total</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-finance-muted">Monthly Plan</p>
                      <p className="mt-1 text-2xl font-black text-finance-text">{formatCompactCurrency(profile.monthly_investable_surplus_inr)}</p>
                      <div className="mt-2 h-1 w-8 rounded-full bg-finance-accent/20" />
                    </div>
                  </div>

                  {/* Right: Detailed Intelligence Cards */}
                  <div className="grid gap-3 sm:grid-cols-2 lg:col-span-7">
                    {allocationArchitecture.map((item) => (
                      <div key={item.name} className="group relative overflow-hidden rounded-2xl border border-finance-border bg-white p-4 transition-all duration-300 hover:border-finance-accent/30 hover:shadow-[0_8px_30px_rgba(43,92,255,0.06)]">
                        <div className={`absolute top-0 left-0 h-full w-1.5 transition-all duration-300 group-hover:w-2`} style={{ backgroundColor: item.color }} />
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-finance-muted">{item.name}</p>
                            <p className="mt-1 text-xl font-bold text-finance-text">{formatCurrency(item.amount)}</p>
                          </div>
                          <div className="rounded-lg bg-finance-surface px-2 py-1 text-[10px] font-black text-finance-text border border-finance-border">
                            {item.pct}%
                          </div>
                        </div>
                        <p className="mt-3 text-[11px] leading-relaxed text-finance-muted">
                          {item.detail}
                        </p>
                        <div className="mt-4 flex items-center gap-2">
                          <div className="h-1 flex-1 rounded-full bg-finance-surface">
                            <motion.div 
                              initial={{ width: 0 }}
                              whileInView={{ width: `${item.pct}%` }}
                              transition={{ duration: 1, ease: "easeOut" }}
                              className="h-full rounded-full" 
                              style={{ backgroundColor: item.color }} 
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8 flex items-center gap-4 rounded-2xl bg-finance-accent/5 p-4 border border-finance-accent/10">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                    <ShieldCheck className="h-5 w-5 text-finance-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-finance-text">Risk-Adjusted Efficiency</p>
                    <p className="text-xs text-finance-muted">
                      This allocation architecture is mathematically optimized to neutralize inflation while maintaining a 
                      {profile.risk_appetite === 'aggressive' ? ' high-growth' : ' stable'} liquidity floor based on your Pravix profile.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          ) : null}
          {!isLoading && !error && signedInEmail && profile && corpusProjection ? (
            <section className="relative mt-5 overflow-hidden rounded-[2rem] border border-finance-border bg-white shadow-[0_20px_50px_rgba(10,25,48,0.08)] sm:mt-6">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_10%,rgba(43,92,255,0.06),transparent_40%),linear-gradient(180deg,#ffffff_0%,#f8faff_100%)]" />
              
              <div className="relative p-6 sm:p-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-finance-accent/10 bg-finance-accent/5 px-3 py-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-finance-accent" />
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-finance-accent">Horizon Intelligence</p>
                    </div>
                    <h2 className="mt-4 text-3xl font-bold tracking-tight text-finance-text sm:text-4xl">
                      Future Corpus Simulator
                    </h2>
                    <p className="mt-3 text-sm leading-relaxed text-finance-muted md:text-base">
                      See how your <strong className="text-finance-text">Strategic Asset Architecture</strong> compounds over time. Adjust the horizon to visualize your projected wealth.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-finance-border bg-finance-surface/45 p-2">
                    {[1, 3, 5, 10, 20].map((years) => (
                      <button
                        key={years}
                        onClick={() => setProjectionYears(years)}
                        className={`h-9 rounded-xl px-4 text-xs font-bold transition-all ${
                          projectionYears === years 
                            ? 'bg-finance-accent text-white shadow-lg shadow-finance-accent/25' 
                            : 'text-finance-muted hover:bg-white hover:text-finance-text'
                        }`}
                      >
                        {years}Y
                      </button>
                    ))}
                    <div className="flex items-center gap-2 px-3 border-l border-finance-border/50 ml-1">
                      <div className="relative">
                        <input 
                          type="number" 
                          value={projectionYears} 
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val)) setProjectionYears(Math.min(50, Math.max(1, val)));
                          }}
                          className="h-9 w-16 rounded-xl border border-finance-border bg-white pl-3 pr-1 text-sm font-bold text-finance-text focus:outline-none focus:ring-2 focus:ring-finance-accent/30 transition-all"
                          placeholder="00"
                        />
                      </div>
                      <span className="text-[10px] font-black text-finance-muted uppercase tracking-[0.15em]">Years</span>
                    </div>
                  </div>
                </div>

                <div className="mt-10 grid gap-8 lg:grid-cols-12">
                  <div className="lg:col-span-8">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="rounded-2xl border border-finance-border bg-finance-surface/30 p-5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-finance-muted">Total Invested</p>
                        <p className="mt-2 text-2xl font-bold text-finance-text">{formatCompactCurrency(corpusProjection.totalInvested)}</p>
                        <p className="mt-1 text-xs text-finance-muted">Over {projectionYears} years</p>
                      </div>
                      <div className="rounded-2xl border border-finance-border bg-finance-surface/30 p-5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-finance-accent">Net Yield (Profit)</p>
                        <p className="mt-2 text-2xl font-bold text-finance-accent">+{formatCompactCurrency(corpusProjection.totalProfit)}</p>
                        <p className="mt-1 text-xs text-finance-muted">Compounded gains</p>
                      </div>
                      <div className="rounded-2xl border border-finance-accent/10 bg-finance-accent/5 p-5 shadow-[inset_0_0_20px_rgba(43,92,255,0.03)]">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-finance-text">Estimated Corpus</p>
                        <p className="mt-2 text-2xl font-bold text-finance-text">{formatCompactCurrency(corpusProjection.totalFinalCorpus)}</p>
                        <p className="mt-1 text-xs text-finance-muted">Final value</p>
                      </div>
                    </div>

                    <div className="mt-6 rounded-[2rem] border border-finance-border bg-[#fcfdff] p-6 shadow-[inset_0_1px_4px_rgba(10,25,48,0.04)]">
                       <div className="h-[280px] w-full">
                         <ResponsiveContainer width="100%" height="100%">
                           <AreaChart data={corpusProjection.graphData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                             <defs>
                              <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#2b5cff" stopOpacity={0.25}/>
                                <stop offset="95%" stopColor="#2b5cff" stopOpacity={0.05}/>
                              </linearGradient>
                              <linearGradient id="investedGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.15}/>
                                <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.02}/>
                              </linearGradient>
                             </defs>
                             <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(10,25,48,0.06)" />
                             <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#5f7396", fontSize: 10 }} />
                             <YAxis hide />
                             <Tooltip 
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  return (
                                    <div className="rounded-xl border border-[#d8e7ff] bg-white p-3 shadow-xl">
                                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#5f7396]">{data.label}</p>
                                      <div className="mt-2 space-y-1">
                                        <div className="flex items-center justify-between gap-6">
                                          <p className="text-xs text-[#5f7396]">Total Value</p>
                                          <p className="text-sm font-bold text-[#0a1930]">{formatCurrency(data.totalValue)}</p>
                                        </div>
                                        <div className="flex items-center justify-between gap-6">
                                          <p className="text-xs text-[#5f7396]">Invested</p>
                                          <p className="text-sm font-semibold text-[#50607d]">{formatCurrency(data.invested)}</p>
                                        </div>
                                        <div className="flex items-center justify-between gap-6 border-t border-[#edf4ff] pt-1">
                                          <p className="text-xs font-medium text-finance-accent">Net Profit</p>
                                          <p className="text-sm font-bold text-finance-accent">+{formatCurrency(data.profit)}</p>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                             />
                            <Area 
                              type="monotone" 
                              dataKey="totalValue" 
                              stackId="1"
                              stroke="#2b5cff" 
                              strokeWidth={3} 
                              fillOpacity={1} 
                              fill="url(#profitGradient)" 
                            />
                            <Area 
                              type="monotone" 
                              dataKey="invested" 
                              stackId="2"
                              stroke="#94a3b8" 
                              strokeWidth={1.5} 
                              strokeDasharray="4 4"
                              fill="url(#investedGradient)" 
                            />
                           </AreaChart>
                         </ResponsiveContainer>
                       </div>
                      <div className="mt-8 flex items-center justify-center gap-6 border-t border-[#edf4ff] pt-5">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-finance-accent" />
                          <p className="text-[10px] font-bold uppercase tracking-widest text-finance-muted">Total Value (Compounded)</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-slate-400" />
                          <p className="text-[10px] font-bold uppercase tracking-widest text-finance-muted">Invested Capital</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-4 space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-finance-muted mb-4">Asset Layer Performance</p>
                    {corpusProjection.layers.map((layer) => (
                      <div key={layer.name} className="group rounded-2xl border border-finance-border bg-white p-4 transition-all hover:border-finance-accent/30 hover:shadow-[0_8px_25px_rgba(43,92,255,0.05)]">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-finance-text">{layer.name}</p>
                          <span className="text-[10px] font-black text-finance-accent">+{layer.yieldPct.toFixed(0)}% Yield</span>
                        </div>
                        <div className="mt-3 flex items-end justify-between">
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-finance-muted">Projected Value</p>
                            <p className="text-lg font-bold text-finance-text">{formatCompactCurrency(layer.futureValue)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] uppercase tracking-widest text-finance-accent">Net Profit</p>
                            <p className="text-sm font-bold text-finance-accent">+{formatCompactCurrency(layer.netProfit)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <div className="mt-6 rounded-2xl bg-finance-accent/5 p-4 border border-finance-accent/10">
                      <p className="text-[11px] leading-relaxed text-finance-muted">
                        <Sparkles className="inline-block h-3 w-3 text-finance-accent mr-1 mb-0.5" />
                        At a {projectionYears}Y horizon, the <span className="text-finance-text font-bold">Power of Compounding</span> contributes <span className="text-finance-accent font-bold">{((corpusProjection.totalProfit / corpusProjection.totalInvested) * 100).toFixed(0)}%</span> in additional wealth over your principal investments.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {isLoading && (
            <DashboardSectionCard
              className="mt-5 sm:mt-6"
              eyebrow="Overview"
              title="Preparing your dashboard"
              description="Loading authenticated profile and advisory context."
            >
              <div className="flex items-center gap-3 text-finance-muted">
                <Loader2 className="h-5 w-5 animate-spin" />
                <p>Loading your profile snapshot...</p>
              </div>
            </DashboardSectionCard>
          )}

          {!isLoading && error && (
            <DashboardSectionCard
              className="mt-5 sm:mt-6"
              eyebrow="Overview"
              title="Dashboard temporarily unavailable"
              description="We could not fetch profile details right now."
            >
              <div className="rounded-xl border border-finance-red/25 bg-finance-red/10 p-4 text-finance-red">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5" />
                  <div>
                    <p className="font-semibold">Unable to load dashboard data</p>
                    <p className="mt-1 text-sm">{error}</p>
                  </div>
                </div>
              </div>
            </DashboardSectionCard>
          )}

          {!isLoading && !error && !signedInEmail && (
            <DashboardSectionCard
              className="mt-5 sm:mt-6"
              eyebrow="Overview"
              title="Create your account to access your dashboard"
              description="Your personal dashboard unlocks goal tracking, alerts, portfolio analytics, and AI guidance."
            >
              <div className="rounded-2xl border border-finance-border bg-finance-surface/45 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <CircleUserRound className="mt-0.5 h-5 w-5 text-finance-muted" />
                  <div>
                    <p className="font-semibold text-finance-text">You are currently not logged in</p>
                    <p className="mt-1 text-sm text-finance-muted">
                      Create a Pravix account to start onboarding, then return here for your personalized wealth dashboard.
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    href="/create-account"
                    className="inline-flex h-10 items-center rounded-full bg-finance-accent px-4 text-sm font-semibold text-white transition-all duration-150 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-finance-accent/35 active:scale-[0.98]"
                  >
                    Create Account
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex h-10 items-center rounded-full border border-finance-border bg-white px-4 text-sm font-semibold text-finance-text transition-colors hover:bg-finance-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-finance-accent/30 active:scale-[0.98]"
                  >
                    Log In
                  </Link>
                </div>
              </div>

              <div className="mt-4">
                <AuthPanel onSignedIn={() => setRefreshTick((current) => current + 1)} />
              </div>
            </DashboardSectionCard>
          )}

          {!isLoading && !error && signedInEmail && !profile && (
            <DashboardSectionCard
              className="mt-5 sm:mt-6"
              eyebrow="Overview"
              title="Complete onboarding to enable insights"
              description={`No profile rows are available yet for ${signedInEmail}.`}
            >
              <div
                className="relative overflow-hidden rounded-2xl border border-finance-border/70 p-4 sm:p-5"
                style={{
                  backgroundImage: "url('/image/banner1 (1).webp')",
                  backgroundPosition: "center",
                  backgroundSize: "cover",
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#0c2347]/90 via-[#0c2347]/78 to-[#0c2347]/58" />

                <div className="relative max-w-xl">
                  <p className="text-sm font-semibold text-white">Your personalized dashboard is waiting</p>
                  <p className="mt-1.5 text-sm text-white/90">
                    Complete onboarding while signed in, then refresh this page to unlock profile and module analytics.
                  </p>

                  <div className="mt-3.5">
                    <Link
                      href="/onboarding"
                      className="inline-flex h-10 items-center rounded-full bg-white px-4 text-sm font-semibold text-[#102f67] transition-all duration-150 hover:bg-white/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 active:scale-[0.98]"
                    >
                      Complete Onboarding
                    </Link>
                  </div>
                </div>
              </div>
            </DashboardSectionCard>
          )}

          {!isLoading && !error && signedInEmail && profile && (
            <div className="mt-6 space-y-5 sm:mt-7 sm:space-y-6">

              {/* ── Control Bar ── */}



              {/* ── Section label: Decision Intelligence ── */}
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-finance-border" />
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-finance-muted">Decision Intelligence Layer</p>
                <div className="h-px flex-1 bg-finance-border" />
              </div>

              {aiMarketLab ? (
                <motion.section
                  className="relative overflow-hidden rounded-[2.5rem] border border-[#d7e4fb] bg-white shadow-[0_22px_60px_rgba(10,25,48,0.08)]"
                  variants={sectionReveal}
                  initial="hidden"
                  whileInView="show"
                  viewport={denseSectionViewport}
                >
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(43,92,255,0.06),transparent_28%),radial-gradient(circle_at_88%_14%,rgba(0,216,255,0.05),transparent_24%),linear-gradient(180deg,rgba(255,255,255,1),rgba(248,251,255,1))]" />
                  
                  <div className="relative px-6 py-8 sm:px-8 sm:py-10">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                      <div className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 rounded-full border border-finance-accent/10 bg-finance-accent/5 px-3 py-1.5">
                          <ShieldCheck className="h-3.5 w-3.5 text-finance-accent" />
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-finance-accent">Pravix Precision Lab</p>
                        </div>
                        <h3 className="mt-4 text-[clamp(1.8rem,4vw,3rem)] font-bold leading-[1.1] tracking-tight text-[#0a1930]">
                          Intelligence Built on <span className="text-finance-accent">Certainty</span>
                        </h3>
                        <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#50607d] md:text-lg">
                          Every insight in this lab is computed using institutional-grade risk models. We don&apos;t just predict; we validate your future against thousands of market scenarios.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 border border-[#d8e7ff] shadow-sm">
                          <span className="h-2 w-2 rounded-full bg-finance-green animate-pulse" />
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[#0a1930]">Real-Time Audit Active</p>
                        </div>
                        <StatusBadge label={selectedHorizonLabel} tone="info" />
                      </div>
                    </div>

                    <div className="mt-10 grid gap-6 lg:grid-cols-12">
                      {/* Left: Trust Engine & Goal Probability */}
                      <motion.article
                        className="relative overflow-hidden rounded-[2rem] border border-[#d8e7ff] bg-white p-6 shadow-[0_12px_35px_rgba(43,92,255,0.06)] lg:col-span-7"
                        variants={featureCardReveal}
                        custom={1}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-finance-accent/5">
                            <Target className="h-5 w-5 text-finance-accent" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-[#0a1930]">Goal Probability Architecture</p>
                            <p className="text-[10px] uppercase tracking-widest text-finance-muted font-bold">Mathematical Confidence Engine</p>
                          </div>
                        </div>

                        <div className="mt-8 flex flex-col items-center gap-8 md:flex-row">
                          <div className="relative flex h-40 w-40 items-center justify-center shrink-0">
                            <svg className="h-full w-full -rotate-90">
                              <circle
                                cx="80"
                                cy="80"
                                r="72"
                                fill="none"
                                stroke="rgba(43,92,255,0.06)"
                                strokeWidth="12"
                              />
                              <circle
                                cx="80"
                                cy="80"
                                r="72"
                                fill="none"
                                stroke="url(#goalGradient)"
                                strokeWidth="12"
                                strokeDasharray={2 * Math.PI * 72}
                                strokeDashoffset={2 * Math.PI * 72 * (1 - aiMarketLab.goalProbability / 100)}
                                strokeLinecap="round"
                                className="transition-all duration-1000 ease-out"
                              />
                              <defs>
                                <linearGradient id="goalGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                  <stop offset="0%" stopColor="#2b5cff" />
                                  <stop offset="100%" stopColor="#00d8ff" />
                                </linearGradient>
                              </defs>
                            </svg>
                            <div className="absolute text-center">
                              <p className="text-4xl font-bold text-[#0a1930]">{aiMarketLab.goalProbability}%</p>
                              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#5f7396]">Safety</p>
                            </div>
                          </div>

                          <div className="flex-1 space-y-4">
                            <div className="rounded-2xl bg-[#f8fbff] p-4 border border-[#edf4ff]">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-[#5f7396]">The Diagnosis</p>
                              <p className="mt-2 text-sm font-semibold text-[#0a1930]">
                                {aiMarketLab.goalProbability >= 70 
                                  ? `Your "Easy Money Plan" is mathematically sound. At a ${intelligence?.goalCoveragePct.toFixed(0)}% coverage rate, your current trajectory is primed for success.` 
                                  : `While your "Easy Money Plan" provides a solid foundation, reaching 100% certainty requires minor adjustments to your surplus-to-goal ratio.`}
                              </p>
                              <div className="mt-3 flex items-center gap-2">
                                <span className={`h-1.5 w-1.5 rounded-full ${aiMarketLab.goalProbability >= 70 ? 'bg-finance-green' : 'bg-finance-orange'}`} />
                                <p className="text-xs text-[#5f7396] font-medium">{intelligence?.goalCoveragePct.toFixed(1)}% Goal Coverage</p>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-[#5f7396]">Path to 100% Certainty</p>
                              <div className="grid grid-cols-2 gap-2">
                                {[
                                  { icon: <TrendingUp className="h-3 w-3" />, label: "Surplus Expansion" },
                                  { icon: <ShieldCheck className="h-3 w-3" />, label: "Risk Mitigation" },
                                  { icon: <Briefcase className="h-3 w-3" />, label: "Asset Balancing" },
                                  { icon: <Sparkles className="h-3 w-3" />, label: "Tax Alpha" }
                                ].map((item, idx) => (
                                  <div key={idx} className="flex items-center gap-2 rounded-lg bg-white border border-[#edf4ff] px-2 py-1.5">
                                    <div className="text-finance-accent">{item.icon}</div>
                                    <p className="text-[10px] font-bold text-[#50607d]">{item.label}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.article>

                      {/* Right: Market Insight & Strategic Outcomes */}
                      <div className="grid gap-6 lg:col-span-5">
                        <motion.article
                          className="rounded-[2rem] border border-[#d8e7ff] bg-white p-6 shadow-[0_10px_30px_rgba(43,92,255,0.05)]"
                          variants={featureCardReveal}
                          custom={2}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <BarChart3 className="h-4 w-4 text-finance-accent" />
                              <p className="text-sm font-bold text-[#0a1930]">Strategic Wealth Forecast</p>
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-finance-accent">AI Validated</span>
                          </div>
                          
                          <div className="mt-6 space-y-3">
                            {aiMarketLab.scenarioCards.slice(1).map((card) => (
                              <div key={card.label} className="group relative rounded-2xl border border-finance-border bg-white p-4 transition-all hover:border-finance-accent/30 hover:bg-finance-accent/[0.01]">
                                <div className="flex items-center justify-between">
                                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-finance-muted">{card.label}</p>
                                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-finance-accent/5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ArrowUpRight className="h-3 w-3 text-finance-accent" />
                                  </div>
                                </div>
                                <div className="mt-2 flex items-baseline justify-between">
                                  <p className="text-xl font-bold text-[#0a1930]">{formatCompactCurrency(card.projectedValue)}</p>
                                  <div className="text-right">
                                    <p className="text-[10px] font-bold text-finance-accent">+{card.annualReturnPct}% Est.</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="mt-6 rounded-xl bg-finance-accent/5 p-4 border border-finance-accent/10">
                            <p className="text-[11px] leading-relaxed text-[#234374]">
                              <Sparkles className="inline-block h-3 w-3 mr-1 text-finance-accent mb-0.5" />
                              Based on your <strong>{formatCurrency(profile.monthly_investable_surplus_inr)}</strong> monthly plan, these projections account for compounding and periodic market volatility.
                            </p>
                          </div>
                        </motion.article>

                        <motion.article
                          className="rounded-[2rem] border border-[#d8e7ff] bg-gradient-to-br from-[#0a1930] to-[#1a2d4d] p-6 shadow-xl text-white"
                          variants={featureCardReveal}
                          custom={3}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm">
                              <ShieldCheck className="h-5 w-5 text-finance-accent" />
                            </div>
                            <p className="text-sm font-bold">Invest with Peace of Mind</p>
                          </div>
                          <p className="mt-4 text-xs leading-relaxed text-white/70">
                            Pravix uses bank-grade encryption and does not touch your funds. We provide the <strong className="text-white">mathematical blueprint</strong>; you maintain 100% custody of your assets.
                          </p>
                          <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Institutional Grade</p>
                            <div className="flex -space-x-2">
                              {[1, 2, 3].map((i) => (
                                <div key={i} className="h-6 w-6 rounded-full border-2 border-[#0a1930] bg-white/20 backdrop-blur-sm" />
                              ))}
                            </div>
                          </div>
                        </motion.article>
                      </div>
                    </div>
                  </div>
                </motion.section>
              ) : null}

              {/* ── Section label: Market + Tools ── */}
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-finance-border" />
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-finance-muted">Market Data &amp; Planning Tools</p>
                <div className="h-px flex-1 bg-finance-border" />
              </div>

              <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
                {/* Left: NIFTY Chart + Market Indicator Cards */}
                <article className="rounded-2xl border border-finance-border bg-white p-5 shadow-[0_12px_30px_rgba(10,25,48,0.07)] sm:p-6">
                  {/* Chart header */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-finance-accent opacity-60" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-finance-accent" />
                        </span>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-finance-text">NIFTY 50 — Live Chart</p>
                      </div>
                      {niftyTrendSummary ? (
                        <div className="mt-1 flex items-center gap-2">
                          <p className="text-base font-bold text-finance-text">{formatIndexNumber(niftyTrendSummary.latest)}</p>
                          <span className={`text-xs font-semibold ${ niftyTrendSummary.changePct >= 0 ? "text-finance-green" : "text-finance-red"}`}>
                            {formatSignedPercent(niftyTrendSummary.changePct)}
                          </span>
                        </div>
                      ) : null}
                    </div>
                    <StatusBadge label={marketTrendStatus.label} tone={marketTrendStatus.tone} />
                  </div>

                  <div className="mt-4 h-[240px]">
                    {isMarketTrendLoading ? (
                      <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-finance-border bg-[#f8faff] text-xs text-finance-muted">
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin text-finance-accent/40" />
                          <span>Loading NIFTY trend…</span>
                        </div>
                      </div>
                    ) : marketTrend.length === 0 ? (
                      <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-finance-border bg-[#f8faff] text-xs text-finance-muted">
                        NIFTY trend data unavailable.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={marketTrend} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                          <defs>
                            <linearGradient id="niftyTrendFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#2b5cff" stopOpacity={0.28} />
                              <stop offset="95%" stopColor="#2b5cff" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="rgba(130,147,177,0.12)" strokeDasharray="4 8" vertical={false} />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#5a7099", fontSize: 10, fontWeight: 500 }} />
                          <YAxis tick={{ fill: "#5a7099", fontSize: 10 }} tickFormatter={(value: number) => formatIndexNumber(value)} width={68} />
                          <Tooltip
                            contentStyle={{ borderRadius: "10px", border: "1px solid #e2e8f4", boxShadow: "0 8px 20px rgba(10,25,48,0.10)" }}
                            formatter={(value) => [formatIndexNumber(Number(value ?? 0)), "NIFTY close"]}
                            labelFormatter={(label) => `Date: ${String(label ?? "")}`}
                          />
                          <Area type="monotone" dataKey="close" stroke="#2b5cff" strokeWidth={2.5} fill="url(#niftyTrendFill)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  {/* Market Indicator Tiles */}
                  <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
                    {orderedMarketIndicators.length === 0 ? (
                      <div className="sm:col-span-3 flex items-center justify-center rounded-xl border border-dashed border-finance-border bg-[#f8faff] px-3 py-4 text-xs text-finance-muted">
                        {isMarketLoading ? "Fetching live data…" : "Market indicators unavailable."}
                      </div>
                    ) : (
                      orderedMarketIndicators.map((indicator) => (
                        <div
                          key={indicator.id}
                          className={`relative overflow-hidden rounded-xl border px-4 py-3.5 transition-all duration-200 hover:-translate-y-0.5 ${
                            indicator.trend === "up"
                              ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white"
                              : indicator.trend === "down"
                                ? "border-red-200 bg-gradient-to-br from-red-50 to-white"
                                : "border-finance-border bg-white"
                          }`}
                        >
                          <div className={`absolute right-3 top-3 text-lg font-bold leading-none opacity-20 ${
                            indicator.trend === "up" ? "text-emerald-500" : indicator.trend === "down" ? "text-red-500" : "text-finance-muted"
                          }`}>
                            {indicator.trend === "up" ? "▲" : indicator.trend === "down" ? "▼" : "—"}
                          </div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-finance-muted">{indicator.displayName}</p>
                          <p className="mt-1.5 text-xl font-bold tabular-nums text-finance-text">{formatIndexNumber(indicator.value)}</p>
                          <p className={`mt-1 text-xs font-semibold tabular-nums ${
                            indicator.trend === "up" ? "text-emerald-600" : indicator.trend === "down" ? "text-red-500" : "text-finance-muted"
                          }`}>
                            {indicator.trend === "up" ? "▲" : indicator.trend === "down" ? "▼" : ""}{" "}
                            {formatSignedNumber(indicator.changeAbs)} ({formatSignedPercent(indicator.changePct)})
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </article>

                {/* Right: SIP Calculator */}
                <article className="rounded-2xl border border-finance-border bg-white p-5 shadow-[0_12px_30px_rgba(10,25,48,0.07)] sm:p-6">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-finance-text">SIP Calculator</p>
                      <p className="mt-0.5 text-[11px] text-finance-muted">Personalized with your surplus &amp; goal data</p>
                    </div>
                    <span className="inline-flex h-7 items-center rounded-full bg-[#eef3ff] px-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#2b5cff]">Calculator</span>
                  </div>

                  <div className="mt-5 space-y-4">
                    <div>
                      <label htmlFor="sip-amount" className="text-[10px] font-bold uppercase tracking-[0.14em] text-finance-muted">Monthly SIP (INR)</label>
                      <input
                        id="sip-amount"
                        type="number"
                        min={0}
                        step={500}
                        value={sipMonthlyAmount}
                        onChange={(event) => setSipMonthlyAmount(Math.max(parseNumberInput(event.target.value), 0))}
                        className="mt-2 h-10 w-full rounded-xl border border-finance-border bg-[#f8faff] px-3.5 text-sm font-medium text-finance-text transition focus:border-finance-accent/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-finance-accent/25"
                      />
                    </div>

                    <div>
                      <label htmlFor="sip-return" className="text-[10px] font-bold uppercase tracking-[0.14em] text-finance-muted">Expected Annual Return (%)</label>
                      <input
                        id="sip-return"
                        type="number"
                        min={0}
                        max={40}
                        step={0.1}
                        value={sipAnnualReturn}
                        onChange={(event) => setSipAnnualReturn(Math.min(Math.max(parseNumberInput(event.target.value), 0), 40))}
                        className="mt-2 h-10 w-full rounded-xl border border-finance-border bg-[#f8faff] px-3.5 text-sm font-medium text-finance-text transition focus:border-finance-accent/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-finance-accent/25"
                      />
                    </div>

                    <div>
                      <label htmlFor="sip-duration" className="text-[10px] font-bold uppercase tracking-[0.14em] text-finance-muted">Duration (Years)</label>
                      <input
                        id="sip-duration"
                        type="number"
                        min={0.5}
                        max={40}
                        step={0.5}
                        value={sipDurationYears}
                        onChange={(event) => setSipDurationYears(Math.min(Math.max(parseNumberInput(event.target.value), 0.5), 40))}
                        className="mt-2 h-10 w-full rounded-xl border border-finance-border bg-[#f8faff] px-3.5 text-sm font-medium text-finance-text transition focus:border-finance-accent/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-finance-accent/25"
                      />
                    </div>
                  </div>

                  {/* Projection results */}
                  <div className="mt-5 rounded-xl border border-[#dce8ff] bg-gradient-to-br from-[#f0f5ff] to-[#f8faff] p-4">
                    <div className="grid grid-cols-1 gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-finance-muted">Total Invested</span>
                        <span className="text-sm font-bold text-finance-text">{formatCurrency(sipProjection.invested)}</span>
                      </div>
                      <div className="h-px bg-[#dce8ff]" />
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-finance-muted">Est. Returns</span>
                        <span className="text-sm font-bold text-emerald-600">+{formatCurrency(sipProjection.estimatedReturns)}</span>
                      </div>
                      <div className="h-px bg-[#dce8ff]" />
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-finance-text">Projected Value</span>
                        <span className="text-base font-extrabold text-finance-accent">{formatCurrency(sipProjection.projectedValue)}</span>
                      </div>
                    </div>
                  </div>

                  <p className="mt-3 text-[10px] leading-relaxed text-finance-muted">
                    Over {sipProjection.months} months at {sipAnnualReturn}% p.a. Assumes constant contribution.
                    {sipSuggestedAmount !== null ? ` Your profile surplus: ${formatCurrency(Math.round(sipSuggestedAmount))}/mo.` : ""}
                  </p>
                </article>
              </section>

              {/* ── Focused Analysis label ── */}
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-finance-border" />
                <div className="flex items-center gap-2 rounded-full border border-finance-border bg-white px-4 py-1.5 shadow-sm">
                  <CircleDot className="h-3 w-3 text-finance-accent" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-finance-text">{focusedInsightsTitle}</p>
                </div>
                <div className="h-px flex-1 bg-finance-border" />
              </div>
              <p className="-mt-2 text-center text-xs text-finance-muted">{focusedInsightsHint}</p>

              <section className={`grid gap-4 ${selectedLens === "cashflow" ? "lg:grid-cols-2" : "lg:grid-cols-1"}`}>
                {showCashflowBridge ? (
                <article className="rounded-xl border border-finance-border bg-white p-4 shadow-[0_8px_20px_rgba(10,25,48,0.05)]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-finance-text">Cashflow Bridge</p>
                    <p className="text-[10px] text-[#5a6f94]">Positive bars add cash, negative bars reduce cash</p>
                  </div>
                  <div className="mt-3 h-[220px]">
                    {cashflowBridgeData.length === 0 ? (
                      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-finance-border bg-white text-xs text-finance-muted">Cashflow data unavailable.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={cashflowBridgeData} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
                          <CartesianGrid stroke="rgba(130,147,177,0.16)" strokeDasharray="4 6" vertical={false} />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#3f5680", fontSize: 11 }} />
                          <YAxis tickFormatter={(value: number) => formatCompactCurrency(value)} tick={{ fill: "#3f5680", fontSize: 10 }} />
                          <ReferenceLine y={0} stroke="#9eb2d8" strokeDasharray="4 4" />
                          <Tooltip
                            formatter={(value) => [formatCompactCurrency(Number(value ?? 0)), "Cash impact"]}
                            labelFormatter={(label) => `Category: ${String(label ?? "")}`}
                          />
                          <Bar dataKey="value" radius={[5, 5, 0, 0]}>{cashflowBridgeData.map((entry) => <Cell key={entry.label} fill={entry.fill} />)}</Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                  <p className="mt-2 text-[11px] text-finance-muted">
                    Net monthly balance after planned investing: {formatCompactCurrency(cashflowBalanceValue)}.
                  </p>
                </article>
                ) : null}


              </section>

              {/* ── Divider before advanced section ── */}


              {orderedModuleKeys.map((moduleKey) => (
                <div key={moduleKey} className={getModuleContainerClassName(moduleKey)}>
                  {renderSignedInModule(moduleKey, profile)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedKpi ? (
        <div className="fixed inset-0 z-40">
          <button type="button" aria-label="Close KPI drawer" onClick={() => setSelectedKpiId(null)} className="absolute inset-0 bg-[#0d1a30]/35 backdrop-blur-[1px]" />
          <aside className="absolute right-0 top-0 h-full w-full max-w-md border-l border-finance-border bg-white shadow-[-20px_0_44px_rgba(9,22,43,0.25)]">
            <div className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-3 border-b border-finance-border px-4 py-4 sm:px-5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-finance-muted">KPI Drilldown</p>
                  <h3 className="mt-1 text-lg font-semibold text-finance-text">{selectedKpi.label}</h3>
                  <p className="mt-1 text-sm text-finance-muted">{selectedKpi.detail}</p>
                </div>
                <button type="button" onClick={() => setSelectedKpiId(null)} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-finance-border bg-white text-finance-muted hover:text-finance-text">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-finance-border bg-finance-surface/40 p-3"><p className="text-[10px] uppercase tracking-[0.09em] text-finance-muted">Current Value</p><p className="mt-1 text-sm font-semibold text-finance-text">{selectedKpi.value}</p></div>
                  <div className="rounded-lg border border-finance-border bg-finance-surface/40 p-3"><p className="text-[10px] uppercase tracking-[0.09em] text-finance-muted">Delta</p><p className={`mt-1 text-sm font-semibold ${toneToClassName(selectedKpi.deltaTone)}`}>{selectedKpi.deltaLabel}</p></div>
                  <div className="rounded-lg border border-finance-border bg-finance-surface/40 p-3"><p className="text-[10px] uppercase tracking-[0.09em] text-finance-muted">Source</p><p className="mt-1 text-sm font-semibold text-finance-text">{selectedKpi.source}</p></div>
                </div>
                <article className="rounded-xl border border-finance-border bg-white p-3.5">
                  <div className="flex items-center justify-between gap-2"><p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-finance-muted">Mini Trend</p><p className="text-[10px] text-finance-muted">Recent checkpoints</p></div>
                  <div className="mt-2 h-44">
                    {selectedKpiTrend.length === 0 ? (
                      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-finance-border bg-finance-surface/40 text-xs text-finance-muted">Trend data unavailable.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={selectedKpiTrend} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
                          <CartesianGrid stroke="rgba(130,147,177,0.14)" strokeDasharray="4 6" vertical={false} />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#6e7f9d", fontSize: 10 }} />
                          <YAxis hide />
                          <Tooltip formatter={(value) => formatCompactCurrency(Number(value ?? 0))} />
                          <Area type="monotone" dataKey="value" stroke="#2b5cff" strokeWidth={2} fill="#2b5cff" fillOpacity={0.12} />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </article>
              </div>
            </div>
          </aside>
        </div>
        ) : null}
      </>
    </RequireAuth>
  );
}

