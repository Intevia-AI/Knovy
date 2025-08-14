"use client"; // Required for hooks like useAuth and client-side logic
import { Main } from "./components/main";
import { useAuth } from "./context/AuthContext"; // Import useAuth
import { Loader2 } from "lucide-react"; // For a loading spinner

/**
 * Main page component that serves as the entry point for the application.
 * Shows a loading spinner during authentication initialization, then renders
 * the main application interface.
 * 
 * @component
 * @returns {JSX.Element} Loading spinner or main application interface
 */
export default function App() {
  const { isLoading } = useAuth(); // Only need isLoading here for the initial app load indication

  // Show loading spinner while authentication context initializes
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">Loading application...</p>
      </div>
    );
  }

  // Always render Main component after initial loading, login checks will be feature-specific
  return <Main />;
}