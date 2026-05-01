"use client";

import { Check } from "lucide-react";

interface Props {
  steps: string[];
  currentStep: number;
}

export default function StepIndicator({ steps, currentStep }: Props) {
  return (
    <div className="flex items-center justify-center gap-0">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`step-indicator ${
                i < currentStep
                  ? "step-done"
                  : i === currentStep
                  ? "step-active"
                  : "step-pending"
              }`}
            >
              {i < currentStep ? <Check size={14} /> : <span>{i + 1}</span>}
            </div>
            <span
              className={`text-xs hidden sm:block ${
                i === currentStep ? "text-purple-300" : i < currentStep ? "text-amber-400" : "text-slate-600"
              }`}
            >
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`h-px w-8 sm:w-12 mx-1 mb-4 transition-all duration-300 ${
                i < currentStep ? "bg-amber-500" : "bg-[#1e2140]"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
