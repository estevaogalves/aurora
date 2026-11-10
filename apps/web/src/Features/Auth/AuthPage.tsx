import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { ApiError } from "@/api/http";
import { Field, inputClass } from "@/components/shared/FormFields";
import { btnClass } from "@/components/shared/styles";
import { DATA_SOURCE } from "@/config";
import { useAuthStore } from "@/Store/AuthStore";
import Logo from "@/theme/Logo";
import { APP_NAME, APP_TAGLINE } from "@/theme/theme";
import ThemeToggle from "@/theme/ThemeToggle";

type Mode = "login" | "register";

const COPY: Record<Mode, { title: string; subtitle: string; submit: string; alt: string; altLink: string; altTo: string }> = {
  login: {
    title: "Entrar",
    subtitle: "Acesse sua conta para ver suas finanças.",
    submit: "Entrar",
    alt: "Ainda não tem conta?",
    altLink: "Criar conta",
    altTo: "/cadastrar",
  },
  register: {
    title: "Criar conta",
    subtitle: "Leva menos de um minuto.",
    submit: "Criar conta",
    alt: "Já tem conta?",
    altLink: "Entrar",
    altTo: "/entrar",
  },
};

const MIN_PASSWORD = 8;

/** Tela única de login e cadastro. */
export default function AuthPage({ mode }: { mode: Mode }) {
  const status = useAuthStore((s) => s.status);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const location = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const copy = COPY[mode];

  if (DATA_SOURCE !== "api" || status === "authenticated") {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== "/entrar" && from !== "/cadastrar" ? from : "/painel"} replace />;
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (mode === "register" && password.length < MIN_PASSWORD) {
      setError(`A senha precisa ter ao menos ${MIN_PASSWORD} caracteres.`);
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") await login(email.trim(), password);
      else await register(name.trim(), email.trim(), password);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Algo deu errado. Tente novamente.");
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex items-center gap-3">
          <Logo size={40} />
          <div>
            <div className="font-display text-xl font-semibold tracking-[-0.02em]">{APP_NAME}</div>
            <div className="text-[13px] text-muted-foreground">{APP_TAGLINE}</div>
          </div>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]" noValidate>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-[-0.02em]">{copy.title}</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">{copy.subtitle}</p>
          </div>

          {mode === "register" && (
            <Field label="Nome" hint="(opcional)" htmlFor="auth-name">
              <input id="auth-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className={inputClass} />
            </Field>
          )}
          <Field label="E-mail" htmlFor="auth-email">
            <input id="auth-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Senha" hint={mode === "register" ? `(mínimo ${MIN_PASSWORD} caracteres)` : undefined} htmlFor="auth-password">
            <input
              id="auth-password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </Field>

          {error && (
            <p role="alert" className="rounded-md border border-destructive bg-secondary px-3 py-2 text-[13px] text-destructive">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy || !email || !password} className={`${btnClass.primary} justify-center disabled:opacity-60`}>
            {busy ? "Aguarde..." : copy.submit}
          </button>
        </form>

        <p className="mt-4 text-center text-[13px] text-muted-foreground">
          {copy.alt}{" "}
          <Link to={copy.altTo} className="font-semibold text-primary hover:underline">
            {copy.altLink}
          </Link>
        </p>
      </div>
    </div>
  );
}
