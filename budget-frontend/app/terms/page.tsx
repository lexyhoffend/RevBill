import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal";

export const metadata: Metadata = { title: "Terms of Service · RevBill" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={
        <p>
          These terms are an agreement between you and the operator of RevBill (&quot;we,&quot; &quot;us&quot;). By creating
          an account or using RevBill, you agree to them. If you don&apos;t agree, please don&apos;t use the service.
        </p>
      }
      sections={[
        {
          heading: "What RevBill is",
          body: (
            <p>
              RevBill is a personal budgeting tool for tracking income, bills, and savings by pay cycle. Everything in
              RevBill is information you enter yourself. RevBill does not connect to bank accounts, does not move money,
              and does not pay bills on your behalf.
            </p>
          ),
        },
        {
          heading: "Not financial advice",
          body: (
            <p>
              RevBill is for organization and tracking only. Nothing in it, including balances, projections, payoff
              dates, due-date reminders, or overdue indicators, is financial, legal, or tax advice. Calculations depend
              on the information you enter and may be incomplete or wrong. You are solely responsible for your financial
              decisions and for paying your bills on time. We are not responsible for missed payments, late fees,
              overdrafts, interest, credit impacts, or any other loss connected to your use of RevBill.
            </p>
          ),
        },
        {
          heading: "Eligibility and your account",
          body: (
            <ul>
              <li>You must be at least 18 years old to use RevBill.</li>
              <li>Provide an email address you control, and keep your password secure. You are responsible for activity on your account.</li>
              <li>Tell us promptly at the email below if you believe your account has been accessed without permission.</li>
            </ul>
          ),
        },
        {
          heading: "Your information and sharing",
          body: (
            <>
              <p>
                You own the information you enter, and you are responsible for its accuracy. You give us permission to
                store and process it only as needed to run RevBill for you, as described in our{" "}
                <Link href="/privacy" className="text-sky-700 dark:text-sky-400 hover:underline">
                  Privacy Policy
                </Link>
                .
              </p>
              <p>
                If you use sharing or bill splitting, you choose who can see which of your bills and income. You are
                responsible for what you share and with whom. Anyone you share with can see that information, and we
                can&apos;t control what they do with it.
              </p>
            </>
          ),
        },
        {
          heading: "Acceptable use",
          body: (
            <ul>
              <li>Don&apos;t use RevBill for anything illegal, or to store information about other people without their permission.</li>
              <li>Don&apos;t try to access other people&apos;s accounts or data, or interfere with or overload the service.</li>
              <li>Don&apos;t copy, resell, or reverse-engineer the service.</li>
            </ul>
          ),
        },
        {
          heading: "The service is provided \"as is\"",
          body: (
            <p>
              RevBill is provided free of charge, &quot;as is&quot; and &quot;as available,&quot; without warranties of any kind,
              express or implied, including warranties of accuracy, reliability, availability, fitness for a particular
              purpose, or non-infringement. We don&apos;t guarantee that RevBill will be uninterrupted, error-free, or
              that information will never be lost. Keep your own records of anything important.
            </p>
          ),
        },
        {
          heading: "Limitation of liability",
          body: (
            <p>
              To the fullest extent permitted by law, we will not be liable for any indirect, incidental, special,
              consequential, or punitive damages, or for any lost profits, lost data, or financial losses, arising out
              of or related to your use of RevBill, even if we were told such damages were possible. Our total
              liability for any claim related to RevBill is limited to the amount you paid us to use it in the 12
              months before the claim, which for a free service is zero.
            </p>
          ),
        },
        {
          heading: "Changes, suspension, and ending your account",
          body: (
            <>
              <p>
                We may change, suspend, or discontinue RevBill, or any part of it, at any time. We may suspend or close
                accounts that violate these terms or put the service or other users at risk.
              </p>
              <p>
                You can stop using RevBill and delete your account at any time from the Account page. Deleting your
                account permanently removes your information, as described in the Privacy Policy.
              </p>
            </>
          ),
        },
        {
          heading: "Changes to these terms",
          body: (
            <p>
              We may update these terms. When we do, we&apos;ll change the effective date at the top of this page.
              Continuing to use RevBill after an update means you accept the new terms.
            </p>
          ),
        },
        {
          heading: "Governing law",
          body: (
            <p>
              These terms are governed by the laws of the State of Colorado, without regard to its conflict-of-law
              rules. Any dispute will be handled in the state or federal courts located in Colorado.
            </p>
          ),
        },
        {
          heading: "Contact",
          body: (
            <p>
              Questions about these terms:{" "}
              <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="text-sky-700 dark:text-sky-400 hover:underline">
                {LEGAL_CONTACT_EMAIL}
              </a>
            </p>
          ),
        },
      ]}
    />
  );
}
