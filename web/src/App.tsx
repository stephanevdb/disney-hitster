import { BrowserRouter, Route, Routes } from "react-router-dom";
import { SongsProvider } from "./context/SongsContext";
import { AdminPage } from "./pages/AdminPage";
import { HomePage, PlayPage, ScanPage } from "./pages/AppPages";
import "./App.css";

export default function App() {
  return (
    <SongsProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/scan" element={<ScanPage />} />
          <Route path="/play/:id" element={<PlayPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </BrowserRouter>
    </SongsProvider>
  );
}
