import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../shared/api/client';
import { setSessionProfile, setSessionToken } from '../../shared/auth/session';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await apiClient.post('/api/admin/auth/login', { email, password });
      const token = response.data?.data?.accessToken;
      const user = response.data?.data?.user;
      if (!token) {
        setError('Login did not return an access token.');
        return;
      }

      setSessionToken(token);
      if (user) {
        setSessionProfile({
          id: user.id,
          email: user.email,
          role: user.role,
          permissions: user.permissions
        });
      }
      navigate('/dashboard', { replace: true });
    } catch (err) {
      void err;
      setError('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <form className="card login-card" onSubmit={onSubmit}>
        <h2>Welcome Back</h2>
        <p>Sign in to manage SlackTrack reminders and attendance.</p>

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="hr@company.com"
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="********"
            required
          />
        </label>

        {error ? <div className="error-box">{error}</div> : null}

        <button className="primary-btn" type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}
