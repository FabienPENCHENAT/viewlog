import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import App from "./App.jsx";
import Home from "./pages/Home.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Faq from "./pages/Faq.jsx";
import Legal from "./pages/Legal.jsx";
import Changelog from "./pages/Changelog.jsx";
import Stats from "./pages/Stats.jsx";
import { LangProvider } from "./i18n/index.jsx";
import "./index.css";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      { path: "dashboard/:id", element: <Dashboard /> },
      { path: "faq", element: <Faq /> },
      { path: "mentions-legales", element: <Legal /> },
      { path: "changelog", element: <Changelog /> },
      // Dashboard privé (non lié dans la nav). Chemin volontairement peu devinable ;
      // la vraie protection reste le STATS_TOKEN. Pour le renommer, changer ici.
      { path: "vl-backstage-6f3a", element: <Stats /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LangProvider>
      <RouterProvider router={router} />
    </LangProvider>
  </React.StrictMode>
);
