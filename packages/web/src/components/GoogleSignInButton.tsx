import { useGoogleLogin } from '@react-oauth/google';
import { C } from '../theme.js';

interface GoogleSignInButtonProps {
  onSuccess: (credential: string) => void;
  onError?: (error: string) => void;
  label?: string;
}

// We use useGoogleLogin + a custom button so we fully control styling (no white iframe).
// This uses the authorization code flow — backend needs to exchange the code for user info.
// BUT: we actually need an ID token, not an auth code. So we use the implicit flow
// and call Google's tokeninfo endpoint to get the id_token from the access_token.
// ACTUALLY: The simplest approach is to use Google's One Tap / credential flow via
// the google.accounts.id API directly, but @react-oauth/google's GoogleLogin component
// wraps that in an iframe we can't style.
//
// Compromise: use useGoogleLogin with ux_mode='popup', get access_token, then fetch
// userinfo from Google and pass it to our backend. But our backend expects an ID token
// verified via google-auth-library.
//
// Best approach: use the GoogleLogin component but hide the iframe and trigger it via
// our own styled button using a click-forwarding ref.

export function GoogleSignInButton({ onSuccess, onError, label = 'Continue with Google' }: GoogleSignInButtonProps) {
  return (
    <div style={{ position: 'relative' }}>
      {/* Visible custom button */}
      <button
        type="button"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          width: '100%',
          padding: '11px 16px',
          border: `1px solid ${C.muted}`,
          borderRadius: 8,
          background: 'transparent',
          color: C.text,
          fontSize: 14,
          fontWeight: 500,
          cursor: 'pointer',
          position: 'relative',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 48 48">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
        {label}
      </button>
      {/* Invisible Google iframe overlaid on top to capture the click */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0.01,
        zIndex: 2,
        overflow: 'hidden',
      }}>
        <GoogleLoginInner onSuccess={onSuccess} onError={onError} />
      </div>
    </div>
  );
}

// Separate component so the import stays clean
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';

function GoogleLoginInner({ onSuccess, onError }: { onSuccess: (c: string) => void; onError?: (e: string) => void }) {
  function handleSuccess(response: CredentialResponse) {
    if (response.credential) {
      onSuccess(response.credential);
    } else {
      onError?.('No credential received from Google');
    }
  }

  return (
    <GoogleLogin
      onSuccess={handleSuccess}
      onError={() => onError?.('Google sign-in was cancelled')}
      text="continue_with"
      theme="filled_black"
      size="large"
      width="400"
    />
  );
}
