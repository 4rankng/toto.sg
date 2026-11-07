import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { HistoryScreen } from "@/pages/history-screen";
import { HomeScreen } from "@/pages/home-screen";
import { InsightsScreen } from "@/pages/insights-screen";
import { Layout } from "@/pages/layout";
import { NotFound } from "@/pages/not-found";
import { StrategiesScreen } from "@/pages/strategies-screen";
import { RouteProvider } from "@/providers/router-provider";
import "@/styles/globals.css";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <BrowserRouter>
            <RouteProvider>
                <Routes>
                    <Route element={<Layout />}>
                        <Route path="/" element={<HomeScreen />} />
                        <Route path="/history" element={<HistoryScreen />} />
                        <Route path="/insights" element={<InsightsScreen />} />
                        <Route path="/strategies" element={<StrategiesScreen />} />
                        <Route path="*" element={<NotFound />} />
                    </Route>
                </Routes>
            </RouteProvider>
        </BrowserRouter>
    </StrictMode>,
);
