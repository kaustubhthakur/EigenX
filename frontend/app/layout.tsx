import "./globals.css";
import { ReactNode } from "react";
import type { Metadata } from "next";
import { AuthProvider } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ActiveDuelRedirect from "../components/ActiveDuelRedirect";

export const metadata: Metadata = {
  title: "EigenX",
  description: "Login / Register / OTP verification frontend",
  colorScheme: "light",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-gray-50 text-gray-900">
        <AuthProvider>
          <ActiveDuelRedirect />
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}