import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps {
  className?: string;
}

export default function LoadingSpinner({ className = "h-4 w-4" }: LoadingSpinnerProps) {
  return <Loader2 className={`${className} animate-spin`} />;
}