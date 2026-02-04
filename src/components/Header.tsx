import { motion } from "framer-motion";
import chunksLogo from "@/assets/logo.png";

export function Header() {
  return (
    <motion.header
      className="px-[6px] py-[10px]"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center justify-center max-w-md mx-auto">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-1">
            <img 
              src={chunksLogo} 
              alt="Chunks" 
              className="h-8 w-auto"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Voice Energy Trainer
          </p>
        </div>
      </div>
    </motion.header>
  );
}