import { Suspense } from "react";
import { features } from "@/lib/env";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm authEnabled={features.authEnabled} />
    </Suspense>
  );
}
