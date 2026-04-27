"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AuthPanel from "@/components/AuthPanel";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Loader2,
  Rocket,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  UserRound,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ONBOARDING_QUESTIONNAIRE_FLOW, type OnboardingField, type OnboardingScreen } from "@/lib/onboarding/questionnaire-flow";

type FieldValue = string | boolean | string[];
type Answers = Record<string, FieldValue>;

type ExistingSessionRow = {
  id: string;
  current_screen_id: string | null;
};

type PersistedResponseRow = {
  response_data: Record<string, unknown> | null;
};

type SubmitResult = {
  profile_id?: string;
  session_id?: string;
  status?: string;
};

type ScreenVisual = {
  icon: LucideIcon;
  eyebrow: string;
  accentClass: string;
};

const FLOW = ONBOARDING_QUESTIONNAIRE_FLOW;
const TOTAL_STEPS = FLOW.length;

const SCREEN_VISUALS: Record<string, ScreenVisual> = {
  welcome: {
    icon: Sparkles,
    eyebrow: "Quick Setup",
    accentClass: "from-[#2b5cff] via-[#2563eb] to-[#00b8ff]",
  },
  primary_goal: {
    icon: Target,
    eyebrow: "Step 1",
    accentClass: "from-[#355ef7] via-[#4f6bff] to-[#2cc9ff]",
  },
  target_goal: {
    icon: Trophy,
    eyebrow: "Step 2",
    accentClass: "from-[#2f54d9] via-[#3f66f3] to-[#00b7ff]",
  },
  time_horizon: {
    icon: Clock3,
    eyebrow: "Step 3",
    accentClass: "from-[#3855d3] via-[#5572ff] to-[#4bc8ff]",
  },
  monthly_capacity: {
    icon: Wallet,
    eyebrow: "Step 4",
    accentClass: "from-[#2746ca] via-[#4766f5] to-[#00b0ff]",
  },
  risk_preference: {
    icon: ShieldCheck,
    eyebrow: "Step 5",
    accentClass: "from-[#2e54dd] via-[#4f6ef5] to-[#22c7ff]",
  },
  financial_snapshot: {
    icon: BarChart3,
    eyebrow: "Step 6",
    accentClass: "from-[#3057de] via-[#5a79ff] to-[#3ec6ff]",
  },
  contact_details: {
    icon: UserRound,
    eyebrow: "Final Step",
    accentClass: "from-[#2d4fe0] via-[#4565f5] to-[#16b9ff]",
  },
};

function getScreenVisual(screenId: string): ScreenVisual {
  return (
    SCREEN_VISUALS[screenId] ?? {
      icon: Sparkles,
      eyebrow: "Onboarding",
      accentClass: "from-[#2b5cff] via-[#2563eb] to-[#00b8ff]",
    }
  );
}

function compactStepTitle(title: string): string {
  const plain = title.replace(/[^A-Za-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const words = plain.split(" ").filter(Boolean);
  return words.slice(0, 3).join(" ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildInitialAnswers(): Answers {
  const initial: Answers = {};

  for (const screen of FLOW) {
    for (const field of screen.fields) {
      initial[field.key] = field.type === "multi_choice" ? [] : "";
    }
  }

  return initial;
}

function normalizeFieldValue(field: OnboardingField, value: FieldValue): string | number | boolean | string[] | null {
  if (field.type === "multi_choice") {
    if (!Array.isArray(value)) {
      return [];
    }

    const normalized = value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0);

    return normalized;
  }

  if (field.type === "choice" || field.type === "text" || field.type === "email" || field.type === "phone") {
    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (field.type === "number" || field.type === "currency") {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function coercePersistedFieldValue(field: OnboardingField, rawValue: unknown): FieldValue | undefined {
  if (field.type === "multi_choice") {
    if (Array.isArray(rawValue)) {
      return rawValue
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
    }

    if (typeof rawValue === "string") {
      return rawValue
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
    }

    return undefined;
  }

  if (typeof rawValue === "string") {
    return rawValue;
  }

  if (typeof rawValue === "number") {
    return String(rawValue);
  }

  if (typeof rawValue === "boolean") {
    return String(rawValue);
  }

  return undefined;
}

function hydrateAnswersFromResponses(baseAnswers: Answers, rows: PersistedResponseRow[]): Answers {
  const hydrated: Answers = { ...baseAnswers };
  const fieldByKey = new Map<string, OnboardingField>();

  for (const screen of FLOW) {
    for (const field of screen.fields) {
      fieldByKey.set(field.key, field);
    }
  }

  for (const row of rows) {
    if (!isRecord(row.response_data)) {
      continue;
    }

    for (const [key, rawValue] of Object.entries(row.response_data)) {
      const field = fieldByKey.get(key);
      if (!field) {
        continue;
      }

      const coercedValue = coercePersistedFieldValue(field, rawValue);
      if (coercedValue !== undefined) {
        hydrated[key] = coercedValue;
      }
    }
  }

  return hydrated;
}

function getStepIndexByScreenId(screenId: string | null): number {
  if (!screenId) {
    return 0;
  }

  const index = FLOW.findIndex((screen) => screen.id === screenId);
  return index >= 0 ? index : 0;
}

function isFieldVisible(field: OnboardingField, answers: Answers): boolean {
  if (!field.showWhen) {
    return true;
  }

  const candidate = answers[field.showWhen.key];

  if (Array.isArray(candidate)) {
    return candidate.includes(String(field.showWhen.equals));
  }

  return candidate === field.showWhen.equals;
}

function getVisibleFields(screen: OnboardingScreen, answers: Answers): OnboardingField[] {
  return screen.fields.filter((field) => isFieldVisible(field, answers));
}

function validateField(field: OnboardingField, value: FieldValue): string | null {
  if (field.type === "multi_choice") {
    const selected = Array.isArray(value) ? value : [];
    if (field.required && selected.length === 0) {
      return `${field.label} is required.`;
    }

    return null;
  }

  if (typeof value !== "string") {
    return `Invalid value for ${field.label}.`;
  }

  const trimmed = value.trim();

  if (field.required && !trimmed) {
    return `${field.label} is required.`;
  }

  if (!trimmed) {
    return null;
  }

  if (field.type === "email") {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(trimmed)) {
      return `Please provide a valid email for ${field.label}.`;
    }
  }

  if (field.type === "phone") {
    const phonePattern = /^[+0-9()\-\s]{8,20}$/;
    if (!phonePattern.test(trimmed)) {
      return `Please provide a valid phone number for ${field.label}.`;
    }
  }

  if (field.type === "number" || field.type === "currency") {
    const parsed = Number(trimmed.replace(/,/g, ""));
    if (!Number.isFinite(parsed)) {
      return `${field.label} must be a valid number.`;
    }

    if (field.min !== undefined && parsed < field.min) {
      return `${field.label} must be at least ${field.min}.`;
    }

    if (field.max !== undefined && parsed > field.max) {
      return `${field.label} must be at most ${field.max}.`;
    }
  }

  return null;
}

function isAuthSessionMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("auth session missing") || normalized.includes("session expired") || normalized.includes("authentication session expired");
}

export default function OnboardingForm() {
  const [answers, setAnswers] = useState<Answers>(() => buildInitialAnswers());
  const [currentStep, setCurrentStep] = useState(0);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [didResumeSession, setDidResumeSession] = useState(false);
  const [isAuthenticatedUser, setIsAuthenticatedUser] = useState(false);
  // Store the password used at account creation for fallback sign-in
  const [authPassword, setAuthPassword] = useState<string>("");
  const [emailVerificationCode, setEmailVerificationCode] = useState("");
  const [emailVerificationSent, setEmailVerificationSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [emailVerificationError, setEmailVerificationError] = useState<string | null>(null);
  const [emailVerificationMessage, setEmailVerificationMessage] = useState<string | null>(null);

  const currentScreen = FLOW[currentStep];
  const currentScreenVisual = getScreenVisual(currentScreen.id);
  const CurrentScreenIcon = currentScreenVisual.icon;
  const visibleFields = useMemo(() => getVisibleFields(currentScreen, answers), [currentScreen, answers]);
  const isLastStep = currentStep === TOTAL_STEPS - 1;
  const completionPercent = Math.round(((currentStep + 1) / TOTAL_STEPS) * 100);

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      setIsInitializing(true);
      setSubmitError(null);

      try {
        const supabase = getSupabaseBrowserClient();
        const [{ data: userData, error: userError }, { data: authSessionData, error: authSessionError }] =
          await Promise.all([supabase.auth.getUser(), supabase.auth.getSession()]);

        if (userError) {
          throw userError;
        }

        if (authSessionError) {
          throw authSessionError;
        }

        if (!userData.user || !authSessionData.session) {
          if (isMounted) {
            setSessionId(null);
            setAuthRequired(false);
            setDidResumeSession(false);
            setIsAuthenticatedUser(false);
            setEmailVerified(false);
          }
          return;
        }

        let activeSessionId: string;
        let activeStep = 0;
        let hydratedAnswers = buildInitialAnswers();

        const { data: existingSessionData, error: existingSessionError } = await supabase
          .from("onboarding_sessions")
          .select("id,current_screen_id")
          .eq("user_id", userData.user.id)
          .eq("status", "in_progress")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingSessionError) {
          throw existingSessionError;
        }

        const existingSession = (existingSessionData ?? null) as ExistingSessionRow | null;

        if (existingSession) {
          activeSessionId = existingSession.id;
          activeStep = getStepIndexByScreenId(existingSession.current_screen_id);

          const { data: responseRowsData, error: responseRowsError } = await supabase
            .from("onboarding_responses")
            .select("response_data")
            .eq("session_id", existingSession.id)
            .order("submitted_at", { ascending: true });

          if (responseRowsError) {
            throw responseRowsError;
          }

          hydratedAnswers = hydrateAnswersFromResponses(hydratedAnswers, (responseRowsData ?? []) as PersistedResponseRow[]);

          if (isMounted) {
            setDidResumeSession(true);
          }
        } else {
          const { data: onboardingSession, error: onboardingSessionError } = await supabase
            .from("onboarding_sessions")
            .insert({
              current_screen_id: FLOW[0].id,
              metadata: {
                flow_version: "goal_flow_v2",
                total_steps: TOTAL_STEPS,
              },
            })
            .select("id")
            .single();

          if (onboardingSessionError) {
            throw onboardingSessionError;
          }

          activeSessionId = onboardingSession.id;

          if (isMounted) {
            setDidResumeSession(false);
          }
        }

        const authEmail =
          typeof userData.user.email === "string" && userData.user.email.length > 0 ? userData.user.email : null;

        if (authEmail && typeof hydratedAnswers.email === "string" && hydratedAnswers.email.trim().length === 0) {
          hydratedAnswers.email = authEmail;
        }

        if (isMounted) {
          setSessionId(activeSessionId);
          setCurrentStep(activeStep);
          setAnswers(hydratedAnswers);
          setAuthRequired(false);
          setIsAuthenticatedUser(true);
          setEmailVerified(true);
        }
      } catch (error) {
        if (isMounted) {
          const message = error instanceof Error ? error.message : "We could not start onboarding.";
          setSubmitError(message);
        }
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    }

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  function getFieldValue(field: OnboardingField): FieldValue {
    return answers[field.key] ?? (field.type === "multi_choice" ? [] : "");
  }

  function setFieldValue(field: OnboardingField, value: FieldValue) {
    setAnswers((previous) => ({
      ...previous,
      [field.key]: value,
    }));

    if (field.key === "email") {
      setEmailVerificationSent(false);
      setEmailVerified(false);
      setEmailVerificationCode("");
      setEmailVerificationError(null);
      setEmailVerificationMessage(null);
    }
  }

  async function sendEmailVerification() {
    const emailValue = typeof answers.email === "string" ? answers.email.trim().toLowerCase() : "";

    if (!emailValue || !emailValue.includes("@")) {
      setEmailVerificationError("Please enter a valid email address first.");
      return;
    }

    if (authPassword.trim().length < 6) {
      setEmailVerificationError("Create a password with at least 6 characters.");
      return;
    }

    setIsSendingVerification(true);
    setEmailVerificationError(null);
    setEmailVerificationMessage(null);

    try {
      const registerResponse = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailValue, password: authPassword }),
      });

      const registerPayload = (await registerResponse.json().catch(() => ({}))) as {
        error?: string;
        verificationMode?: string;
      };

      if (!registerResponse.ok) {
        throw new Error(registerPayload.error ?? "Unable to create account right now.");
      }

      if (registerPayload.verificationMode === "supabase-email") {
        setEmailVerificationMessage("Account created. Verify from your Supabase email, then sign in to continue.");
        return;
      }

      const verifySendResponse = await fetch("/api/auth/send-verification-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailValue }),
      });

      const verifySendPayload = (await verifySendResponse.json().catch(() => ({}))) as { error?: string; message?: string };

      if (!verifySendResponse.ok) {
        throw new Error(verifySendPayload.error ?? "Unable to send verification code.");
      }

      setEmailVerificationSent(true);
      setEmailVerificationMessage(verifySendPayload.message ?? "Verification code sent to your email.");
    } catch (error) {
      setEmailVerificationError(error instanceof Error ? error.message : "Unable to send verification code.");
    } finally {
      setIsSendingVerification(false);
    }
  }

  async function confirmEmailVerification() {
    const emailValue = typeof answers.email === "string" ? answers.email.trim().toLowerCase() : "";
    const token = emailVerificationCode.trim();

    if (!emailValue || !emailValue.includes("@")) {
      setEmailVerificationError("Please enter a valid email address first.");
      return;
    }

    if (token.length !== 6) {
      setEmailVerificationError("Enter the 6-digit verification code.");
      return;
    }

    setIsVerifyingEmail(true);
    setEmailVerificationError(null);
    setEmailVerificationMessage(null);

    try {
      // Always use the password from account creation for fallback sign-in
      const passwordToUse = authPassword ?? (typeof answers.password === "string" ? answers.password : "");
      if (!passwordToUse) {
        throw new Error("Password is required for verification.");
      }
      const verifyResponse = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: emailValue, 
          token, 
          password: passwordToUse 
        }),
      });

      const verifyPayload = (await verifyResponse.json().catch(() => ({}))) as { 
        error?: string; 
        session?: { access_token?: string; refresh_token?: string } 
      };
      
      if (!verifyResponse.ok) {
        const errorMsg = verifyPayload.error ?? "Verification failed.";
        
        // If it's already verified, we can try to sign in directly as a fallback
        if (errorMsg === "Email already verified") {
          const supabase = getSupabaseBrowserClient();
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: emailValue,
            password: passwordToUse,
          });

          if (signInError) {
            throw signInError;
          }
        } else {
          throw new Error(errorMsg);
        }
      }

      if (verifyPayload.session?.access_token && verifyPayload.session.refresh_token) {
        const supabase = getSupabaseBrowserClient();
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: verifyPayload.session.access_token,
          refresh_token: verifyPayload.session.refresh_token,
        });

        if (sessionError) {
          throw sessionError;
        }
      }

      setEmailVerified(true);
      setIsAuthenticatedUser(true);
      setAuthRequired(false);
      setSubmitError(null);
      setEmailVerificationMessage("Email verified and account created. You can now submit your plan.");
    } catch (error) {
      setEmailVerificationError(error instanceof Error ? error.message : "Verification failed.");
    } finally {
      setIsVerifyingEmail(false);
    }
  }

  function toggleMultiChoiceValue(field: OnboardingField, optionValue: string) {
    const current = getFieldValue(field);
    const list = Array.isArray(current) ? current : [];

    if (list.includes(optionValue)) {
      setFieldValue(
        field,
        list.filter((entry) => entry !== optionValue),
      );
      return;
    }

    setFieldValue(field, [...list, optionValue]);
  }

  function getCurrentScreenPayload() {
    return Object.fromEntries(
      currentScreen.fields.map((field) => [field.key, normalizeFieldValue(field, getFieldValue(field))]),
    );
  }

  function buildAllAnswersPayload() {
    const entries: Array<[string, string | number | boolean | string[] | null]> = [];

    for (const screen of FLOW) {
      for (const field of screen.fields) {
        entries.push([field.key, normalizeFieldValue(field, getFieldValue(field))]);
      }
    }

    return Object.fromEntries(entries);
  }

  async function createOnboardingSession() {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("onboarding_sessions")
      .insert({
        current_screen_id: currentScreen.id,
        metadata: {
          flow_version: "goal_flow_v2",
          total_steps: TOTAL_STEPS,
        },
      })
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    return data.id as string;
  }

  async function persistCurrentScreen() {
    if (!sessionId) {
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const responseData = getCurrentScreenPayload();

    const { error: deleteError } = await supabase
      .from("onboarding_responses")
      .delete()
      .eq("session_id", sessionId)
      .eq("screen_id", currentScreen.id);

    if (deleteError) {
      throw deleteError;
    }

    const { error: insertError } = await supabase.from("onboarding_responses").insert({
      session_id: sessionId,
      screen_id: currentScreen.id,
      response_data: responseData,
    });

    if (insertError) {
      throw insertError;
    }

    const nextScreenId = isLastStep ? currentScreen.id : FLOW[currentStep + 1].id;
    const { error: updateSessionError } = await supabase
      .from("onboarding_sessions")
      .update({ current_screen_id: nextScreenId })
      .eq("id", sessionId);

    if (updateSessionError) {
      throw updateSessionError;
    }
  }

  async function submitFinalPayload(activeSessionId: string) {
    const supabase = getSupabaseBrowserClient();
    const { data: authSessionData, error: authSessionError } = await supabase.auth.getSession();

    if (authSessionError) {
      throw authSessionError;
    }

    const accessToken = authSessionData.session?.access_token;
    if (!accessToken) {
      throw new Error("Authentication session expired. Please sign in again.");
    }

    const response = await fetch("/api/onboarding/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        sessionId: activeSessionId,
        answers: buildAllAnswersPayload(),
      }),
    });

    const responseBody = (await response.json().catch(() => ({}))) as {
      error?: string;
      result?: SubmitResult;
    };

    if (!response.ok) {
      throw new Error(responseBody.error ?? "Final onboarding submit failed.");
    }

    setSubmitResult(responseBody.result ?? null);
  }

  async function submitToFormspree(allAnswers: Record<string, any>) {
    const FORMSPREE_ENDPOINT =
      process.env.NEXT_PUBLIC_FORMSPREE_FORM_ENDPOINT ??
      (process.env.NEXT_PUBLIC_FORMSPREE_FORM_ID
        ? `https://formspree.io/f/${process.env.NEXT_PUBLIC_FORMSPREE_FORM_ID}`
        : null);

    if (!FORMSPREE_ENDPOINT) {
      console.warn("Formspree not configured. Set NEXT_PUBLIC_FORMSPREE_FORM_ID or NEXT_PUBLIC_FORMSPREE_FORM_ENDPOINT.");
      return;
    }

    // Helper to format values for readability
    const format = (val: any) => (Array.isArray(val) ? val.join(", ") : String(val || "N/A"));

    // We create a "pretty" version of the keys so the email receiver sees clear labels
    const prettyData = {
      "Full Name": allAnswers.full_name,
      "Email Address": allAnswers.email,
      "Mobile Number": allAnswers.phone_e164,
      "Primary Financial Goal": format(allAnswers.primary_financial_goal),
      "Target Amount Choice": format(allAnswers.target_goal_amount_choice),
      "Custom Target Amount": allAnswers.target_goal_custom_amount_inr ? `₹${allAnswers.target_goal_custom_amount_inr}` : "N/A",
      "Time Horizon": format(allAnswers.time_horizon_band),
      "Monthly Investment Capacity": format(allAnswers.monthly_investment_capacity_band),
      "Risk Preference": format(allAnswers.risk_preference),
      "Monthly Income": format(allAnswers.monthly_income_band),
      "Has Existing Investments": format(allAnswers.has_existing_investments),
      "Investment Types": format(allAnswers.existing_investment_types),
    };

    try {
      await fetch(FORMSPREE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          _subject: `💎 New Pravix Investor: ${allAnswers.full_name || "Lead"}`,
          ...prettyData,
          "_Metadata": "Submitted via Pravix Onboarding Flow",
          "_Timestamp": new Date().toLocaleString("en-IN"),
        }),
      });
    } catch (err) {
      console.error("Formspree submission error:", err);
    }
  }

  async function handleNext() {
    setSubmitError(null);

    for (const field of visibleFields) {
      const validationMessage = validateField(field, getFieldValue(field));
      if (validationMessage) {
        setSubmitError(validationMessage);
        return;
      }
    }

    if (isLastStep) {
      if (!isAuthenticatedUser && !emailVerified) {
        setSubmitError("Please verify your email before generating your plan.");
        return;
      }

      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
        error: authSessionError,
      } = await supabase.auth.getSession();

      if (authSessionError) {
        setSubmitError(null);
        setAuthRequired(true);
        return;
      }

      if (!session?.access_token) {
        setSubmitError("Please verify and sign in to continue.");
        setAuthRequired(true);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      await persistCurrentScreen();

      if (isLastStep) {
        let activeSessionId = sessionId;

        if (!activeSessionId) {
          activeSessionId = await createOnboardingSession();
          setSessionId(activeSessionId);
        }

        const allAnswers = buildAllAnswersPayload();
        await Promise.allSettled([
          submitFinalPayload(activeSessionId),
          submitToFormspree(allAnswers),
        ]);

        setSubmitSuccess(true);
        setAuthRequired(false);
      } else {
        setCurrentStep((previous) => previous + 1);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "We could not save this onboarding step.";
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleBack() {
    setSubmitError(null);
    setCurrentStep((previous) => Math.max(0, previous - 1));
  }

  function renderField(field: OnboardingField) {
    const value = getFieldValue(field);
    const sharedInputClass =
      "w-full rounded-2xl border border-[#d2dff7] bg-white/95 px-3.5 text-finance-text shadow-[0_6px_16px_rgba(18,42,90,0.06)] outline-none transition-all focus:border-[#5676ff] focus:ring-4 focus:ring-[#7ea5ff]/20";

    if (field.key === "email") {
      return (
        <div key={field.key} className="flex flex-col gap-2.5">
          <label className="flex flex-col gap-2.5">
            <span className="text-sm font-semibold text-finance-text">
              {field.label}
              {field.required ? " *" : ""}
            </span>
            <input
              type="email"
              value={typeof value === "string" ? value : ""}
              onChange={(event) => setFieldValue(field, event.target.value)}
              placeholder={field.placeholder}
              className={`h-12 ${sharedInputClass}`}
            />
          </label>

          {!isAuthenticatedUser ? (
            <div className="rounded-2xl border border-[#d2dff7] bg-[#f8fbff] p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-finance-muted">Verify Email To Create Account</p>

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className="text-xs font-semibold text-finance-text">Create Password *</span>
                  <input
                    type="password"
                    value={authPassword}
                    onChange={(event) => setAuthPassword(event.target.value)}
                    placeholder="Minimum 6 characters"
                    className={`h-11 ${sharedInputClass}`}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => void sendEmailVerification()}
                  disabled={isSendingVerification}
                  className="inline-flex h-11 items-center justify-center rounded-full bg-gradient-to-r from-[#2b5cff] to-[#1d4ed8] px-4 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {isSendingVerification ? "Sending..." : "Verify Email"}
                </button>

                {emailVerificationSent ? (
                  <div className="flex gap-2 sm:col-span-2">
                    <input
                      type="text"
                      value={emailVerificationCode}
                      onChange={(event) => setEmailVerificationCode(event.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                      placeholder="Enter 6-digit code"
                      className="h-11 w-full rounded-2xl border border-[#d2dff7] bg-white/95 px-3.5 text-finance-text shadow-[0_6px_16px_rgba(18,42,90,0.06)] outline-none transition-all focus:border-[#5676ff] focus:ring-4 focus:ring-[#7ea5ff]/20"
                    />
                    <button
                      type="button"
                      onClick={() => void confirmEmailVerification()}
                      disabled={isVerifyingEmail}
                      className="inline-flex h-11 items-center justify-center rounded-full border border-[#b8ccf7] bg-white px-4 text-sm font-semibold text-finance-text disabled:opacity-60"
                    >
                      {isVerifyingEmail ? "Checking..." : "Confirm"}
                    </button>
                  </div>
                ) : null}
              </div>

              {emailVerificationError ? <p className="mt-2 text-xs font-medium text-[#b64040]">{emailVerificationError}</p> : null}
              {emailVerificationMessage ? <p className="mt-2 text-xs font-medium text-[#3158cc]">{emailVerificationMessage}</p> : null}
              {emailVerified ? <p className="mt-2 text-xs font-semibold text-[#0d8f4f]">Email verified successfully.</p> : null}
            </div>
          ) : null}

          {field.helpText ? <span className="text-xs text-finance-muted">{field.helpText}</span> : null}
        </div>
      );
    }

    if (field.type === "choice") {
      const selected = typeof value === "string" ? value : "";

      return (
        <div key={field.key} className="flex flex-col gap-2.5 md:col-span-2">
          <span className="text-sm font-semibold text-finance-text">
            {field.label}
            {field.required ? " *" : ""}
          </span>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {(field.options ?? []).map((option) => {
              const isSelected = selected === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFieldValue(field, option.value)}
                  className={`group rounded-2xl border px-3.5 py-3 text-left text-sm font-semibold transition-all duration-200 ${
                    isSelected
                      ? "border-transparent bg-gradient-to-br from-[#2b5cff] via-[#4d6fff] to-[#00beff] text-white shadow-[0_14px_26px_rgba(43,92,255,0.28)]"
                      : "border-[#d4e2fb] bg-white text-finance-text shadow-[0_8px_18px_rgba(18,42,90,0.06)] hover:-translate-y-0.5 hover:border-[#8aa8ff] hover:shadow-[0_12px_24px_rgba(35,74,177,0.14)]"
                  }`}
                >
                  <span className="block leading-relaxed">{option.label}</span>
                </button>
              );
            })}
          </div>
          {field.helpText ? <span className="text-xs text-finance-muted">{field.helpText}</span> : null}
        </div>
      );
    }

    if (field.type === "multi_choice") {
      const selected = Array.isArray(value) ? value : [];

      return (
        <div key={field.key} className="flex flex-col gap-2.5 md:col-span-2">
          <span className="text-sm font-semibold text-finance-text">
            {field.label}
            {field.required ? " *" : ""}
          </span>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {(field.options ?? []).map((option) => {
              const isSelected = selected.includes(option.value);

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleMultiChoiceValue(field, option.value)}
                  className={`rounded-2xl border px-3.5 py-3 text-left text-sm font-semibold transition-all duration-200 ${
                    isSelected
                      ? "border-[#3d67ff] bg-[#eff4ff] text-[#1f49d9] shadow-[0_10px_20px_rgba(43,92,255,0.14)]"
                      : "border-[#d4e2fb] bg-white text-finance-text shadow-[0_8px_18px_rgba(18,42,90,0.06)] hover:-translate-y-0.5 hover:border-[#8aa8ff]"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          {field.helpText ? <span className="text-xs text-finance-muted">{field.helpText}</span> : null}
        </div>
      );
    }

    const inputType =
      field.type === "currency" || field.type === "number"
        ? "number"
        : field.type === "phone"
          ? "tel"
          : field.type === "email"
            ? "email"
            : "text";

    return (
      <label key={field.key} className="flex flex-col gap-2.5">
        <span className="text-sm font-semibold text-finance-text">
          {field.label}
          {field.required ? " *" : ""}
        </span>
        <input
          type={inputType}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => setFieldValue(field, event.target.value)}
          placeholder={field.placeholder}
          min={field.min}
          max={field.max}
          step={field.step ?? (field.type === "currency" ? 0.01 : undefined)}
          className={`h-12 ${sharedInputClass}`}
        />
        {field.helpText ? <span className="text-xs text-finance-muted">{field.helpText}</span> : null}
      </label>
    );
  }

  const primaryActionLabel = isSubmitting
    ? "Saving..."
    : currentScreen.ctaLabel ?? (isLastStep ? "Get My Plan" : "Save and Continue");

  if (isInitializing) {
    return (
      <section className="relative overflow-hidden rounded-[28px] border border-white/65 bg-gradient-to-br from-white via-[#f3f8ff] to-[#eaf2ff] p-7 shadow-[0_22px_45px_rgba(16,47,103,0.16)] md:p-9">
        <div className="pointer-events-none absolute -left-14 -top-14 h-44 w-44 rounded-full bg-[#7aa8ff]/35 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-14 -right-14 h-44 w-44 rounded-full bg-[#45d0ff]/35 blur-3xl" />
        <div className="relative flex items-center gap-3 text-finance-text">
          <Loader2 className="h-5 w-5 animate-spin text-finance-accent" />
          <p className="text-sm font-medium">Preparing your premium onboarding experience...</p>
        </div>
      </section>
    );
  }

  if (authRequired) {
    return (
      <section className="relative overflow-hidden rounded-[28px] border border-white/65 bg-gradient-to-br from-white via-[#f3f8ff] to-[#eaf2ff] p-7 shadow-[0_22px_45px_rgba(16,47,103,0.16)] md:p-9">
        <div className="pointer-events-none absolute -left-12 -top-12 h-40 w-40 rounded-full bg-[#8caeff]/35 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -right-12 h-40 w-40 rounded-full bg-[#56d3ff]/35 blur-3xl" />

        <div className="relative rounded-2xl border border-[#d2dff7] bg-white/92 p-5 shadow-[0_14px_28px_rgba(16,47,103,0.1)]">
          <p className="text-sm font-semibold text-finance-text">Finish by signing in</p>
          <p className="mt-2 text-sm leading-relaxed text-finance-muted">
            Your answers are already filled in. Sign in or create an account here to save them and generate your plan.
          </p>
          <div className="mt-5">
            <AuthPanel
              defaultEmail={typeof answers.email === "string" && answers.email.trim().length > 0 ? answers.email : null}
              onSignedIn={() => void handleNext()}
            />
          </div>
        </div>
      </section>
    );
  }

  if (submitSuccess) {
    return (
      <section className="relative overflow-hidden rounded-[30px] border border-white/60 bg-gradient-to-br from-[#173e9f] via-[#2b5cff] to-[#00b9ff] p-7 text-white shadow-[0_22px_48px_rgba(16,47,103,0.3)] md:p-9">
        <div className="pointer-events-none absolute -left-10 top-4 h-36 w-36 rounded-full bg-white/18 blur-2xl" />
        <div className="pointer-events-none absolute -right-10 bottom-4 h-36 w-36 rounded-full bg-white/18 blur-2xl" />

        <div className="relative flex items-start gap-3">
          <div className="rounded-xl border border-white/30 bg-white/10 p-2.5">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/80">Plan Generated</p>
            <h3 className="mt-1 text-2xl font-semibold">Your Financial Plan is Ready!</h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/90">
              Beautiful work. Based on your answers, Pravix can now build a strategy crafted around your goals, risk comfort,
              and monthly investment capacity.
            </p>
            {submitResult?.profile_id ? <p className="mt-2 text-xs text-white/80">Profile id: {submitResult.profile_id}</p> : null}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href="/dashboard"
                className="inline-flex h-10 items-center rounded-full bg-white px-4 text-sm font-semibold text-[#133b93] shadow-[0_10px_18px_rgba(12,33,86,0.2)] hover:bg-white/95"
              >
                Open My Dashboard
              </Link>
              <Link
                href="/learn"
                className="inline-flex h-10 items-center rounded-full border border-white/40 bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/15"
              >
                Continue to Learn
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-[30px] border border-white/65 bg-gradient-to-br from-white via-[#f6faff] to-[#edf4ff] p-6 shadow-[0_24px_52px_rgba(16,47,103,0.18)] md:p-8">
      <div className="pointer-events-none absolute -left-14 -top-16 h-44 w-44 rounded-full bg-[#8baeff]/35 blur-3xl" />
      <div className="pointer-events-none absolute -right-14 top-20 h-44 w-44 rounded-full bg-[#67d7ff]/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-36 w-36 rounded-full bg-[#d2e2ff]/35 blur-3xl" />

      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#cfddf8] bg-white/90 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-finance-muted shadow-[0_8px_16px_rgba(16,47,103,0.08)]">
            <Sparkles className="h-3.5 w-3.5 text-finance-accent" />
            Pravix Crafted Flow
          </div>

          <div className="inline-flex items-center rounded-full border border-[#cfddf8] bg-white/90 px-3 py-1 text-xs font-semibold text-finance-text shadow-[0_8px_16px_rgba(16,47,103,0.08)]">
            Step {currentStep + 1} / {TOTAL_STEPS}
          </div>
        </div>

        <div className="mt-4 overflow-x-auto pb-1">
          <div className="flex min-w-max items-center gap-2">
            {FLOW.map((screen, index) => {
              const visual = getScreenVisual(screen.id);
              const StepIcon = visual.icon;
              const isActive = index === currentStep;
              const isDone = index < currentStep;

              return (
                <div
                  key={screen.id}
                  className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition-all ${
                    isActive
                      ? "border-transparent bg-gradient-to-r from-[#2b5cff] to-[#00bbff] text-white shadow-[0_10px_20px_rgba(43,92,255,0.28)]"
                      : isDone
                        ? "border-[#a8c0f5] bg-[#eff5ff] text-[#2b5cff]"
                        : "border-[#d5e2fa] bg-white/90 text-finance-muted"
                  }`}
                >
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                      isActive ? "bg-white/18" : isDone ? "bg-[#dbe7ff]" : "bg-[#eef3ff]"
                    }`}
                  >
                    {isDone ? "✓" : index + 1}
                  </span>
                  <StepIcon className="h-3.5 w-3.5" />
                  <span>{compactStepTitle(screen.title)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 relative h-2.5 overflow-hidden rounded-full bg-white/90 shadow-[inset_0_1px_4px_rgba(35,68,139,0.14)]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[#2b5cff] via-[#4f6fff] to-[#00beff]"
            animate={{ width: `${completionPercent}%` }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          />
          <div className="pointer-events-none absolute inset-y-0 left-0 w-24 animate-[shimmer_1.8s_linear_infinite] bg-gradient-to-r from-transparent via-white/45 to-transparent" />
        </div>

        {didResumeSession ? (
          <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#b9d0ff] bg-[#ebf3ff] px-3 py-2 text-xs font-medium text-[#3158cc]">
            <Rocket className="h-3.5 w-3.5" />
            Session resumed from where you left off.
          </div>
        ) : null}

        <AnimatePresence mode="wait">
          <motion.div
            key={currentScreen.id}
            initial={{ opacity: 0, y: 12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.985 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            className="mt-6"
          >
            <div className="rounded-3xl border border-[#d3e2fb] bg-white/95 p-5 shadow-[0_16px_30px_rgba(16,47,103,0.1)] sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-finance-muted">
                    {currentScreenVisual.eyebrow}
                  </p>
                  <h2 className="mt-1.5 text-xl font-semibold leading-tight text-finance-text sm:text-2xl">{currentScreen.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-finance-muted">{currentScreen.description}</p>
                </div>

                <div className="inline-flex items-center gap-2 rounded-2xl border border-[#d4e2fb] bg-[#f1f6ff] px-3 py-2 text-xs font-semibold text-finance-text">
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br ${currentScreenVisual.accentClass} text-white`}>
                    <CurrentScreenIcon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-finance-muted">Estimated</p>
                    <p>{currentScreen.estimatedMinutes} min</p>
                  </div>
                </div>
              </div>

              {currentScreen.id === "welcome" ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-[#d5e3fd] bg-gradient-to-br from-[#f5f9ff] to-[#e9f2ff] p-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-finance-muted">Goal Match</p>
                    <p className="mt-1 text-sm font-semibold text-finance-text">Built around your life goals</p>
                  </div>
                  <div className="rounded-2xl border border-[#d5e3fd] bg-gradient-to-br from-[#f5f9ff] to-[#e9f2ff] p-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-finance-muted">Risk Fit</p>
                    <p className="mt-1 text-sm font-semibold text-finance-text">Aligned with your comfort level</p>
                  </div>
                  <div className="rounded-2xl border border-[#d5e3fd] bg-gradient-to-br from-[#f5f9ff] to-[#e9f2ff] p-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-finance-muted">Actionable</p>
                    <p className="mt-1 text-sm font-semibold text-finance-text">Clear next steps after submit</p>
                  </div>
                </div>
              ) : (
                <div className="mt-5 grid gap-5 md:grid-cols-2">{visibleFields.map((field) => renderField(field))}</div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {submitError && !isAuthSessionMessage(submitError) ? (
          <div className="mt-5 flex items-start gap-2 rounded-2xl border border-[#f4c0c0] bg-[#fff1f1] p-3 text-sm text-[#b64040]">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <p>{submitError}</p>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentStep === 0 || isSubmitting}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-[#c9daf9] bg-white px-5 text-sm font-semibold text-finance-text shadow-[0_8px_16px_rgba(16,47,103,0.08)] transition-all hover:bg-[#f3f8ff] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <button
            type="button"
            onClick={() => void handleNext()}
            disabled={isSubmitting}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#2b5cff] via-[#4668ff] to-[#00bbff] px-6 text-sm font-semibold text-white shadow-[0_14px_26px_rgba(43,92,255,0.3)] transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-65"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {primaryActionLabel}
            {!isSubmitting ? <ArrowRight className="h-4 w-4" /> : null}
          </button>
        </div>
      </div>
    </section>
  );
}
