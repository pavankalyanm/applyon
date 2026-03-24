__version__ = "0.1.0"

# Fix SSL certificate verification on macOS/Windows where Python's bundled
# certificates are often missing or stale. Setting these env vars makes
# urllib, requests, httpx, and undetected-chromedriver all use certifi's CA bundle.
import os as _os
try:
    import certifi as _certifi
    _ca = _certifi.where()
    _os.environ.setdefault("SSL_CERT_FILE", _ca)
    _os.environ.setdefault("REQUESTS_CA_BUNDLE", _ca)
except ImportError:
    pass
