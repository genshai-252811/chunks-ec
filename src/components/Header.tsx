import { motion } from "framer-motion";
import { Zap } from "lucide-react";

export function Header() {
  return (
    <motion.header
      className="py-6 px-4"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center justify-center max-w-md mx-auto">
        {/* Logo */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-1">
            <motion.div
              className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center energy-glow"
              animate={{
                boxShadow: [
                  "0 0 20px hsl(180 100% 50% / 0.3)",
                  "0 0 40px hsl(180 100% 50% / 0.5)",
                  "0 0 20px hsl(180 100% 50% / 0.3)",
                ],
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Zap className="w-6 h-6 text-primary-foreground" />
            </motion.div>
            <h1 className="text-2xl font-bold tracking-tight text-glow">
              CHUNKS
            </h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Voice Energy Trainer
          </p>
        </div>
      </div>
    </motion.header>
  );
}
