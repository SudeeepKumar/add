import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export const ForgotPasswordPage = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [emailSent, setEmailSent] = useState(false);
    const { resetPassword } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!email) {
            toast.error('Please enter your email address');
            return;
        }

        try {
            setLoading(true);
            await resetPassword(email);
            setEmailSent(true);
            toast.success('Password reset email sent!');
        } catch (error) {
            console.error('Password reset error:', error);
            if (error.code === 'auth/user-not-found') {
                toast.error('No account found with this email');
            } else if (error.code === 'auth/invalid-email') {
                toast.error('Invalid email address');
            } else {
                toast.error('Failed to send reset email. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 px-4">
            <div className="max-w-md w-full">
                {/* Logo and Title */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-white mb-2">BILLJI</h1>
                    <p className="text-primary-100">A Product Of Sudeepta Kumar Panda</p>
                </div>

                {/* Reset Password Card */}
                <div className="glass bg-white/90 backdrop-blur-lg rounded-2xl shadow-2xl p-8">
                    {!emailSent ? (
                        <>
                            <div className="flex items-center justify-center mb-6">
                                <Mail className="w-12 h-12 text-primary-600" />
                            </div>

                            <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
                                Forgot Password?
                            </h2>
                            <p className="text-gray-600 text-center mb-6">
                                No worries! Enter your email and we'll send you reset instructions.
                            </p>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <Input
                                    label="Email Address"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="your@email.com"
                                    disabled={loading}
                                />

                                <Button
                                    type="submit"
                                    variant="primary"
                                    className="w-full"
                                    disabled={loading}
                                >
                                    {loading ? 'Sending...' : 'Send Reset Link'}
                                </Button>
                            </form>

                            <div className="mt-6 text-center">
                                <Link
                                    to="/login"
                                    className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700"
                                >
                                    <ArrowLeft size={16} />
                                    Back to Login
                                </Link>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center justify-center mb-6">
                                <CheckCircle className="w-16 h-16 text-green-500" />
                            </div>

                            <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
                                Check Your Email
                            </h2>
                            <p className="text-gray-600 text-center mb-6">
                                We've sent password reset instructions to <strong>{email}</strong>
                            </p>

                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                                <p className="text-sm text-blue-800">
                                    <strong>Next steps:</strong>
                                </p>
                                <ol className="list-decimal list-inside text-sm text-blue-700 mt-2 space-y-1">
                                    <li>Check your inbox (and spam folder)</li>
                                    <li>Click the reset link in the email</li>
                                    <li>Create a new password</li>
                                    <li>Sign in with your new password</li>
                                </ol>
                            </div>

                            <Link to="/login">
                                <Button variant="primary" className="w-full">
                                    Return to Login
                                </Button>
                            </Link>

                            <p className="mt-4 text-center text-sm text-gray-600">
                                Didn't receive the email?{' '}
                                <button
                                    onClick={() => {
                                        setEmailSent(false);
                                        setEmail('');
                                    }}
                                    className="font-medium text-primary-600 hover:text-primary-700"
                                >
                                    Try again
                                </button>
                            </p>
                        </>
                    )}
                </div>

                {/* Footer */}
                <p className="mt-8 text-center text-sm text-primary-100">
                    A Product Of Sudeepta Kumar Panda
                </p>
            </div>
        </div>
    );
};
