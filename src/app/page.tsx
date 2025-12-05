import { TipForm } from "@/components/TipForm";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-background">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm lg:flex flex-col gap-8">
        <h1 className="text-4xl font-bold mb-8">Base {'<->'} Solana Tip Jar</h1>
        <TipForm />
      </div>
    </main>
  );
}
