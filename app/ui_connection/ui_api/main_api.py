from __future__ import annotations
from ui_connection.ui_service.ui_users_service import (
    UIUsersError,
    get_visible_usernames,
)
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ui_connection.ui_service.registration_service import (
    RegistrationError,
    register_user,
)
from ui_connection.ui_service.login_service import (
    LoginError,
    login_user,
)
from ui_connection.ui_service.password_reset_service import (
    PasswordResetError,
    confirm_password_reset,
    request_password_reset,
)
from ui_connection.runtime.runtime_manager import runtime_manager
from ui_connection.ui_service.wallet_overview_service import (
    WalletOverviewError,
    get_wallet_overview,
)
from ui_connection.ui_service.orders_service import (
    OrdersOverviewError,
    get_orders_overview,
)

from ui_connection.ui_service.trade_config_service import (
    TradeConfigError,
    get_trade_configurations,
    reset_trade_configurations_to_default,
    save_trade_configurations,
)


class RegisterRequest(BaseModel):
    username: str
    email: str
    emailRepeat: str
    firstName: str
    lastName: str
    dateOfBirth: str
    country: str
    mobilePhone: str
    gender: str
    experience: str
    estimatedBudget: str
    password: str
    passwordRepeat: str
    responsibilityApproved: bool
    language: str


class LoginRequest(BaseModel):
    email: str
    password: str
    responsibilityApproved: bool
    language: str


class ForgotPasswordRequest(BaseModel):
    email: str
    language: str


class ResetPasswordRequest(BaseModel):
    token: str
    password: str
    passwordRepeat: str
    language: str


class LockPasswordRequest(BaseModel):
    password: str

class TradeConfigRequest(BaseModel):
    requesting_username: str
    requesting_user_type: str
    selected_username: str | None = None


class TradeConfigSaveRequest(BaseModel):
    requesting_username: str
    requesting_user_type: str
    selected_username: str | None = None
    sections: list


app = FastAPI(title="TradeOPS UI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/api/register")
def register(request: RegisterRequest):
    try:
        return register_user(request.model_dump())
    except RegistrationError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={
                "field": exc.field,
                "message": exc.message,
            },
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={
                "field": None,
                "message": f"Unexpected server error: {str(exc)}",
            },
        ) from exc


@app.post("/api/login")
def login(request: LoginRequest):
    try:
        return login_user(request.model_dump())
    except LoginError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={
                "field": exc.field,
                "message": exc.message,
                "redirect_to": exc.redirect_to,
                "warning": exc.warning,
            },
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={
                "field": None,
                "message": f"Unexpected server error: {str(exc)}",
            },
        ) from exc


@app.post("/api/forgot-password")
def forgot_password(request: ForgotPasswordRequest):
    try:
        return request_password_reset(request.model_dump())
    except PasswordResetError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={
                "field": exc.field,
                "message": exc.message,
            },
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={
                "field": None,
                "message": f"Unexpected server error: {str(exc)}",
            },
        ) from exc


@app.post("/api/reset-password")
def reset_password(request: ResetPasswordRequest):
    try:
        return confirm_password_reset(request.model_dump())
    except PasswordResetError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={
                "field": exc.field,
                "message": exc.message,
            },
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={
                "field": None,
                "message": f"Unexpected server error: {str(exc)}",
            },
        ) from exc


@app.get("/api/runtime/status")
def runtime_status():
    return runtime_manager.get_status()


@app.get("/api/runtime/logs")
def runtime_logs(limit: int = 400):
    return {"logs": runtime_manager.get_logs(limit)}


@app.post("/api/runtime/tws/start")
def runtime_tws_start():
    try:
        return runtime_manager.start_tws()
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"TWS start failed: {str(exc)}"},
        ) from exc


@app.post("/api/runtime/tws/stop")
def runtime_tws_stop():
    try:
        return runtime_manager.stop_tws()
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"TWS stop failed: {str(exc)}"},
        ) from exc


@app.post("/api/runtime/server/start")
def runtime_server_start():
    try:
        return runtime_manager.start_server()
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Server start failed: {str(exc)}"},
        ) from exc


@app.post("/api/runtime/server/stop")
def runtime_server_stop():
    try:
        return runtime_manager.stop_server()
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Server stop failed: {str(exc)}"},
        ) from exc


@app.post("/api/runtime/test")
def runtime_test():
    try:
        return runtime_manager.runtime_test()
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Runtime test failed: {str(exc)}"},
        ) from exc


@app.post("/api/runtime/stop-all")
def runtime_stop_all():
    try:
        return runtime_manager.stop_all()
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Stop-all failed: {str(exc)}"},
        ) from exc


@app.post("/api/runtime/unlock")
def runtime_unlock(request: LockPasswordRequest):
    try:
        return {"success": runtime_manager.verify_lock_password(request.password)}
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Unlock failed: {str(exc)}"},
        ) from exc
    
@app.post("/api/runtime/tws/restart")
def runtime_tws_restart():
    try:
        return runtime_manager.restart_tws()
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"TWS restart failed: {str(exc)}"},
        ) from exc


@app.post("/api/runtime/server/restart")
def runtime_server_restart():
    try:
        return runtime_manager.restart_server()
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Server restart failed: {str(exc)}"},
        ) from exc


@app.post("/api/runtime/logs/clear")
def runtime_logs_clear():
    try:
        return runtime_manager.clear_logs()
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Log clear failed: {str(exc)}"},
        ) from exc
    

@app.get("/api/wallet-overview")
def wallet_overview(
    requesting_username: str,
    requesting_user_type: str,
    selected_username: str | None = None,
    ibkr_mode: str = "LIVE",
    chart_days: int = 30,
):
    try:
        return get_wallet_overview(
            requesting_username=requesting_username,
            requesting_user_type=requesting_user_type,
            selected_username=selected_username,
            ibkr_mode=ibkr_mode,
            chart_days=chart_days,
        )
    except WalletOverviewError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"message": exc.message},
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Wallet overview failed: {str(exc)}"},
        ) from exc
    
@app.get("/api/ui/users")
def ui_users(requesting_username: str, requesting_user_type: str):
    try:
        return get_visible_usernames(
            requesting_username=requesting_username,
            requesting_user_type=requesting_user_type,
        )
    except UIUsersError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"message": exc.message},
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"User list failed: {str(exc)}"},
        ) from exc
    

@app.get("/api/orders-overview")
def orders_overview(
    requesting_username: str,
    requesting_user_type: str,
    selected_username: str | None = None,
    ibkr_mode: str = "LIVE",
):
    try:
        return get_orders_overview(
            requesting_username=requesting_username,
            requesting_user_type=requesting_user_type,
            selected_username=selected_username,
            ibkr_mode=ibkr_mode,
        )
    except OrdersOverviewError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"message": exc.message},
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Orders overview failed: {str(exc)}"},
        ) from exc
    
@app.get("/api/trade-configurations")
def trade_configurations(
    requesting_username: str,
    requesting_user_type: str,
    selected_username: str | None = None,
):
    try:
        return get_trade_configurations(
            requesting_username=requesting_username,
            requesting_user_type=requesting_user_type,
            selected_username=selected_username,
        )
    except TradeConfigError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"message": exc.message},
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Trade configurations failed: {str(exc)}"},
        ) from exc


@app.post("/api/trade-configurations/save")
def trade_configurations_save(request: TradeConfigSaveRequest):
    try:
        return save_trade_configurations(
            requesting_username=request.requesting_username,
            requesting_user_type=request.requesting_user_type,
            selected_username=request.selected_username,
            payload={"sections": request.sections},
        )
    except TradeConfigError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"message": exc.message},
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Trade configuration save failed: {str(exc)}"},
        ) from exc


@app.post("/api/trade-configurations/reset-defaults")
def trade_configurations_reset(request: TradeConfigRequest):
    try:
        return reset_trade_configurations_to_default(
            requesting_username=request.requesting_username,
            requesting_user_type=request.requesting_user_type,
            selected_username=request.selected_username,
        )
    except TradeConfigError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"message": exc.message},
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": f"Trade configuration reset failed: {str(exc)}"},
        ) from exc