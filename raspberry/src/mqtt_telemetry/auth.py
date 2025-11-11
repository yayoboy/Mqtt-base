"""
Authentication and authorization module
JWT-based authentication
"""

import jwt
from datetime import datetime, timedelta
from typing import Optional, Dict
import bcrypt
import logging

logger = logging.getLogger(__name__)


class AuthManager:
    """Manages authentication and authorization"""

    def __init__(self, config: dict):
        self.config = config
        self.enabled = config.get('authentication', {}).get('enabled', False)
        self.secret = config.get('authentication', {}).get('jwt_secret', 'secret')
        self.expiry = config.get('authentication', {}).get('jwt_expiry', '24h')
        self.users = self._load_users(config.get('authentication', {}).get('users', []))

    def _load_users(self, users_config: list) -> Dict[str, dict]:
        """Load users from configuration"""
        users = {}
        for user in users_config:
            username = user.get('username')
            if username:
                users[username] = {
                    'password_hash': user.get('password_hash'),
                    'role': user.get('role', 'user')
                }
        return users

    def _parse_expiry(self, expiry: str) -> int:
        """Parse expiry string to seconds"""
        unit = expiry[-1]
        value = int(expiry[:-1])

        if unit == 's':
            return value
        elif unit == 'm':
            return value * 60
        elif unit == 'h':
            return value * 3600
        elif unit == 'd':
            return value * 86400
        else:
            return 86400  # Default 24 hours

    async def login(self, username: str, password: str) -> Optional[str]:
        """Authenticate user and return JWT token"""
        if not self.enabled:
            return "disabled"

        user = self.users.get(username)
        if not user:
            logger.warning(f"Login attempt for unknown user: {username}")
            return None

        # Verify password
        password_hash = user.get('password_hash')
        if not self._verify_password(password, password_hash):
            logger.warning(f"Invalid password for user: {username}")
            return None

        # Generate JWT token
        token = self._generate_token(username, user.get('role'))
        logger.info(f"User logged in: {username}")
        return token

    def _verify_password(self, password: str, password_hash: str) -> bool:
        """Verify password against hash"""
        try:
            return bcrypt.checkpw(password.encode(), password_hash.encode())
        except Exception as e:
            logger.error(f"Password verification error: {e}")
            return False

    def _generate_token(self, username: str, role: str) -> str:
        """Generate JWT token"""
        expiry_seconds = self._parse_expiry(self.expiry)

        payload = {
            'username': username,
            'role': role,
            'exp': datetime.utcnow() + timedelta(seconds=expiry_seconds),
            'iat': datetime.utcnow()
        }

        token = jwt.encode(payload, self.secret, algorithm='HS256')
        return token

    async def verify_token(self, token: str) -> Optional[dict]:
        """Verify JWT token and return user info"""
        if not self.enabled:
            return {'username': 'anonymous', 'role': 'admin'}

        try:
            payload = jwt.decode(token, self.secret, algorithms=['HS256'])
            return {
                'username': payload.get('username'),
                'role': payload.get('role')
            }
        except jwt.ExpiredSignatureError:
            logger.warning("Token expired")
            return None
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid token: {e}")
            return None

    async def refresh_token(self, token: str) -> Optional[str]:
        """Refresh JWT token"""
        user = await self.verify_token(token)
        if not user:
            return None

        return self._generate_token(user['username'], user['role'])

    def hash_password(self, password: str) -> str:
        """Hash password for storage"""
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(password.encode(), salt).decode()
