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

export type MemberCandidate = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

export type LoanStatus =
  | "REQUESTED"
  | "APPROVED"
  | "DISBURSED"
  | "ACTIVE"
  | "OVERDUE"
  | "CLOSED"
  | "REJECTED"
  | "DEFAULTED";

export type Loan = {
  id: string;
  borrowerMembershipId: string;
  principalAmount: number;
  interestRate: number;
  termMonths: number;
  purpose: string | null;
  disbursedAt: string | null;
  dueAt: string | null;
  status: LoanStatus;
  createdAt: string;
  updatedAt: string;
  borrowerMembership: {
    id: string;
    role: string;
    status: string;
    joinedAt: string | null;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string | null;
    };
  };
  financialSummary?: {
    principalAmount: number;
    totalInterest: number;
    totalRepayable: number;
    installmentAmount: number;
    repaidAmount: number;
    outstandingAmount: number;
    interestMethod: string;
  };
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

export type TransactionType =
  | "DEPOSIT"
  | "WITHDRAWAL"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "CONTRIBUTION"
  | "LOAN_DISBURSEMENT"
  | "LOAN_REPAYMENT"
  | "ADJUSTMENT"
  | "FEE"
  | "INTEREST";

export type TransactionStatus =
  | "PENDING"
  | "POSTED"
  | "FAILED"
  | "REVERSED";

export type Transaction = {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  currency: string;
  occurredAt: string;
  description: string | null;
  externalReference: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  wallet: {
    id: string;
    type: string;
    groupId: string | null;
    currency: string;
    balance: number;
    updatedAt: string;
    group: {
      id: string;
      name: string;
      code: string;
      description: string | null;
      isActive: boolean;
    } | null;
  };
  contribution: {
    id: string;
    amount: number;
    currency: string;
    status: string;
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
  } | null;
  loan: {
    id: string;
    principalAmount: number;
    interestRate: number;
    termMonths: number;
    status: string;
    borrowerMembership: {
      id: string;
      user: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        phone: string | null;
      };
    };
  } | null;
  loanRepayment: {
    id: string;
    amount: number;
    status: string;
    reference: string | null;
    paidAt: string;
  } | null;
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
