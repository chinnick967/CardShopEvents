import type { Metadata } from "next";
import { Orbitron, Rajdhani } from "next/font/google";
import "../styles/globals.scss";
import Header from "@/components/Header/Header";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { MyEventsProvider } from "@/components/events/MyEventsProvider";
import { getSessionUser } from "@/server/auth/session";

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  display: "swap",
});

const rajdhani = Rajdhani({
  variable: "--font-rajdhani",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Game Night — Tabletop Events",
  description:
    "Discover and RSVP to local tabletop game nights — Magic: The Gathering, Yu-Gi-Oh!, Pokémon, board games and more.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read the session on the server so the header renders signed-in on first paint.
  const user = await getSessionUser();

  return (
    <html lang="en" className={`${orbitron.variable} ${rajdhani.variable}`}>
      <body>
        <AuthProvider initialUser={user}>
          <MyEventsProvider>
            <Header />
            <main className="neon-grid-bg">{children}</main>
          </MyEventsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
