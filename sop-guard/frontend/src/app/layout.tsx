import type { Metadata } from "next"
import { Inter, Sora } from "next/font/google"
import "@/styles/globals.css"
import { AuthProvider } from "@/lib/auth-context"
import { RoleProvider } from "@/lib/role-context"
import { MotionConfigProvider } from "@/components/motion-config-provider"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const sora = Sora({ subsets: ["latin"], variable: "--font-display", weight: ["500", "600", "700", "800"] })

export const metadata: Metadata = {
  title: "SOP-Guard | AI-Powered Clinical SOP Assistant",
  description:
    "Research prototype: AI-powered clinical Standard Operating Procedure assistant with built-in procedural faithfulness verification.",
  icons: {
    icon: "/favicon.svg",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `try{if(localStorage.getItem('sop-guard-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`
        }} />
      </head>
      <body className={`${inter.className} antialiased`}>
        <MotionConfigProvider>
          <AuthProvider>
            <RoleProvider>{children}</RoleProvider>
          </AuthProvider>
        </MotionConfigProvider>
      </body>
    </html>
  )
}
