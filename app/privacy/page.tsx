import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy · Cashly",
};

const LAST_UPDATED = "July 20, 2026";
const CONTACT_EMAIL = "info.quantcoresolutions@gmail.com";

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated={LAST_UPDATED}>
      <section>
        <h2>1. Information we collect</h2>
        <p>
          Account info: your email address, and, if you sign in with Google,
          your name and profile picture from your Google account.
        </p>
        <p>
          Financial data you enter: accounts, balances, transactions,
          budgets, and subscriptions. This data is entered by you and is not
          pulled from any bank or financial institution.
        </p>
      </section>

      <section>
        <h2>2. How we use it</h2>
        <p>
          To run the app: authenticate you, show your data back to you, and
          calculate the balances, budgets, and insights the app displays. We
          don&apos;t sell your data or use it for advertising.
        </p>
      </section>

      <section>
        <h2>3. Third parties</h2>
        <p>
          Cashly is built on Supabase, which hosts our database and handles
          authentication. If you sign in with Google, Google processes your
          sign-in under its own privacy policy. We don&apos;t share your
          financial data with any other third party.
        </p>
      </section>

      <section>
        <h2>4. Data security</h2>
        <p>
          Your data is stored in a database scoped to your account, protected
          by row-level security so only you can read or write it. Connections
          to Cashly are encrypted in transit.
        </p>
      </section>

      <section>
        <h2>5. Data retention and deletion</h2>
        <p>
          We keep your data for as long as your account is active. You can
          permanently delete your account and all associated data at any time
          from Settings &rarr; Danger zone. Deletion is immediate and cannot
          be undone.
        </p>
      </section>

      <section>
        <h2>6. Your rights</h2>
        <p>
          You can access, correct, or delete your data directly in the app at
          any time. If you&apos;d like help exporting or removing your data,
          contact us using the details below.
        </p>
      </section>

      <section>
        <h2>7. Changes to this policy</h2>
        <p>
          We may update this policy from time to time. Continued use of
          Cashly after a change means you accept the updated policy.
        </p>
      </section>

      <section>
        <h2>8. Contact</h2>
        <p>
          Questions about this policy? Reach us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>
    </LegalPage>
  );
}
