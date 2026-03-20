import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';

interface GoogleSignInButtonProps {
  onSuccess: (credential: string) => void;
  onError?: (error: string) => void;
  text?: 'signin_with' | 'signup_with' | 'continue_with';
}

export function GoogleSignInButton({ onSuccess, onError, text = 'continue_with' }: GoogleSignInButtonProps) {
  function handleSuccess(response: CredentialResponse) {
    if (response.credential) {
      onSuccess(response.credential);
    } else {
      onError?.('No credential received from Google');
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={() => onError?.('Google sign-in was cancelled')}
        text={text}
        shape="rectangular"
        theme="filled_black"
        size="large"
        width="300"
      />
    </div>
  );
}
