"use client"

import { signIn, useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { FcGoogle } from "react-icons/fc"
import { TbNetwork, TbArrowLeft } from "react-icons/tb"
import { motion } from "framer-motion"
import Link from "next/link"

export default function LoginPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard")
    }
  }, [status, router])

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-[#09090b]">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#09090b] text-foreground overflow-hidden relative selection:bg-primary/30 selection:text-primary">
      {/* ── Background Glow (matches landing page) ── */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-violet-600/10 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-emerald-600/10 blur-[150px] rounded-full" />
      </div>

      {/* ── Back Button ── */}
      <div className="absolute top-8 left-8 z-20">
        <Link href="/">
          <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-sm font-medium transition-colors backdrop-blur-md border border-white/10 text-muted-foreground hover:text-white">
            <TbArrowLeft className="w-4 h-4" />
            {/* Back to Home */}
          </button>
        </Link>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[420px] p-8 md:p-10 rounded-[2rem] glass-card border border-white/10 shadow-2xl flex flex-col items-center"
      >
        {/* <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 mb-8 glow-purple">
          <TbNetwork className="w-8 h-8 text-primary-foreground" />
        </div> */}
        
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white mb-2 text-center">
          Welcome back
        </h1>
        <p className="text-sm text-muted-foreground text-center mb-10 leading-relaxed px-4">
          Sign in to access your intelligent GraphMind AI workspace.
        </p>

        <button
          onClick={() => signIn("google")}
          className="group w-full flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 text-white font-medium py-3.5 px-6 rounded-xl transition-all duration-200 border border-white/10 hover:border-white/20 hover:scale-[1.02] active:scale-[0.98]"
        >
          <div className="p-1 bg-white rounded-md">
            <FcGoogle className="w-4 h-4" />
          </div>
          <span>Continue with Google</span>
        </button>

        <p className="mt-8 text-xs text-muted-foreground text-center max-w-[280px]">
          By continuing, you agree to our <a href="#" className="text-primary hover:underline">Terms of Service</a> and <a href="#" className="text-primary hover:underline">Privacy Policy</a>.
        </p>
      </motion.div>
    </div>
  )
}
