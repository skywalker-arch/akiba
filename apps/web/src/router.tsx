import { Navigate, createBrowserRouter } from "react-router";
import { ProtectedRoute } from "./components/protected-route";
import { RouteShell } from "./components/route-shell";
import { DashboardPage } from "./pages/dashboard-page";
import { GroupContributionsPage } from "./pages/group-contributions-page";
import { GroupDetailPage } from "./pages/group-detail-page";
import { GroupMembersPage } from "./pages/group-members-page";
import { GroupsPage } from "./pages/groups-page";
import { LoginPage } from "./pages/login-page";
import { NotFoundPage } from "./pages/not-found-page";
import { ProfilePage } from "./pages/profile-page";
import { RegisterPage } from "./pages/register-page";
import { TransactionsPage } from "./pages/transactions-page";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/register",
    element: <RegisterPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <RouteShell />,
        children: [
          {
            path: "/dashboard",
            element: <DashboardPage />,
          },
          {
            path: "/groups",
            element: <GroupsPage />,
          },
          {
            path: "/groups/:groupId",
            element: <GroupDetailPage />,
          },
          {
            path: "/groups/:groupId/contributions",
            element: <GroupContributionsPage />,
          },
          {
            path: "/groups/:groupId/members",
            element: <GroupMembersPage />,
          },
          {
            path: "/transactions",
            element: <TransactionsPage />,
          },
          {
            path: "/profile",
            element: <ProfilePage />,
          },
        ],
      },
    ],
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);
