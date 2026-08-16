export type AuthTokenResponse = {
  accessToken: string;
};

export type UserProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MemberRole = "OWNER" | "ADMIN" | "MEMBER";
export type MemberStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "LEFT";

export type GroupSummary = {
  membershipId: string;
  role: MemberRole;
  status: MemberStatus;
  joinedAt: string | null;
  group: {
    id: string;
    name: string;
    code: string;
    description: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  };
};

export type GroupDetails = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  createdBy: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  memberships: Array<{
    id: string;
    role: MemberRole;
    status: MemberStatus;
    joinedAt: string | null;
    createdAt: string;
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      phone: string | null;
    };
  }>;
  memberCount: number;
};

export type Contribution = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  contributedAt: string;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  membership: {
    id: string;
    role: string;
    status: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string | null;
    };
  };
};

export type ContributionDetails = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  contributedAt: string;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  membership: {
    id: string;
    role: string;
    status: string;
    joinedAt: string | null;
    group: {
      id: string;
      name: string;
      code: string;
      createdAt: string;
    };
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string | null;
    };
  };
  transactions: Array<{
    id: string;
    type: string;
    status: string;
    amount: number;
    currency: string;
    occurredAt: string;
    wallet: {
      id: string;
      type: string;
      groupId: string;
      currency: string;
      balance: number;
      updatedAt: string;
    };
  }>;
};
