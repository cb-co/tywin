import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service · Cashly",
};

const LAST_UPDATED = "July 20, 2026";
const CONTACT_EMAIL = "info.quantcoresolutions@gmail.com";

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated={LAST_UPDATED}>
      <section>
        <h2>1. Acceptance of terms</h2>
        <p>
          By creating an account or using Cashly, you agree to these Terms of
          Service. If you don&apos;t agree, please don&apos;t use the app.
        </p>
      </section>

      <section>
        <h2>2. What Cashly is</h2>
        <p>
          Cashly is a personal finance tracker that lets you record accounts,
          transactions, budgets, and subscriptions across currencies. It is a
          bookkeeping tool, not a bank, broker, or financial advisor, and it
          doesn&apos;t move money on your behalf.
        </p>
      </section>

      <section>
        <h2>3. Your account</h2>
        <p>
          You&apos;re responsible for the accuracy of the information you
          enter and for keeping your login credentials secure. You must be
          able to form a binding contract to use Cashly, and one account is
          for one person &mdash; don&apos;t share credentials.
        </p>
      </section>

      <section>
        <h2>4. Acceptable use</h2>
        <p>
          Don&apos;t use Cashly to store data you don&apos;t have the right to
          store, attempt to disrupt the service, or try to access another
          user&apos;s data. We may suspend or terminate accounts that violate
          this.
        </p>
      </section>

      <section>
        <h2>5. No financial advice</h2>
        <p>
          Balances, budgets, and insights shown in Cashly are calculated from
          the data you enter. They&apos;re provided for informational purposes
          only and are not financial, tax, or legal advice.
        </p>
      </section>

      <section>
        <h2>6. Your data</h2>
        <p>
          How we collect, use, and store your data is described in the{" "}
          <a href="/privacy" className="underline underline-offset-2">
            Privacy Policy
          </a>
          . You can export or permanently delete your account and its data at
          any time from Settings.
        </p>
      </section>

      <section>
        <h2>7. Service &ldquo;as is&rdquo;</h2>
        <p>
          Cashly is provided &ldquo;as is&rdquo; without warranties of any
          kind. We don&apos;t guarantee the service will be uninterrupted or
          error-free, and to the fullest extent permitted by law we&apos;re
          not liable for any indirect or consequential damages arising from
          your use of it.
        </p>
      </section>

      <section>
        <h2>8. Changes</h2>
        <p>
          We may update these terms from time to time. Continued use of
          Cashly after a change means you accept the updated terms.
        </p>
      </section>

      <section>
        <h2>9. Contact</h2>
        <p>
          Questions about these terms? Reach us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>
    </LegalPage>
  );
}
