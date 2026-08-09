import { Suspense } from "react";
import { features, inviteList } from "@/lib/env";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <Suspense>
      {/* Disclose invite-only up front — finding out on /not-invited after a
          successful sign-in reads as a bait-and-switch. */}
      <LoginForm authEnabled={features.authEnabled} inviteOnly={inviteList().length > 0} />
    </Suspense>
  );
}
