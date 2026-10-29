"""FastAPI application entry point.

Creates the ASGI app, registers routers, configures CORS, exception
handlers, and manages the application lifespan (PostgreSQL and ML model).
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.dependencies import get_prediction_service
from app.api.routes import dashboard, emergency, health, prediction, sensor, users
from app.core.config import settings
from app.core.logger import setup_logger
from app.database.postgres import close_postgres, connect_to_postgres, engine
from app.models.postgres_models import Base

logger = setup_logger(__name__)


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Handle application startup and shutdown."""
    # --- Startup -----------------------------------------------------------
    logger.info("Starting %s v%s", settings.APP_NAME, settings.APP_VERSION)

    # Connect to PostgreSQL
    try:
        eng = await connect_to_postgres()
        if eng is not None:
            async with eng.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            logger.info("Database tables created / verified")
    except Exception as exc:
        logger.warning("PostgreSQL connection failed: %s", exc)

    # Pre-load ML model
    try:
        predictor = get_prediction_service()
        predictor.load()
        logger.info("ML model loaded successfully")
    except Exception as exc:
        logger.warning("ML model could not be loaded at startup: %s", exc)
        logger.warning("The /predict endpoint will return 503 until the model is available.")

    logger.info("%s is ready", settings.APP_NAME)
    yield
    # --- Shutdown ----------------------------------------------------------
    logger.info("Shutting down %s ...", settings.APP_NAME)
    predictor = get_prediction_service()
    predictor.unload()
    await close_postgres()
    logger.info("Shutdown complete")


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "Central server for the Wearable Cardiac Risk Monitoring and "
        "Emergency Alert System.  Provides REST endpoints for the React "
        "Native mobile app, the ESP32 wearable device, and the ML model."
    ),
    lifespan=lifespan,
    contact={
        "name": "Cardiac Risk Monitoring Team",
        "url": "https://github.com/anomalyco/smart-watch",
    },
    license_info={
        "name": "MIT",
    },
)

# ---------------------------------------------------------------------------
# Vercel rewrite handler
# ---------------------------------------------------------------------------

@app.middleware("http")
async def vercel_rewrite_middleware(request: Request, call_next):
    """Restore original requested path from Vercel rewrite parameter."""
    path_param = request.query_params.get("__path")
    if path_param is not None:
        corrected = "/" + path_param.lstrip("/")
        request.scope["path"] = corrected
        request.scope["raw_path"] = corrected.encode("utf-8")
    elif request.scope.get("path") in ("/api/index.py", "/api"):
        request.scope["path"] = "/"
        request.scope["raw_path"] = b"/"

    return await call_next(request)


# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



# ---------------------------------------------------------------------------
# Global exception handler
# ---------------------------------------------------------------------------

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch unhandled exceptions and return a 500 response."""
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred."},
    )


# ---------------------------------------------------------------------------
# Register routers
# ---------------------------------------------------------------------------

app.include_router(health.router)
app.include_router(prediction.router)
app.include_router(sensor.router)
app.include_router(dashboard.router)
app.include_router(emergency.router)
app.include_router(users.router)


# ---------------------------------------------------------------------------
# Root redirect
# ---------------------------------------------------------------------------

@app.get("/api", include_in_schema=False)
@app.get("/api/index.py", include_in_schema=False)
@app.get("/", include_in_schema=False)
async def root(request: Request) -> dict:
    return {
        "application": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "scope_path": request.scope.get("path"),
        "query_string": request.scope.get("query_string", b"").decode("utf-8", "ignore"),
        "headers": {k: v for k, v in request.headers.items() if "auth" not in k.lower()},
    }
