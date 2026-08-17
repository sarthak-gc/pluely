import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import {
  App,
  SystemPrompts,
  ViewChat,
  Shortcuts,
  Chats,
  Checklists,
  Recordings,
  DevSpace,
} from "@/pages";
import { DashboardLayout } from "@/layouts";

export default function AppRoutes() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<App />} />
        <Route element={<DashboardLayout />}>
          <Route path="/checklists" element={<Checklists />} />
          <Route path="/recordings" element={<Recordings />} />
          <Route path="/chats" element={<Chats />} />
          <Route path="/chats/view/:conversationId" element={<ViewChat />} />
          <Route path="/system-prompts" element={<SystemPrompts />} />
          <Route path="/shortcuts" element={<Shortcuts />} />
          {/* Not in the nav, but kept reachable by URL — it's the only place
              to configure the STT provider if the seeded key needs replacing. */}
          <Route path="/dev-space" element={<DevSpace />} />
        </Route>
      </Routes>
    </Router>
  );
}
