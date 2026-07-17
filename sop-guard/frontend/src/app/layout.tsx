import type { Metadata } from "next"
import { Inter, Sora } from "next/font/google"
import "@/styles/globals.css"
import { AuthProvider } from "@/lib/auth-context"
import { RoleProvider } from "@/lib/role-context"
import { MotionConfigProvider } from "@/components/motion-config-provider"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const sora = Sora({ subsets: ["latin"], variable: "--font-display", weight: ["500", "600", "700", "800"] })

export const metadata: Metadata = {
  title: "Meridian | Hospital SOP & Clinical Knowledge Platform",
  description:
    "A governed hospital knowledge system unifying SOPs and clinical literature, with built-in procedural faithfulness verification - every answer grounded in evidence, never fabricated.",
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
          __html: `try{if(localStorage.getItem('meridian-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`
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
