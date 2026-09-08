import { Link, useSearchParams } from 'react-router-dom';

// Passwordless sign-in — step 2: the emailed link lands here with ?token=…
// A real click on the button finishes sign-in. We DON'T auto-consume on load, so
// email security scanners that merely fetch the link can't burn the one-time
// token before the member clicks. The button navigates to the server consume
// endpoint, which mints the session and redirects into the portal.
const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function SignInLinkConfirmPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="card max-w-md w-full">
        <div className="p-8">
          <div className="text-center mb-8">
            <img src="/cshse-logo.svg" alt="CSHSE" className="mx-auto h-24 w-24" />
            <h1 className="mt-4 text-2xl font-bold text-gray-900">Sign in to CSHSE</h1>
            <p className="mt-1 text-sm text-gray-500">Click the button below to finish signing in.</p>
          </div>

          {!token ? (
            <div className="space-y-4" data-testid="silc-notoken">
              <div className="alert alert-error">
                This sign-in link is missing its token. Please use the button in your email, or request a new link.
              </div>
              <Link to="/sign-in-link" className="btn btn-primary w-full text-center">Request a new link</Link>
            </div>
          ) : (
            <div className="space-y-4">
              <a
                href={`${API_BASE}/auth/login-link/consume?token=${encodeURIComponent(token)}`}
                data-testid="silc-confirm"
                className="btn btn-primary w-full text-center"
              >
                Sign me in
              </a>
              <p className="text-center text-xs text-gray-500">
                This link can be used once and expires 30 minutes after it was sent.
              </p>
              <div className="text-center">
                <Link to="/login" className="text-sm font-medium text-primary-700 hover:underline">
                  Back to sign in
                </Link>
              </div>
            </div>
          )}

          <p className="mt-6 text-center text-xs text-gray-400">
            Council for Standards in Human Service Education
          </p>
        </div>
      </div>
    </div>
  );
}
