import { BrowserRouter, Route, Routes } from "react-router-dom";
import { HomePage, PlayPage, ScanPage } from "./pages/AppPages";
import "./App.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/scan" element={<ScanPage />} />
        <Route path="/play/:id" element={<PlayPage />} />
      </Routes>
    </BrowserRouter>
  );
}
