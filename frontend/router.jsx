import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import NotFound from "./pages/NotFound";
import { Promotions } from "./pages/Promotions";

const router = createBrowserRouter([
  {
    path: "/company/:company_id/",
    element: <App />,
  },
  {
    path: "/company/:company_id/application/:application_id",
    element: <App />,
  },
  {
    path: "/company/:company_id/promotions",
    element: <Promotions />,
  },
  {
    path: "/company/:company_id/application/:application_id/promotions",
    element: <Promotions />,
  },
  {
    path: "/*", // Fallback route for all unmatched paths
    element: <NotFound />, // Component to render for unmatched paths
  },
]);

export default router;
