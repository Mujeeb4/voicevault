"""
URL routing for users app.
"""
from django.urls import path
from .views import ConsentRecordView, UserProfileView, HealthCheckView
from .views_auth import ChangePasswordView, DeleteAccountView, PasswordResetConfirmView, PasswordResetRequestView, VerifyEmailView, ResendVerificationView, SignupView, LoginView, LogoutView, RefreshTokenView

urlpatterns = [
    # Health check endpoint
    path('health/', HealthCheckView.as_view(), name='health-check'),
    
    # Authentication endpoints
    path('signup/', SignupView.as_view(), name='signup'),
    path('verify-email/', VerifyEmailView.as_view(), name='verify-email'),
    path('resend-verification/', ResendVerificationView.as_view(), name='resend-verification'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('refresh/', RefreshTokenView.as_view(), name='refresh-token'),
    path('password-reset/request/', PasswordResetRequestView.as_view(), name='password-reset-request'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    path('delete-account/', DeleteAccountView.as_view(), name='delete-account'),
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),
    
    # Profile endpoints
    path('profile/', UserProfileView.as_view(), name='user-profile'),
    path('consent/', ConsentRecordView.as_view(), name='consent-record'),
]
