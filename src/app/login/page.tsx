import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-indigo-400 text-xl font-semibold text-brand-foreground shadow-md">
            N
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Portal Nero</h1>
            <p className="text-sm text-muted-foreground">Governança de Dados · LM</p>
          </div>
        </div>

        <form
          action="/api/login"
          method="post"
          className="space-y-3 rounded-2xl border bg-card p-5 shadow-sm"
        >
          <label htmlFor="password" className="block text-sm font-medium">
            Senha de acesso
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            autoFocus
            required
            placeholder="••••••••"
            autoComplete="current-password"
          />
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">Senha incorreta. Tente novamente.</p>
          )}
          <Button type="submit" className="w-full">
            Entrar
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Acesso restrito à equipe de Governança.
        </p>
      </div>
    </main>
  );
}
