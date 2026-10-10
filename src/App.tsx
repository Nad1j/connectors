import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { AccountsBar } from "@/components/layout/AccountsBar";
import { useAppStore } from "@/store/useAppStore";
import { wireProgressEvents } from "@/services/publish/pipeline";
import * as oauth from "@/services/auth/oauthService";
import { Dashboard } from "@/views/Dashboard";
import { Publisher } from "@/views/Publisher";
import { Calendar } from "@/views/Calendar";
import { Analytics } from "@/views/Analytics";
import { Inbox } from "@/views/Inbox";
import { Accounts } from "@/views/Accounts";
import { Settings } from "@/views/Settings";
import type { ViewId } from "@/types";

const VIEWS: Record<ViewId, () => JSX.Element> = {
  dashboard: Dashboard,
  publisher: Publisher,
  calendar: Calendar,
  analytics: Analytics,
  inbox: Inbox,
  accounts: Accounts,
  settings: Settings,
};

export default function App() {
  const view = useAppStore((s) => s.view);
  const View = VIEWS[view];

  useEffect(() => {
    wireProgressEvents();
    // Desktop: overlay real keychain state onto the account list.
    oauth.status().then((statuses) => {
      if (!statuses) return;
      const { accounts, setAccounts } = useAppStore.getState();
      setAccounts(
        accounts.map((a) => {
          const s = statuses.find((x) => x.platform === a.platform);
          return s ? { ...a, connected: s.connected, needsReauth: s.expired, configured: s.configured } : a;
        }),
      );
    });
  }, []);

  return (
    <div className="relative flex h-full overflow-hidden bg-void">
      {/* Ambient light: one cool wash top-left, one teal low-right. */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-ion/10 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-48 right-0 h-[480px] w-[480px] rounded-full bg-aurora/[0.06] blur-[120px]" />

      <Sidebar />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <AccountsBar />
        <main className="relative min-h-0 flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              className="h-full"
              initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <View />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
