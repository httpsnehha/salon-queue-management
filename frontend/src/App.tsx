import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import HomePage from "./pages/HomePage";
import JoinQueuePage from "./pages/JoinQueuePage";
import QueueStatusPage from "./pages/QueueStatusPage";
import StaffPage from "./pages/StaffPage";
import DisplayPage from "./pages/DisplayPage";
import AdminPage from "./pages/AdminPage";
export default function App() {
  return <Routes><Route element={<AppLayout />}><Route path="/" element={<HomePage />} /><Route path="/join" element={<JoinQueuePage />} /><Route path="/queue/:id" element={<QueueStatusPage />} /><Route path="/staff" element={<StaffPage />} /><Route path="/display" element={<DisplayPage />} /><Route path="/admin" element={<AdminPage />} /><Route path="*" element={<Navigate to="/" replace />} /></Route></Routes>;
}
