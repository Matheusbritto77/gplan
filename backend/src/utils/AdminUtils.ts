const ADMIN_EMAIL_SEPARATORS = /[,\s;]+/;

function normalizedEmail(email: string): string {
    return email.trim().toLowerCase();
}

export function getAdminEmailSet(): Set<string> {
    const raw = `${process.env.ADMIN_EMAILS || ""} ${process.env.ADMIN_EMAIL || ""}`.trim();
    if (!raw) {
        return new Set<string>();
    }

    const emails = raw
        .split(ADMIN_EMAIL_SEPARATORS)
        .map((email) => normalizedEmail(email))
        .filter(Boolean);

    return new Set(emails);
}

export function isAdminEmail(email: string | null | undefined): boolean {
    if (!email) {
        return false;
    }

    const adminEmails = getAdminEmailSet();
    if (adminEmails.size === 0) {
        return false;
    }

    return adminEmails.has(normalizedEmail(email));
}
