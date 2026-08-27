import { NavBar } from "@/components/nav-bar";
import CareerView from "./career-view";

export default function CareerPage() {
  return (
    <>
      <NavBar
        crumbs={[{ label: "Profile", href: "/profile" }, { label: "Career" }]}
        backHref="/profile"
      />
      <main className="min-h-screen px-6 py-12">
        <div className="mx-auto max-w-2xl">
          <p className="font-score text-accent mb-2 text-[13px] font-semibold uppercase tracking-[0.2em]">
            Career
          </p>
          <h1 className="font-display text-ink mb-8 text-4xl leading-none">
            Everything you have bowled
          </h1>
          <CareerView />
        </div>
      </main>
    </>
  );
}
