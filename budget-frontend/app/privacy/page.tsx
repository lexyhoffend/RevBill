import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy Policy · RevBill" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={
        <p>
          This policy explains what information RevBill stores, why, and what control you have over it. The short
          version: RevBill only stores what you enter, uses it only to run the app for you, and never sells it.
        </p>
      }
      sections={[
        {
          heading: "Information we store",
          body: (
            <ul>
              <li>
                <strong>Account information:</strong> your email address, an optional display name, a 7-digit account ID,
                your password, which is stored only as a one-way scrambled (hashed) value that we cannot read, and the date
                you agreed to these Terms and this Privacy Policy (and which version).
              </li>
              <li>
                <strong>Budget information you enter:</strong> pay cycle settings, income sources and amounts, bills,
                amounts, categories, due days, payment status, credit card balances you track, and savings buckets.
              </li>
              <li>
                <strong>Sharing settings:</strong> the email addresses or account IDs of people you choose to share or
                split bills with, and which items you shared.
              </li>
            </ul>
          ),
        },
        {
          heading: "Information we don't collect",
          body: (
            <ul>
              <li>RevBill never connects to your bank, credit card, or any financial account, and never asks for account numbers or login credentials for them.</li>
              <li>No advertising, no ad trackers, and no third-party analytics.</li>
              <li>We don&apos;t sell, rent, or trade your information, and we don&apos;t use it for marketing.</li>
            </ul>
          ),
        },
        {
          heading: "How we use your information",
          body: (
            <ul>
              <li>To run RevBill: show your budget, calculate totals and projections, and remember your settings.</li>
              <li>To keep you signed in, using a secure session cookie that is required for the app to work.</li>
              <li>To show the bills and income you chose to share to the people you shared them with.</li>
              <li>To respond if you contact us.</li>
            </ul>
          ),
        },
        {
          heading: "Who can see your information",
          body: (
            <>
              <p>
                <strong>People you share with:</strong> only the specific bills and income you choose to share, along
                with your display name or email. They can&apos;t see anything you haven&apos;t shared.
              </p>
              <p>
                <strong>Service providers:</strong> RevBill runs on third-party hosting providers (currently Vercel for
                the website, Render for the server, and a hosted database provider) that store and process data on our
                behalf only to operate the service.
              </p>
              <p>
                <strong>Legal requirements:</strong> we may disclose information if required by law, or to protect the
                safety or rights of users or the service.
              </p>
            </>
          ),
        },
        {
          heading: "Security",
          body: (
            <p>
              Passwords are hashed, connections to RevBill are encrypted (HTTPS), and every request is checked so you can
              only access your own data and data explicitly shared with you. No system is perfectly secure, so we
              can&apos;t guarantee absolute security. Please use a password you don&apos;t use anywhere else.
            </p>
          ),
        },
        {
          heading: "Keeping and deleting your information",
          body: (
            <>
              <p>
                We keep your information for as long as your account exists. You can view and edit everything you&apos;ve
                entered at any time.
              </p>
              <p>
                You can permanently delete your account from the <strong>Account</strong> page. This immediately
                removes your account and all of your budget information, and ends any sharing you set up. If someone
                split a bill with you, their copy of that reimbursement history stays in their account. Deleted data may
                remain in our hosting providers&apos; routine backups for a limited time before it is overwritten.
              </p>
            </>
          ),
        },
        {
          heading: "Children",
          body: <p>RevBill is intended for adults 18 and older and is not directed at children. We don&apos;t knowingly collect information from anyone under 18.</p>,
        },
        {
          heading: "Changes to this policy",
          body: <p>If we change this policy, we&apos;ll update the effective date at the top of this page.</p>,
        },
        {
          heading: "Contact",
          body: (
            <p>
              Questions or requests about your information:{" "}
              <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="text-emerald-700 dark:text-emerald-400 hover:underline">
                {LEGAL_CONTACT_EMAIL}
              </a>
            </p>
          ),
        },
      ]}
    />
  );
}
