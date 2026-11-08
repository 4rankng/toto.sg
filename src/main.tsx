import { lazy, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { Layout } from "@/pages/layout";
import { LineBuilderProvider } from "@/providers/line-builder-provider";
import { RouteProvider } from "@/providers/router-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import "@/styles/globals.css";

const HomeScreen = lazy(() => import("@/pages/home-screen").then((m) => ({ default: m.HomeScreen })));
const HistoryScreen = lazy(() => import("@/pages/history-screen").then((m) => ({ default: m.HistoryScreen })));
const InsightsScreen = lazy(() => import("@/pages/insights-screen").then((m) => ({ default: m.InsightsScreen })));
const StrategiesScreen = lazy(() => import("@/pages/strategies-screen").then((m) => ({ default: m.StrategiesScreen })));
const NotFound = lazy(() => import("@/pages/not-found").then((m) => ({ default: m.NotFound })));

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <ThemeProvider>
            <LineBuilderProvider>
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
            </LineBuilderProvider>
        </ThemeProvider>
    </StrictMode>,
);
