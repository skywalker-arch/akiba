type AppIconName =
  | "dashboard"
  | "groups"
  | "transactions"
  | "profile"
  | "chevronRight"
  | "wallet"
  | "members"
  | "shield"
  | "review"
  | "plus"
  | "clock"
  | "activity"
  | "loan"
  | "bell"
  | "logout"
  | "menu"
  | "close";

type AppIconProps = {
  name: AppIconName;
  size?: number;
  className?: string;
  title?: string;
};

export function AppIcon({ name, size = 18, className = "", title }: AppIconProps) {
  const sharedProps = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {name === "dashboard" ? (
        <>
          <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.4" {...sharedProps} />
          <rect x="13" y="3.5" width="7.5" height="5" rx="1.4" {...sharedProps} />
          <rect x="13" y="10.5" width="7.5" height="10" rx="1.4" {...sharedProps} />
          <rect x="3.5" y="13" width="7.5" height="7.5" rx="1.4" {...sharedProps} />
        </>
      ) : null}

      {name === "groups" ? (
        <>
          <circle cx="8" cy="10" r="2.8" {...sharedProps} />
          <circle cx="16" cy="9" r="2.4" {...sharedProps} />
          <path d="M3.8 19.3c.6-2.4 2.5-3.8 4.8-3.8s4.2 1.4 4.8 3.8" {...sharedProps} />
          <path d="M13.2 18.8c.4-1.8 1.9-2.9 3.7-2.9 1.6 0 3 .8 3.6 2.4" {...sharedProps} />
        </>
      ) : null}

      {name === "transactions" ? (
        <>
          <path d="M4 7h16" {...sharedProps} />
          <path d="M4 12h10" {...sharedProps} />
          <path d="M4 17h14" {...sharedProps} />
          <path d="M16 10l4 2-4 2" {...sharedProps} />
        </>
      ) : null}

      {name === "profile" ? (
        <>
          <circle cx="12" cy="8.2" r="3.2" {...sharedProps} />
          <path d="M5.2 19.2c.9-2.8 3.4-4.4 6.8-4.4s5.9 1.6 6.8 4.4" {...sharedProps} />
        </>
      ) : null}

      {name === "chevronRight" ? <path d="M9 6l6 6-6 6" {...sharedProps} /> : null}

      {name === "wallet" ? (
        <>
          <rect x="3.5" y="6" width="17" height="12" rx="2" {...sharedProps} />
          <path d="M15 11h5.5v3H15c-.9 0-1.6-.7-1.6-1.5S14.1 11 15 11z" {...sharedProps} />
          <path d="M7.5 9.2h4.2" {...sharedProps} />
        </>
      ) : null}

      {name === "members" ? (
        <>
          <circle cx="9" cy="8" r="2.5" {...sharedProps} />
          <circle cx="16" cy="10" r="2" {...sharedProps} />
          <path d="M4.8 18.5c.7-2.2 2.5-3.5 4.6-3.5s3.9 1.3 4.6 3.5" {...sharedProps} />
          <path d="M14 18.2c.5-1.5 1.7-2.4 3.2-2.4 1.4 0 2.6.7 3.2 2" {...sharedProps} />
        </>
      ) : null}

      {name === "shield" ? (
        <>
          <path d="M12 3.8l7 2.8V12c0 4.2-2.5 7-7 8.3C7.5 19 5 16.2 5 12V6.6l7-2.8z" {...sharedProps} />
          <path d="M9.1 12.1l2 2.1 3.8-4" {...sharedProps} />
        </>
      ) : null}

      {name === "review" ? (
        <>
          <rect x="4" y="4" width="16" height="16" rx="2" {...sharedProps} />
          <path d="M8 8.2h8" {...sharedProps} />
          <path d="M8 12h8" {...sharedProps} />
          <path d="M8 15.8h5" {...sharedProps} />
        </>
      ) : null}

      {name === "plus" ? (
        <>
          <path d="M12 5v14" {...sharedProps} />
          <path d="M5 12h14" {...sharedProps} />
        </>
      ) : null}

      {name === "clock" ? (
        <>
          <circle cx="12" cy="12" r="8" {...sharedProps} />
          <path d="M12 7.8v4.6l3.2 1.8" {...sharedProps} />
        </>
      ) : null}

      {name === "activity" ? (
        <>
          <path d="M3.8 13h4.1l2.1-4.4 3.1 7 2.4-4.3h4.7" {...sharedProps} />
        </>
      ) : null}

      {name === "loan" ? (
        <>
          <path d="M4.5 8.5h15" {...sharedProps} />
          <path d="M4.5 15.5h10.2" {...sharedProps} />
          <circle cx="17.8" cy="15.5" r="2.7" {...sharedProps} />
          <path d="M17.8 14v3" {...sharedProps} />
          <path d="M16.4 15.5h2.8" {...sharedProps} />
        </>
      ) : null}

      {name === "bell" ? (
        <>
          <path d="M6.8 16.8h10.4" {...sharedProps} />
          <path d="M8.2 16.8V10a3.8 3.8 0 0 1 7.6 0v6.8" {...sharedProps} />
          <path d="M9.8 19a2.3 2.3 0 0 0 4.4 0" {...sharedProps} />
          <path d="M5.6 16.8h12.8" {...sharedProps} />
        </>
      ) : null}

      {name === "logout" ? (
        <>
          <path d="M10 4.5H6.2A2.2 2.2 0 0 0 4 6.7v10.6a2.2 2.2 0 0 0 2.2 2.2H10" {...sharedProps} />
          <path d="M14 8l5 4-5 4" {...sharedProps} />
          <path d="M19 12H9" {...sharedProps} />
        </>
      ) : null}

      {name === "menu" ? (
        <>
          <path d="M4 7h16" {...sharedProps} />
          <path d="M4 12h16" {...sharedProps} />
          <path d="M4 17h16" {...sharedProps} />
        </>
      ) : null}

      {name === "close" ? (
        <>
          <path d="M6 6l12 12" {...sharedProps} />
          <path d="M18 6L6 18" {...sharedProps} />
        </>
      ) : null}
    </svg>
  );
}
