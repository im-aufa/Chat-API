
import os
import httpx
from fastapi import HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt, jwk
from jose.exceptions import JWTError, ExpiredSignatureError, JWTClaimsError

# --- Auth0 Configuration ---
# These values will be pulled from environment variables.
# You need to set these in your .env file and your deployment environment.
AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN")
# This is the 'Identifier' of your API in the Auth0 Dashboard.
API_AUDIENCE = os.getenv("API_AUDIENCE")
ALGORITHMS = ["RS256"]

# A dictionary to cache the JWKS (JSON Web Key Set)
jwks = {}

class VerifyToken:
    """Does all the token verification using PyJWT"""

    def __init__(self):
        self.auth0_domain = AUTH0_DOMAIN
        self.api_audience = API_AUDIENCE
        self.algorithms = ALGORITHMS
        self.jwks_url = f"https://{self.auth0_domain}/.well-known/jwks.json"

    async def get_jwks(self):
        global jwks
        if not jwks:
            async with httpx.AsyncClient() as client:
                response = await client.get(self.jwks_url)
                response.raise_for_status()
                jwks = response.json()
        return jwks

    async def verify(self, token: HTTPAuthorizationCredentials = Security(HTTPBearer())):
        if token is None:
            raise HTTPException(status_code=401, detail="Unauthorized: No token provided")
        
        try:
            unverified_header = jwt.get_unverified_header(token.credentials)
        except JWTError:
            raise HTTPException(status_code=401, detail="Unauthorized: Invalid token header")

        kid = unverified_header.get("kid")
        if not kid:
            raise HTTPException(status_code=401, detail="Unauthorized: Missing 'kid' in token header")

        signing_key = None
        jwks_keys = await self.get_jwks()
        for key in jwks_keys["keys"]:
            if key["kid"] == kid:
                signing_key = jwk.construct(key, algorithm=self.algorithms[0])
                break
        
        if not signing_key:
            raise HTTPException(status_code=401, detail="Unauthorized: Could not find appropriate signing key")

        try:
            payload = jwt.decode(
                token.credentials,
                signing_key.to_pem(),
                algorithms=self.algorithms,
                audience=self.api_audience,
                issuer=f"https://{self.auth0_domain}/"
            )
            return payload
        except ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token has expired")
        except JWTClaimsError as e:
            raise HTTPException(status_code=401, detail=f"Invalid claims: {e}")
        except JWTError as e:
            raise HTTPException(status_code=401, detail=f"Token validation error: {e}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")

# Create a single instance of the verifier
token_verifier = VerifyToken()

# Dependency to be used in FastAPI endpoints
def get_current_user(token: dict = Security(token_verifier.verify)):
    # You can add more logic here, e.g., fetching user details from your database
    # based on the 'sub' (subject/user ID) claim in the token.
    return token
