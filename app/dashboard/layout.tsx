import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LogOut, FolderOpen } from "lucide-react";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: designer } = await supabase
    .from("designers")
    .select("firm_name")
    .eq("user_id", user.id)
    .single();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/dashboard/projects" className="font-serif text-lg font-semibold text-foreground hover:opacity-80">
            {designer?.firm_name ?? "Ann Merideth Design"}
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href="/dashboard/projects"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <FolderOpen className="h-4 w-4" />
              Projects
            </Link>
            <form action="/api/auth/signout" method="POST">
              <button
                type="submit"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
