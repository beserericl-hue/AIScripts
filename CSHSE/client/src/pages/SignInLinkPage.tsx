import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

// Passwordless sign-in — step 1: enter your email, we send a one-time link.
export default function SignInLinkPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await api.post('/api/auth/login-link', { email: email.trim() });
      setSent(true);
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
            <h1 className="mt-4 text-2xl font-bold text-gray-900">Email me a sign-in link</h1>
            <p className="mt-1 text-sm text-gray-500">
              Enter the email you use for CSHSE and we'll send you a one-time link to sign in — no
              password needed.
            </p>
          </div>

          {sent ? (
            <div data-testid="sil-sent" className="space-y-4">
              <div className="alert alert-success">
                If an account exists for <strong>{email}</strong>, we've emailed a sign-in link. It
                expires in 30 minutes.
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
                  data-testid="sil-email"
                />
              </div>
              <button type="submit" disabled={isLoading} data-testid="sil-send" className="btn btn-primary w-full">
                {isLoading ? (<><span className="spinner w-4 h-4 mr-2"></span>Sending…</>) : 'Send my sign-in link'}
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
