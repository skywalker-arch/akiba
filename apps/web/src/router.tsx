import { createBrowserRouter } from "react-router";
import { ProtectedRoute } from "./components/protected-route";
import { RouteShell } from "./components/route-shell";
import { DashboardPage } from "./pages/dashboard-page";
import { GroupContributionsPage } from "./pages/group-contributions-page";
import { GroupDetailPage } from "./pages/group-detail-page";
import { GroupGoalsPage } from "./pages/group-goals-page";
import { GroupMembersPage } from "./pages/group-members-page";
import { ContributionSchedulesPage } from "./pages/contribution-schedules-page";
import { GroupsPage } from "./pages/groups-page";
import { LandingPage } from "./pages/landing-page";
import { LoginPage } from "./pages/login-page";
import { NotFoundPage } from "./pages/not-found-page";
import { NotificationsPage } from "./pages/notifications-page";
import { ProfilePage } from "./pages/profile-page";
import { RegisterPage } from "./pages/register-page";
import { StatementPage } from "./pages/statement-page";
import { TransactionsPage } from "./pages/transactions-page";
import { InvitationAcceptPage } from "./pages/invitation-accept-page";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <LandingPage />,
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
    path: "/invite/:token",
    element: <InvitationAcceptPage />,
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
            path: "/groups/:groupId/schedules",
            element: <ContributionSchedulesPage />,
          },
          {
            path: "/groups/:groupId/goals",
            element: <GroupGoalsPage />,
          },
          {
            path: "/transactions",
            element: <TransactionsPage />,
          },
          {
            path: "/notifications",
            element: <NotificationsPage />,
          },
          {
            path: "/profile",
            element: <ProfilePage />,
          },
          {
            path: "/statement",
            element: <StatementPage />,
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
