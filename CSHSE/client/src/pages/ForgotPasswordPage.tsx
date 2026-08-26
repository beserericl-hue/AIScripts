import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

// Step 1 of the password reset: enter your email → we send a reset link.
// A memberclick-only account is told to contact the MemberClick administrator.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [memberclick, setMemberclick] = useState<{ adminName: string; adminEmail: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await api.post('/api/auth/forgot-password', { email: email.trim() });
      if (res.data?.memberclickOnly) {
        setMemberclick({ adminName: res.data.adminName, adminEmail: res.data.adminEmail });
      } else {
        setSent(true);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="card max-w-md w-full">
        <div className="p-8">
          <div className="text-center mb-8">
            <img src="/cshse-logo.svg" alt="CSHSE" className="mx-auto h-24 w-24" />
            <h1 className="mt-4 text-2xl font-bold text-gray-900">Reset your password</h1>
            <p className="mt-1 text-sm text-gray-500">
              Enter the email you use to sign in and we'll send you a reset link.
            </p>
          </div>

          {memberclick ? (
            // MemberClick-only members have no CSHSE password to reset.
            <div data-testid="fp-memberclick" className="space-y-4">
              <div className="alert alert-error">
                This account signs in through <strong>MemberClick</strong>, so there's no CSHSE
                password to reset.
              </div>
              <p className="text-sm text-gray-600">
                To reset your MemberClick password, please contact your MemberClick administrator,{' '}
                <strong>{memberclick.adminName}</strong> (
                <a className="text-primary-700 hover:underline" href={`mailto:${memberclick.adminEmail}`}>
                  {memberclick.adminEmail}
                </a>
                ).
              </p>
              <Link to="/login" className="btn btn-primary w-full text-center">Back to sign in</Link>
            </div>
          ) : sent ? (
            <div data-testid="fp-sent" className="space-y-4">
              <div className="alert alert-success">
                If an account exists for <strong>{email}</strong>, we've emailed a link to reset your
                password. The link expires in 1 hour.
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Don't see it? Please <strong>check your spam or junk folder</strong> for an email from{' '}
                <strong>cshse.courseworx.media</strong>.
              </div>
              <Link to="/login" className="btn btn-primary w-full text-center">Back to sign in</Link>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-group">
                <label htmlFor="email" className="form-label">Email address</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input"
                  placeholder="you@example.com"
                  data-testid="fp-email"
                />
              </div>
              <button type="submit" disabled={isLoading} data-testid="fp-send" className="btn btn-primary w-full">
                {isLoading ? (<><span className="spinner w-4 h-4 mr-2"></span>Sending…</>) : 'Send reset link'}
              </button>
              <div className="text-center">
                <Link to="/login" className="text-sm font-medium text-primary-700 hover:underline">
                  Back to sign in
                </Link>
              </div>
            </form>
          )}

          <p className="mt-6 text-center text-xs text-gray-400">
            Council for Standards in Human Service Education
          </p>
        </div>
      </div>
    </div>
  );
}
