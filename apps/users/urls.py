"""
URL routing for users app.
"""
from django.urls import path
from .views import ConsentRecordView, UserProfileView, HealthCheckView
from .views_auth import SignupView, LoginView, LogoutView, RefreshTokenView

urlpatterns = [
    # Health check endpoint
    path('health/', HealthCheckView.as_view(), name='health-check'),
    
    # Authentication endpoints
    path('signup/', SignupView.as_view(), name='signup'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('refresh/', RefreshTokenView.as_view(), name='refresh-token'),
    
    # Profile endpoints
    path('profile/', UserProfileView.as_view(), name='user-profile'),
    path('consent/', ConsentRecordView.as_view(), name='consent-record'),
]
