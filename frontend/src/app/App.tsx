import { useEffect, useState } from "react";

import { AppProvider } from "./providers";
import { AppRouter } from "./router";
import {
  MOBILE_LOGO_PRELOADER_DURATION_MS,
  MobileLogoPreloader,
  isMobileAuthViewport
} from "../components/auth/MobileLogoPreloader";
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPage";
import { AppLayout } from "../components/layout/AppLayout";
import { FirstLoginOnboarding } from "../components/onboarding/FirstLoginOnboarding";
import { ErrorState } from "../components/ui/ErrorState";
import { LoadingState } from "../components/ui/LoadingState";
import { SuccessState } from "../components/ui/SuccessState";
import { useAuth } from "../hooks/useAuth";
import { useRussianTypography } from "../hooks/useRussianTypography";
import { useNavigation, useUIFeedback } from "./providers";
import type { AuthMode } from "../types/navigation";

function AuthGate() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [isMobilePreloading, setIsMobilePreloading] = useState(isMobileAuthViewport);
  const { handleAuth } = useAuth();

  useEffect(() => {
    if (!isMobilePreloading) {
      return;
    }

    const timer = window.setTimeout(() => {
      setIsMobilePreloading(false);
    }, MOBILE_LOGO_PRELOADER_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [isMobilePreloading]);

  const authPage =
    mode === "login" ? (
      <LoginPage onAuth={handleAuth} onSwitchMode={() => setMode("register")} />
    ) : (
      <RegisterPage onAuth={handleAuth} onSwitchMode={() => setMode("login")} />
    );

  return (
    <>
      <MobileLogoPreloader isVisible={isMobilePreloading} />
      <div
        className={isMobilePreloading ? "auth-content auth-content-preloading" : "auth-content"}
        aria-hidden={isMobilePreloading || undefined}
      >
        {authPage}
      </div>
    </>
  );
}

function AppContent() {
  useRussianTypography();

  const { token } = useAuth();
  const { completeOnboarding, isOnboardingOpen } = useNavigation();
  const { error, notice, noticeDetail, noticeReward, isLoading, clearError } = useUIFeedback();

  if (!token) {
    return <AuthGate />;
  }

  return (
    <AppLayout>
      <div className="feedback-stack">
        {isLoading && <LoadingState />}
        {error && <ErrorState message={error} onDismiss={clearError} />}
        {notice && <SuccessState message={notice} detail={noticeDetail} reward={noticeReward} />}
      </div>
      <AppRouter />
      {isOnboardingOpen && <FirstLoginOnboarding onComplete={completeOnboarding} />}
    </AppLayout>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
