import { ReactNode } from "react";
import "./carper-theme.css";

export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-900 p-4 font-sans">
      <div className="relative w-full max-w-[390px] h-[844px] bg-[#FAFAFA] rounded-[40px] overflow-hidden shadow-2xl ring-8 ring-zinc-800 carper-theme flex flex-col">
        {children}
      </div>
    </div>
  );
}
