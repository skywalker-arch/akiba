import { env } from "./env";
import { apiRequest } from "./http";
import type {
  AuthTokenResponse,
  Contribution,
  ContributionDetails,
  ContributionObligation,
  ContributionSchedule,
  NotificationItem,
  NotificationPreference,
  NotificationSummary,
  PersonalStatement,
  GroupDetails,
  GroupSavingsGoal,
  MemberCandidate,
  GroupSummary,
  Loan,
  MemberRole,
  MemberStatus,
  Transaction,
  UserProfile,
} from "../types/api";

function apiUrl(path: string) {
  return `${env.apiBaseUrl}${path}`;
}

export const authApi = {
  login(payload: { email: string; password: string }) {
    return apiRequest<AuthTokenResponse>(apiUrl("/auth/login"), {
      method: "POST",
      body: payload,
    });
  },
  register(payload: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) {
    return apiRequest<AuthTokenResponse>(apiUrl("/auth/register"), {
      method: "POST",
      body: payload,
    });
  },
  me(token: string) {
    return apiRequest<{ id: string; email: string }>(apiUrl("/auth/me"), {
      token,
    });
  },
};

export const usersApi = {
  getMe(token: string) {
    return apiRequest<UserProfile>(apiUrl("/users/me"), { token });
  },
  updateMe(
    token: string,
    payload: { firstName?: string; lastName?: string; phone?: string },
  ) {
    return apiRequest<UserProfile>(apiUrl("/users/me"), {
      method: "PATCH",
      token,
      body: payload,
    });
  },
  getMyStatement(token: string, filters?: { month?: number; year?: number }) {
    const params = new URLSearchParams();

    if (filters?.month !== undefined) {
      params.set("month", String(filters.month));
    }

    if (filters?.year !== undefined) {
      params.set("year", String(filters.year));
    }

    const query = params.toString();

    return apiRequest<PersonalStatement>(
      apiUrl(`/users/me/statement${query ? `?${query}` : ""}`),
      { token },
    );
  },
};

export const groupsApi = {
  getMyGroups(token: string) {
    return apiRequest<GroupSummary[]>(apiUrl("/groups"), { token });
  },
  createGroup(
    token: string,
    payload: { name: string; description?: string; code?: string },
  ) {
    return apiRequest<GroupDetails>(apiUrl("/groups"), {
      method: "POST",
      token,
      body: payload,
    });
  },
  getGroupById(token: string, groupId: string) {
    return apiRequest<GroupDetails>(apiUrl(`/groups/${groupId}`), { token });
  },
  getGroupBalance(token: string, groupId: string) {
    return apiRequest<{ amount: number; currency: string }>(
      apiUrl(`/groups/${groupId}/balance`),
      { token },
    );
  },
  searchMemberCandidates(token: string, groupId: string, query: string) {
    const encoded = encodeURIComponent(query);
    return apiRequest<MemberCandidate[]>(
      apiUrl(`/groups/${groupId}/member-candidates?query=${encoded}`),
      { token },
    );
  },
  addMember(token: string, groupId: string, payload: { email: string }) {
    return apiRequest(apiUrl(`/groups/${groupId}/members`), {
      method: "POST",
      token,
      body: payload,
    });
  },
  updateMember(
    token: string,
    groupId: string,
    memberId: string,
    payload: { role?: MemberRole; status?: MemberStatus },
  ) {
    return apiRequest(apiUrl(`/groups/${groupId}/members/${memberId}`), {
      method: "PATCH",
      token,
      body: payload,
    });
  },
  removeMember(token: string, groupId: string, memberId: string) {
    return apiRequest<void>(apiUrl(`/groups/${groupId}/members/${memberId}`), {
      method: "DELETE",
      token,
    });
  },
  getGroupGoals(token: string, groupId: string, options?: { includeArchived?: boolean }) {
    const includeArchived = options?.includeArchived ? "?includeArchived=true" : "";
    return apiRequest<GroupSavingsGoal[]>(apiUrl(`/groups/${groupId}/goals${includeArchived}`), {
      token,
    });
  },
  createGoal(
    token: string,
    groupId: string,
    payload: {
      name: string;
      description?: string;
      targetAmount: number;
      currency?: string;
      startDate?: string;
      targetDate: string;
    },
  ) {
    return apiRequest<GroupSavingsGoal>(apiUrl(`/groups/${groupId}/goals`), {
      method: "POST",
      token,
      body: payload,
    });
  },
  updateGoal(
    token: string,
    groupId: string,
    goalId: string,
    payload: {
      name?: string;
      description?: string;
      targetAmount?: number;
      currency?: string;
      startDate?: string;
      targetDate?: string;
      isArchived?: boolean;
    },
  ) {
    return apiRequest<GroupSavingsGoal>(apiUrl(`/groups/${groupId}/goals/${goalId}`), {
      method: "PATCH",
      token,
      body: payload,
    });
  },
  createGoalMilestone(
    token: string,
    groupId: string,
    goalId: string,
    payload: {
      name: string;
      targetAmount: number;
      dueDate: string;
    },
  ) {
    return apiRequest<GroupSavingsGoal>(apiUrl(`/groups/${groupId}/goals/${goalId}/milestones`), {
      method: "POST",
      token,
      body: payload,
    });
  },
  updateGoalMilestone(
    token: string,
    groupId: string,
    goalId: string,
    milestoneId: string,
    payload: {
      name?: string;
      targetAmount?: number;
      dueDate?: string;
      isCompleted?: boolean;
    },
  ) {
    return apiRequest<GroupSavingsGoal>(
      apiUrl(`/groups/${groupId}/goals/${goalId}/milestones/${milestoneId}`),
      {
        method: "PATCH",
        token,
        body: payload,
      },
    );
  },
};

export const contributionsApi = {
  getGroupContributions(token: string, groupId: string) {
    return apiRequest<Contribution[]>(apiUrl(`/groups/${groupId}/contributions`), {
      token,
    });
  },
  createContribution(
    token: string,
    groupId: string,
    payload: {
      amount: number;
      currency?: string;
      reference: string;
      notes?: string;
    },
  ) {
    return apiRequest<{ id: string; status: string; reference: string }>(
      apiUrl(`/groups/${groupId}/contributions`),
      {
        method: "POST",
        token,
        body: payload,
      },
    );
  },
  approveContribution(token: string, groupId: string, contributionId: string) {
    return apiRequest<{ id: string; status: string }>(
      apiUrl(`/groups/${groupId}/contributions/${contributionId}/approve`),
      {
        method: "POST",
        token,
      },
    );
  },
  rejectContribution(
    token: string,
    groupId: string,
    contributionId: string,
    reason: string,
  ) {
    return apiRequest<{ id: string; status: string; reason: string }>(
      apiUrl(`/groups/${groupId}/contributions/${contributionId}/reject`),
      {
        method: "POST",
        token,
        body: { reason },
      },
    );
  },
  getContributionById(token: string, contributionId: string) {
    return apiRequest<ContributionDetails>(apiUrl(`/contributions/${contributionId}`), {
      token,
    });
  },
};

export const loansApi = {
  getGroupLoans(token: string, groupId: string) {
    return apiRequest<Loan[]>(apiUrl(`/groups/${groupId}/loans`), { token });
  },
  getLoanById(token: string, groupId: string, loanId: string) {
    return apiRequest<Loan>(apiUrl(`/groups/${groupId}/loans/${loanId}`), {
      token,
    });
  },
  createLoan(
    token: string,
    groupId: string,
    payload: {
      principalAmount: number;
      interestRate: number;
      termMonths: number;
      purpose?: string;
    },
  ) {
    return apiRequest<Loan>(apiUrl(`/groups/${groupId}/loans`), {
      method: "POST",
      token,
      body: payload,
    });
  },
  reviewLoan(
    token: string,
    groupId: string,
    loanId: string,
    payload: { decision: "APPROVED" | "REJECTED"; reason?: string },
  ) {
    return apiRequest<Loan>(apiUrl(`/groups/${groupId}/loans/${loanId}/review`), {
      method: "PATCH",
      token,
      body: payload,
    });
  },
  disburseLoan(
    token: string,
    groupId: string,
    loanId: string,
    payload: { amount?: number; reference: string; notes?: string },
  ) {
    return apiRequest<Loan>(apiUrl(`/groups/${groupId}/loans/${loanId}/disburse`), {
      method: "POST",
      token,
      body: payload,
    });
  },
  createRepayment(
    token: string,
    groupId: string,
    loanId: string,
    payload: { amount: number; reference: string; paidAt?: string; notes?: string },
  ) {
    return apiRequest<{
      repaymentId: string;
      loanId: string;
      status: string;
      outstandingAmount: number;
    }>(apiUrl(`/groups/${groupId}/loans/${loanId}/repayments`), {
      method: "POST",
      token,
      body: payload,
    });
  },
};

export const financeApi = {
  getContributionWithWallet(token: string, contributionId: string) {
    return contributionsApi.getContributionById(token, contributionId);
  },
  getUserTransactions(
    token: string,
    filters?: { type?: string; status?: string; groupId?: string },
  ) {
    const params = new URLSearchParams();

    if (filters?.type) {
      params.set("type", filters.type);
    }

    if (filters?.status) {
      params.set("status", filters.status);
    }

    if (filters?.groupId) {
      params.set("groupId", filters.groupId);
    }

    const query = params.toString();
    return apiRequest<Transaction[]>(apiUrl(`/transactions${query ? `?${query}` : ""}`), {
      token,
    });
  },
};

export const schedulesApi = {
  getGroupSchedules(token: string, groupId: string) {
    return apiRequest<ContributionSchedule[]>(
      apiUrl(`/groups/${groupId}/contribution-schedules`),
      { token },
    );
  },
  createSchedule(
    token: string,
    groupId: string,
    payload: {
      name: string;
      amount: number;
      currency?: string;
      frequency: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
      dueDayOfWeek?: number;
      dueDayOfMonth?: number;
      graceDays?: number;
      startsOn: string;
      endsOn?: string;
    },
  ) {
    return apiRequest(
      apiUrl(`/groups/${groupId}/contribution-schedules`),
      {
        method: "POST",
        token,
        body: payload,
      },
    );
  },
  updateSchedule(
    token: string,
    groupId: string,
    scheduleId: string,
    payload: {
      name?: string;
      amount?: number;
      currency?: string;
      frequency?: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
      dueDayOfWeek?: number;
      dueDayOfMonth?: number;
      graceDays?: number;
      startsOn?: string;
      endsOn?: string;
      isActive?: boolean;
    },
  ) {
    return apiRequest(
      apiUrl(`/groups/${groupId}/contribution-schedules/${scheduleId}`),
      {
        method: "PATCH",
        token,
        body: payload,
      },
    );
  },
  getMyObligations(
    token: string,
    filters?: { status?: "PENDING" | "OVERDUE" | "PAID" | "WAIVED"; groupId?: string; limit?: number },
  ) {
    const params = new URLSearchParams();

    if (filters?.status) {
      params.set("status", filters.status);
    }

    if (filters?.groupId) {
      params.set("groupId", filters.groupId);
    }

    if (filters?.limit !== undefined) {
      params.set("limit", String(filters.limit));
    }

    const query = params.toString();

    return apiRequest<ContributionObligation[]>(
      apiUrl(`/users/me/contribution-obligations${query ? `?${query}` : ""}`),
      { token },
    );
  },
};

export const notificationsApi = {
  list(
    token: string,
    filters?: { unreadOnly?: boolean; limit?: number },
  ) {
    const params = new URLSearchParams();

    if (filters?.unreadOnly !== undefined) {
      params.set("unreadOnly", String(filters.unreadOnly));
    }

    if (filters?.limit !== undefined) {
      params.set("limit", String(filters.limit));
    }

    const query = params.toString();

    return apiRequest<NotificationItem[]>(
      apiUrl(`/notifications${query ? `?${query}` : ""}`),
      { token },
    );
  },
  markRead(token: string, notificationId: string) {
    return apiRequest<NotificationItem>(
      apiUrl(`/notifications/${notificationId}/read`),
      {
        method: "PATCH",
        token,
      },
    );
  },
  summary(token: string) {
    return apiRequest<NotificationSummary>(apiUrl('/notifications/summary'), {
      token,
    });
  },
  getPreferences(token: string) {
    return apiRequest<NotificationPreference>(
      apiUrl('/notifications/preferences'),
      { token },
    );
  },
  updatePreferences(
    token: string,
    payload: Partial<
      Pick<
        NotificationPreference,
        | 'contributionDueEnabled'
        | 'contributionOverdueEnabled'
        | 'contributionPostedEnabled'
        | 'loanStatusEnabled'
        | 'systemEnabled'
      >
    >,
  ) {
    return apiRequest<NotificationPreference>(
      apiUrl('/notifications/preferences'),
      {
        method: 'PATCH',
        token,
        body: payload,
      },
    );
  },
  markAllRead(token: string) {
    return apiRequest<{ updatedCount: number }>(apiUrl("/notifications/read-all"), {
      method: "POST",
      token,
    });
  },
};
