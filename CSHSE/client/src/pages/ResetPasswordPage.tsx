import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';

// Step 2 of the password reset: the emailed link lands here with ?token=…
// Enter + confirm a new password → Submit → back to the login screen.
export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setIsLoading(true);
    try {
      await api.post('/api/auth/reset-password', { token, password });
      // Back to the login screen with a success flag so it can greet them.
      navigate('/login?reset=1');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not reset the password. Please request a new link.');
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
            <h1 className="mt-4 text-2xl font-bold text-gray-900">Choose a new password</h1>
            <p className="mt-1 text-sm text-gray-500">Enter and confirm your new password.</p>
          </div>

          {!token ? (
            <div className="space-y-4" data-testid="rp-notoken">
              <div className="alert alert-error">
                This reset link is missing its token. Please use the link from your email, or request a new one.
              </div>
              <Link to="/forgot-password" className="btn btn-primary w-full text-center">Request a new link</Link>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              {error && <div className="alert alert-error" data-testid="rp-error">{error}</div>}
              <div className="form-group">
                <label htmlFor="password" className="form-label">New password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input"
                  placeholder="At least 8 characters"
                  data-testid="rp-password"
                />
              </div>
              <div className="form-group">
                <label htmlFor="confirm" className="form-label">Confirm new password</label>
                <input
                  id="confirm"
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="form-input"
                  placeholder="Re-enter your password"
                  data-testid="rp-confirm"
                />
              </div>
              <button type="submit" disabled={isLoading} data-testid="rp-submit" className="btn btn-primary w-full">
                {isLoading ? (<><span className="spinner w-4 h-4 mr-2"></span>Saving…</>) : 'Submit'}
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
